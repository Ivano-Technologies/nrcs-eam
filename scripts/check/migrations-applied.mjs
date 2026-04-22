import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const journalPath = path.join(repoRoot, "drizzle", "meta", "_journal.json");

function loadJournalTags() {
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  return (journal.entries ?? []).map((entry) => entry.tag);
}

function loadDatabaseUrl(envPathArg) {
  const envPath = path.resolve(repoRoot, envPathArg);
  const envResult = dotenv.config({ path: envPath });
  if (envResult.error) {
    throw new Error(`Could not read env file at ${envPathArg}: ${envResult.error.message}`);
  }
  const databaseUrl = envResult.parsed?.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is missing in ${envPathArg}`);
  }
  return databaseUrl;
}

async function readAppliedCount(databaseUrl) {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 15,
  });
  try {
    const rows = await sql`select count(*)::int as count from drizzle.__drizzle_migrations`;
    return rows[0]?.count ?? 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const envPathArg = process.argv[2];
  const dbLabel = process.argv[3] ?? "Dev DB";
  if (!envPathArg) {
    console.error("Usage: node scripts/check/migrations-applied.mjs <env-file>");
    process.exit(1);
  }

  try {
    const databaseUrl = loadDatabaseUrl(envPathArg);
    const journalTags = loadJournalTags();
    const appliedCount = await readAppliedCount(databaseUrl);
    const missing = appliedCount < journalTags.length ? journalTags.slice(appliedCount) : [];

    if (missing.length > 0) {
      const migrateHint = dbLabel.toLowerCase().includes("e2e")
        ? "Run pnpm db:migrate:e2e first."
        : "Run pnpm db:migrate:dev first.";
      console.error(`${dbLabel} is missing migrations: [${missing.join(", ")}]. ${migrateHint}`);
      process.exit(1);
    }

    console.log(`OK ${dbLabel} migrations applied (${envPathArg}).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}

await main();
