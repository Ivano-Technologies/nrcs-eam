/**
 * Playwright E2E seed — idempotent (requires existing `sites` row).
 *   pnpm exec tsx scripts/db/seed-e2e.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { authTokens, users } from "../../drizzle/schema";
import { getDb } from "../../server/db";

export const E2E_OPENID = "e2e-playwright-openid";
export const E2E_EMAIL = "nrcs.eam.qa@gmail.com";
/** 64 chars — must match verify URL token */
export const E2E_TOKEN =
  "e2e000000000000000000000000000000000000000000000000000000000000";

export async function runSeedE2e() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  await db.delete(authTokens).where(eq(authTokens.token, E2E_TOKEN));

  await db
    .insert(users)
    .values({
      openId: E2E_OPENID,
      name: "E2E Admin",
      email: E2E_EMAIL,
      loginMethod: "magic_link",
      role: "admin",
      siteId: 1,
      hasCompletedOnboarding: true,
    })
    .onDuplicateKeyUpdate({
      set: {
        name: "E2E Admin",
        email: E2E_EMAIL,
        role: "admin",
        siteId: 1,
        hasCompletedOnboarding: true,
      },
    });

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.openId, E2E_OPENID));
  const userId = rows[0]?.id;
  if (!userId) throw new Error("user row missing");

  await db.insert(authTokens).values({
    userId,
    token: E2E_TOKEN,
    type: "magic_link",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    usedAt: null,
  });
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
