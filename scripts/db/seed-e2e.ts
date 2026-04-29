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
import { donors, users } from "../../drizzle/schema";
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

export async function runSeedE2e() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, E2E_EMAIL))
    .limit(1);

  await db.insert(donors).values(WMS_DONOR_SEED).onConflictDoNothing({ target: donors.code });

  if (existing.length === 0) {
    await db.insert(users).values({
      openId: E2E_OPENID,
      name: "E2E Admin",
      email: E2E_EMAIL,
      loginMethod: "supabase",
      role: "admin",
      status: "active",
      siteId: 1,
      hasCompletedOnboarding: true,
    });
  } else {
    await db
      .update(users)
      .set({
        name: "E2E Admin",
        role: "admin",
        status: "active",
        siteId: 1,
        hasCompletedOnboarding: true,
      })
      .where(eq(users.id, existing[0]!.id));
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
  const supabaseServiceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const password = requireEnv("E2E_USER_PASSWORD");

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

  let authId = created?.user?.id ?? undefined;
  if (!authId) {
    const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) {
      throw new Error(`[seed-e2e] Supabase listUsers failed: ${listErr.message}`);
    }
    authId = listed.users.find((u) => (u.email ?? "").toLowerCase() === E2E_EMAIL)?.id;
  }
  if (!authId) {
    throw new Error("[seed-e2e] Could not resolve Supabase auth user id for E2E user");
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(authId, {
    password,
    email_confirm: true,
    user_metadata: { full_name: "E2E Admin" },
  });
  if (updateErr) {
    throw new Error(`[seed-e2e] Supabase updateUserById failed: ${updateErr.message}`);
  }

  const { error: signInErr } = await anon.auth.signInWithPassword({
    email: E2E_EMAIL,
    password,
  });
  if (signInErr) {
    throw new Error(`[seed-e2e] Supabase signInWithPassword failed: ${signInErr.message}`);
  }

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
