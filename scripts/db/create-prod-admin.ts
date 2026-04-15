/**
 * One-off: upsert first admin user in production (or any DB reachable via DATABASE_URL).
 * Run: pnpm exec dotenv -e .env -- tsx scripts/db/create-prod-admin.ts
 */
import { getDb } from "../../server/db";
import { users } from "../../drizzle/schema";

const OPEN_ID = "prod-admin-ivanonigeria-gmail";
const EMAIL = "ivanonigeria@gmail.com";
const NAME = "Ivano Technologies";

async function main() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database unavailable — check DATABASE_URL in .env");
  }

  await db
    .insert(users)
    .values({
      openId: OPEN_ID,
      name: NAME,
      email: EMAIL,
      loginMethod: "magic_link",
      role: "admin",
      hasCompletedOnboarding: true,
    })
    .onConflictDoUpdate({
      target: users.openId,
      set: {
        name: NAME,
        email: EMAIL,
        role: "admin",
        hasCompletedOnboarding: true,
      },
    });

  console.log("Admin created successfully");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
