/**
 * Pre-cutover analysis for Phase 6 (inventory_documents retirement).
 *
 * Usage:
 *   node scripts/analyze-6-inventory-documents.mjs
 *   node scripts/analyze-6-inventory-documents.mjs --json
 */
import "dotenv/config";
import postgres from "postgres";

const jsonMode = process.argv.includes("--json");
const DATABASE_URL = process.env.DATABASE_URL;

async function runAnalysis(sql) {
  const byType = await sql`
    SELECT document_type, COUNT(*)::int AS count
    FROM inventory_documents
    GROUP BY document_type
    ORDER BY count DESC
  `;

  const [total] = await sql`SELECT COUNT(*)::int AS c FROM inventory_documents`;

  const [incomingFks] = await sql`
    SELECT COUNT(*)::int AS c
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'inventory_documents'::regclass
  `;

  const [orphanWaybills] = await sql`
    SELECT COUNT(*)::int AS c
    FROM inventory_documents id
    WHERE document_type = 'waybill'
      AND NOT EXISTS (
        SELECT 1 FROM waybills w WHERE w.wb_number = id.document_number
      )
  `;

  const [orphanGrns] = await sql`
    SELECT COUNT(*)::int AS c
    FROM inventory_documents id
    WHERE document_type = 'grn'
      AND NOT EXISTS (
        SELECT 1 FROM goods_received_notes grn WHERE grn.grn_number = id.document_number
      )
  `;

  const [orphanTransfers] = await sql`
    SELECT COUNT(*)::int AS c
    FROM inventory_documents id
    WHERE document_type = 'transfer_note'
      AND NOT EXISTS (
        SELECT 1 FROM transfer_notes tn WHERE tn.tn_number = id.document_number
      )
  `;

  return {
    totalDocuments: total.c,
    byDocumentType: byType,
    incomingForeignKeys: incomingFks.c,
    orphans: {
      waybill: orphanWaybills.c,
      grn: orphanGrns.c,
      transfer_note: orphanTransfers.c,
    },
  };
}

function printHuman(stats) {
  console.log("Phase 6 inventory_documents analysis");
  console.log("====================================");
  console.log(`Total legacy documents: ${stats.totalDocuments}`);
  console.log(`Incoming FKs to inventory_documents: ${stats.incomingForeignKeys} (expect 0 after 4d)`);
  console.log("");
  console.log("By document_type:");
  for (const row of stats.byDocumentType) {
    console.log(`  ${row.document_type}: ${row.count}`);
  }
  console.log("");
  console.log("Orphans (legacy doc with no relational match by document_number):");
  console.log(`  waybill: ${stats.orphans.waybill}`);
  console.log(`  grn: ${stats.orphans.grn}`);
  console.log(`  transfer_note: ${stats.orphans.transfer_note}`);
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
