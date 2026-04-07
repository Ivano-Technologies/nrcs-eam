/**
 * Step 0a — verify DATABASE_URL / MySQL before E2E.
 * Run: pnpm exec tsx scripts/db-check.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB FAIL: getDb() returned null — check DATABASE_URL in .env");
    process.exit(1);
  }
  await db.execute(sql`SELECT 1`);
  console.log("DB OK");
  process.exit(0);
}

main().catch((e) => {
  console.error("DB FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
