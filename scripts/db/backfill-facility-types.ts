/**
 * One-time facility type backfill from existing facility naming/code conventions.
 *
 * Usage:
 *   pnpm exec tsx scripts/db/backfill-facility-types.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb, resetDbConnection } from "../../server/db";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.execute(sql`
    UPDATE "sites"
    SET "facilityType" = 'branch'::facility_type
    WHERE "name" ILIKE '%branch%'
       OR COALESCE("code", '') ILIKE '%-BRN-%'
  `);

  await db.execute(sql`
    UPDATE "sites"
    SET "facilityType" = 'division'::facility_type
    WHERE COALESCE("code", '') ILIKE '%-DIV-%'
  `);

  await db.execute(sql`
    UPDATE "sites"
    SET "facilityType" = 'clinic'::facility_type
    WHERE COALESCE("code", '') ILIKE '%-CLN-%'
  `);

  await db.execute(sql`
    UPDATE "sites"
    SET "facilityType" = 'warehouse'::facility_type
    WHERE COALESCE("code", '') ILIKE '%-WHS-%'
  `);

  await db.execute(sql`
    UPDATE "sites"
    SET "facilityType" = 'branch'::facility_type
    WHERE "facilityType" IS NULL
  `);

  console.log("Facility type backfill complete.");
  await resetDbConnection();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
