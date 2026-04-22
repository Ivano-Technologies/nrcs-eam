/**
 * Seed canonical NRCS facilities (branches) if missing — idempotent.
 *
 * Usage: pnpm exec tsx scripts/db/seed-facilities.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { sites } from "../../drizzle/schema";
import { getDb, resetDbConnection } from "../../server/db";

const SEED = [
  {
    code: "NHQ",
    name: "NRCS Headquarters - Abuja",
    address: "11 Eko Akete Close, Off Okotie Eboh Street",
    city: "Abuja",
    state: "FCT",
    country: "Nigeria",
    contactPerson: "Admin",
    contactPhone: "+234-XXX-XXXX",
    isActive: true,
    facilityType: "branch" as const,
    parentFacilityId: null as number | null,
  },
  {
    code: "LAG",
    name: "NRCS Lagos Branch",
    address: "Lagos Office Complex",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    isActive: true,
    facilityType: "branch" as const,
    parentFacilityId: null,
  },
  {
    code: "KAN",
    name: "NRCS Kano Branch",
    address: "Kano Office",
    city: "Kano",
    state: "Kano",
    country: "Nigeria",
    isActive: true,
    facilityType: "branch" as const,
    parentFacilityId: null,
  },
] as const;

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL / database not available");
    process.exit(1);
  }

  for (const row of SEED) {
    const existing = await db.select({ id: sites.id }).from(sites).where(eq(sites.name, row.name)).limit(1);
    if (existing.length > 0) {
      await db.update(sites).set({ code: row.code }).where(eq(sites.name, row.name));
      console.log(`Updated code (exists): ${row.name} -> ${row.code}`);
      continue;
    }
    await db.insert(sites).values(row);
    console.log(`Inserted: ${row.name}`);
  }

  await resetDbConnection();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
