import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const drizzleDir = path.join(repoRoot, "drizzle");
const journalPath = path.join(repoRoot, "drizzle", "meta", "_journal.json");

function readJournalTags() {
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  return new Set((journal.entries ?? []).map((entry) => entry.tag));
}

function readSqlTags() {
  const files = fs
    .readdirSync(drizzleDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name.replace(/\.sql$/i, ""));
  return new Set(files);
}

function formatSet(values) {
  return [...values].sort().map((value) => `  - ${value}`).join("\n");
}

function main() {
  const journalTags = readJournalTags();
  const sqlTags = readSqlTags();

  const missingInJournal = [...sqlTags].filter((tag) => !journalTags.has(tag));
  const missingSql = [...journalTags].filter((tag) => !sqlTags.has(tag));

  if (missingInJournal.length > 0 || missingSql.length > 0) {
    console.error("Migration parity check failed. Journal and SQL files are out of sync. See mismatches above.");
    if (missingInJournal.length > 0) {
      console.error("\nSQL files missing in drizzle/meta/_journal.json:");
      console.error(formatSet(missingInJournal));
    }
    if (missingSql.length > 0) {
      console.error("\nJournal entries missing .sql files:");
      console.error(formatSet(missingSql));
    }
    process.exit(1);
  }

  console.log("OK migration parity check passed.");
}

main();
