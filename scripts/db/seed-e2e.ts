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
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { donors, sites, users } from "../../drizzle/schema";
import { WMS_DONOR_SEED } from "../../shared/wmsDonors";
import { getDb } from "../../server/db";

export const E2E_OPENID = "e2e-playwright-openid";
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
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existingSite = await db.select({ id: sites.id }).from(sites).limit(1);
  const seedSiteId = existingSite[0]?.id ?? null;

  await db.insert(donors).values(WMS_DONOR_SEED).onConflictDoNothing({ target: donors.code });

  await db
    .insert(users)
    .values({
      openId: E2E_OPENID,
      name: "E2E Admin",
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
        name: "E2E Admin",
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
        user_metadata: { full_name: "E2E Admin" },
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
      user_metadata: { full_name: "E2E Admin" },
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
