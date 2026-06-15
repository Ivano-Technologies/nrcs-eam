/**
 * Pre-migration analysis for Phase 4d (distributions.waybill_id FK repoint).
 *
 * Usage:
 *   node scripts/analyze-4d-backfill.mjs
 *   node scripts/analyze-4d-backfill.mjs --json
 */
import "dotenv/config";
import postgres from "postgres";

const jsonMode = process.argv.includes("--json");
const DATABASE_URL = process.env.DATABASE_URL;

function pct(part, total) {
  if (total <= 0) return "0.0";
  return ((part / total) * 100).toFixed(1);
}

async function runAnalysis(sql) {
  const [totalDist] = await sql`SELECT count(*)::int AS c FROM distributions`;
  const [withWaybill] = await sql`SELECT count(*)::int AS c FROM distributions WHERE waybill_id IS NOT NULL`;
  const [withoutWaybill] = await sql`SELECT count(*)::int AS c FROM distributions WHERE waybill_id IS NULL`;
  const [matchableViaLegacy] = await sql`
    SELECT count(*)::int AS c
    FROM distributions d
    INNER JOIN inventory_documents idoc ON d.waybill_id = idoc.id AND idoc.document_type = 'waybill'
    INNER JOIN waybills w ON w.wb_number = idoc.document_number
  `;
  const [alreadyRelationalId] = await sql`
    SELECT count(*)::int AS c
    FROM distributions d
    INNER JOIN waybills w ON d.waybill_id = w.id
    WHERE NOT EXISTS (
      SELECT 1 FROM inventory_documents idoc
      WHERE idoc.id = d.waybill_id AND idoc.document_type = 'waybill'
    )
  `;
  const [orphaned] = await sql`
    SELECT count(*)::int AS c
    FROM distributions d
    WHERE d.waybill_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM waybills w WHERE w.id = d.waybill_id)
      AND NOT EXISTS (
        SELECT 1 FROM inventory_documents idoc
        INNER JOIN waybills w ON w.wb_number = idoc.document_number
        WHERE idoc.id = d.waybill_id AND idoc.document_type = 'waybill'
      )
  `;
  const [invalidFk] = await sql`
    SELECT count(*)::int AS c
    FROM distributions d
    WHERE d.waybill_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM inventory_documents idoc WHERE idoc.id = d.waybill_id)
      AND NOT EXISTS (SELECT 1 FROM waybills w WHERE w.id = d.waybill_id)
  `;

  return {
    totalDistributions: totalDist.c,
    withWaybillId: withWaybill.c,
    withoutWaybillId: withoutWaybill.c,
    matchableViaLegacyDocNumber: matchableViaLegacy.c,
    alreadyStoresWaybillsId: alreadyRelationalId.c,
    orphanedAfterBackfill: orphaned.c,
    invalidFkReferences: invalidFk.c,
  };
}

function printHuman(stats) {
  const base = stats.withWaybillId;
  console.log("Phase 4d backfill analysis");
  console.log("==========================");
  console.log(`Total distributions: ${stats.totalDistributions}`);
  console.log(`With waybill_id: ${stats.withWaybillId}`);
  console.log(`Without waybill_id: ${stats.withoutWaybillId}`);
  console.log(
    `Matchable to relational waybills: ${stats.matchableViaLegacyDocNumber} (${pct(stats.matchableViaLegacyDocNumber, base)}%)`
  );
  console.log(`Orphaned (will be set NULL): ${stats.orphanedAfterBackfill} (${pct(stats.orphanedAfterBackfill, base)}%)`);
  console.log(`Already relational: ${stats.alreadyStoresWaybillsId} (${pct(stats.alreadyStoresWaybillsId, base)}%)`);
  console.log(`Invalid FK references: ${stats.invalidFkReferences}`);
}

async function main() {
  if (!DATABASE_URL) {
    console.log("SKIP: DATABASE_URL is not set — analysis skipped");
    process.exit(0);
  }

  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    const stats = await runAnalysis(sql);
    if (jsonMode) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      printHuman(stats);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
