/**
 * Seeds WMS `donors` with common IFRC / humanitarian partners.
 * Idempotent: uses onConflictDoNothing on `code`.
 *
 * Run: `pnpm run db:seed:wms-donors`
 */
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as dotenv from "dotenv";
import { donors } from "../../drizzle/schema";
import { WMS_DONOR_SEED } from "../../shared/wmsDonors";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function main() {
  const client = postgres(url, { prepare: false, max: 5 });
  const db = drizzle(client);
  await db.insert(donors).values(WMS_DONOR_SEED).onConflictDoNothing({ target: donors.code });
  console.log(`WMS donors seed complete (${WMS_DONOR_SEED.length} rows attempted, conflicts skipped).`);
  await client.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
