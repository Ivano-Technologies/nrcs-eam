/**
 * Playwright E2E seed — idempotent (requires existing `sites` row).
 * Prefer: `pnpm run seed-e2e:local` (loads `.env.e2e` for local Postgres).
 *
 * Required Supabase env vars:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 * - E2E_USER_EMAIL
 * - E2E_USER_PASSWORD
 *
 * This script no longer writes legacy magic-link tables; auth is Supabase session-based.
 */
import "dotenv/config";
import { asc, eq, sql } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { commodityTrackingNumbers, donors, sites, stockMovements, users } from "../../drizzle/schema";
import { WMS_DONOR_SEED } from "../../shared/wmsDonors";
import { getDb } from "../../server/db";
import { ensureStockCardForCtnAtLocation, insertGrnReceiptMovement } from "../../server/wms/grnStockLedger";
import { applySupabaseTestSchema, getPlaywrightTestSchema } from "../../tests/helpers/testSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * Global Playwright teardown deletes waybill ledger rows without restoring every CTN variant.
 * Top up GRN movements for each warehouse × CTN (first chunk of rows) so waybill picks any UI CTNs.
 */
async function topUpE2eWmsCtnStockForPlaywright(db: Db) {
  // Waybill dispatch validates stock per (CTN × warehouse). The UI balance is global across locations,
  // so topping up only the first warehouse leaves other warehouses at 0 while the test picks
  // "first" warehouse in the dropdown (name order) — dispatch then fails with no status change.
  const warehouses = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.facilityType, "warehouse"));
  if (warehouses.length === 0) return;

  const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.email, E2E_EMAIL)).limit(1);
  const createdBy = actor?.id ?? null;

  const ctns = await db
    .select({ id: commodityTrackingNumbers.id })
    .from(commodityTrackingNumbers)
    .orderBy(asc(commodityTrackingNumbers.id))
    .limit(48);

  const TARGET = 30;
  for (const { id: warehouseId } of warehouses) {
    for (const { id: ctnId } of ctns) {
      const stockCardId = await ensureStockCardForCtnAtLocation(db, { ctnId, locationId: warehouseId });
      const [agg] = await db
        .select({
          net: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(
            Number,
          ),
        })
        .from(stockMovements)
        .where(eq(stockMovements.stockCardId, stockCardId));
      const net = Number(agg?.net ?? 0);
      const need = Math.max(0, TARGET - net);
      if (need <= 0) continue;
      await insertGrnReceiptMovement(db, {
        stockCardId,
        quantityIn: need,
        documentNumber: "E2E-SEED-REBALANCE",
        fromTo: "E2E seed top-up",
        remarks: "seed-e2e: restore CTN stock for Playwright after ledger teardown",
        createdBy,
      });
    }
  }
}

export const E2E_OPENID = "PLW_E2E_ADMIN_OPENID";
export const E2E_EMAIL =
  process.env.E2E_USER_EMAIL?.trim() || "playwright@nrcseam.techivano.com";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[seed-e2e] Missing required env var: ${name}`);
  }
  return value;
}

function isDuplicateSupabaseUserError(message: string | undefined): boolean {
  if (!message) return false;
  return /already exists|duplicate|already been registered/i.test(message);
}

function isStrongPassword(value: string): boolean {
  return (
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

const MAX_ATTEMPTS = 4;
const INITIAL_DELAY_MS = 500;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withSeedRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) {
        const reason = lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
        throw new Error(`[seed] failed after 4 attempts — Supabase may be unavailable.${reason}`);
      }
      const delay = INITIAL_DELAY_MS * 2 ** (attempt - 1);
      console.warn(`[seed] retry ${attempt + 1}/${MAX_ATTEMPTS} after ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error("[seed] failed after 4 attempts — Supabase may be unavailable");
}

export async function runSeedE2e() {
  // `getDb()` bakes `search_path` into each pooled connection from this env. A post-connect
  // `SET search_path` is not reliable with `max > 1`, and `.env.e2e` often omits the key.
  const testSchema = getPlaywrightTestSchema();
  if (!process.env.SUPABASE_TEST_SCHEMA?.trim()) {
    process.env.SUPABASE_TEST_SCHEMA = testSchema;
  }

  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existingSite = await db.select({ id: sites.id }).from(sites).limit(1);
  const seedSiteId = existingSite[0]?.id ?? null;

  await db.insert(donors).values(WMS_DONOR_SEED).onConflictDoNothing({ target: donors.code });

  await db
    .insert(users)
    .values({
      openId: E2E_OPENID,
      name: "[TEST] E2E Admin",
      email: E2E_EMAIL,
      loginMethod: "supabase",
      role: "admin",
      status: "active",
      siteId: seedSiteId,
      hasCompletedOnboarding: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        openId: E2E_OPENID,
        name: "[TEST] E2E Admin",
        email: E2E_EMAIL,
        loginMethod: "supabase",
        role: "admin",
        status: "active",
        siteId: seedSiteId,
        hasCompletedOnboarding: true,
      },
    });

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
  const supabaseServiceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const fromEnv =
    process.env.E2E_USER_PASSWORD?.trim() ??
    process.env.TEST_USER_PASSWORD?.trim();
  const password =
    fromEnv && isStrongPassword(fromEnv) ? fromEnv : "PlaywrightTest@2026";

  const admin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await applySupabaseTestSchema(admin, "seed-e2e");
  await applySupabaseTestSchema(anon, "seed-e2e");

  let created:
    | {
        user: { id?: string | null } | null;
      }
    | undefined;
  await withSeedRetry(async () => {
    try {
      const response = await admin.auth.admin.createUser({
        email: E2E_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { full_name: "[TEST] E2E Admin" },
      });
      created = response.data as typeof created;
      if (response.error && !isDuplicateSupabaseUserError(response.error.message)) {
        throw new Error(`[seed-e2e] Supabase createUser failed: ${response.error.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isDuplicateSupabaseUserError(message)) {
        throw error;
      }
    }
  });

  let authId = created?.user?.id ?? undefined;
  if (!authId) {
    const listed = await withSeedRetry(async () => {
      const { data, error } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (error) {
        throw new Error(`[seed-e2e] Supabase listUsers failed: ${error.message}`);
      }
      return data;
    });
    authId = listed.users.find((u) => (u.email ?? "").toLowerCase() === E2E_EMAIL)?.id;
  }
  if (!authId) {
    throw new Error("[seed-e2e] Could not resolve Supabase auth user id for E2E user");
  }

  await withSeedRetry(async () => {
    const { error } = await admin.auth.admin.updateUserById(authId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: "[TEST] E2E Admin" },
    });
    if (error) {
      throw new Error(`[seed-e2e] Supabase updateUserById failed: ${error.message}`);
    }
  });

  await withSeedRetry(async () => {
    const { error } = await anon.auth.signInWithPassword({
      email: E2E_EMAIL,
      password,
    });
    if (error) {
      throw new Error(`[seed-e2e] Supabase signInWithPassword failed: ${error.message}`);
    }
  });

  await db
    .update(users)
    .set({
      authUserId: authId,
      openId: authId,
      loginMethod: "supabase",
    })
    .where(eq(users.email, E2E_EMAIL));

  try {
    await topUpE2eWmsCtnStockForPlaywright(db);
  } catch (error) {
    console.warn("[seed-e2e] WMS CTN stock top-up skipped:", error instanceof Error ? error.message : error);
  }
}

runSeedE2e()
  .then(() => {
    console.log("seed-e2e OK");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
