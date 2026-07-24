/**
 * Apply scripts/db/bootstrap.sql against DATABASE_URL.
 * Idempotent and production-safe: bootstrap.sql never CREATE OR REPLACE.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const bootstrapPath = join(__dirname, "bootstrap.sql");
const sqlText = readFileSync(bootstrapPath, "utf8");

const client = postgres(url, { prepare: false, max: 5 });

async function main() {
  console.log(`Applying database bootstrap from ${bootstrapPath}…`);
  await client.unsafe(sqlText);
  console.log("Database bootstrap applied successfully.");
  await client.end({ timeout: 5 });
  process.exit(0);
}

main().catch(async (error) => {
  console.error("Database bootstrap failed:", error);
  try {
    await client.end({ timeout: 5 });
  } catch {
    // ignore close errors after failure
  }
  process.exit(1);
});
