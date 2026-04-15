/**
 * Playwright E2E seed — idempotent (requires existing `sites` row).
 * Prefer: `pnpm run seed-e2e:local` (loads `.env.e2e` for local Postgres).
 *
 * Optional: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `E2E_SUPABASE_PASSWORD`
 * to create/link a Supabase Auth user for the E2E email.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { users } from "../../drizzle/schema";
import { getDb } from "../../server/db";

export const E2E_OPENID = "e2e-playwright-openid";
export const E2E_EMAIL = "nrcs.eam.qa@gmail.com";

export async function runSeedE2e() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, E2E_EMAIL))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(users).values({
      openId: E2E_OPENID,
      name: "E2E Admin",
      email: E2E_EMAIL,
      loginMethod: "supabase",
      role: "admin",
      siteId: 1,
      hasCompletedOnboarding: true,
    });
  } else {
    await db
      .update(users)
      .set({
        name: "E2E Admin",
        role: "admin",
        siteId: 1,
        hasCompletedOnboarding: true,
      })
      .where(eq(users.id, existing[0]!.id));
  }

  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && serviceKey) {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const password =
      process.env.E2E_SUPABASE_PASSWORD ?? "E2E_Supabase_ChangeMe_9!";
    const { data: created, error: createErr } =
      await supabase.auth.admin.createUser({
        email: E2E_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { full_name: "E2E Admin" },
      });
    if (createErr && !/already exists|duplicate/i.test(createErr.message)) {
      console.warn("[seed-e2e] Supabase createUser:", createErr.message);
    }
    const authId = created?.user?.id;
    if (authId) {
      await db
        .update(users)
        .set({
          authUserId: authId,
          openId: authId,
          loginMethod: "supabase",
        })
        .where(eq(users.email, E2E_EMAIL));
    }
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
