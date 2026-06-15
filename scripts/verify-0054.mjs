/**
 * Verify migration 0054 (distributions.waybill_id FK repoint to waybills).
 *
 * Usage:
 *   node scripts/verify-0054.mjs
 *   dotenv -e .env -- node scripts/verify-0054.mjs
 */
import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

const CHECKS = [
  {
    id: "old_fk_dropped",
    sql: `
      SELECT count(*)::int = 0 AS ok
      FROM pg_constraint
      WHERE conname = 'distributions_waybill_id_inventory_documents_id_fk'
    `,
    assert: (row) => row?.ok === true,
  },
  {
    id: "new_fk_exists",
    sql: `
      SELECT 1 AS ok
      FROM pg_constraint
      WHERE conname = 'distributions_waybill_id_waybills_id_fk'
      LIMIT 1
    `,
  },
  {
    id: "no_orphan_waybill_ids",
    sql: `
      SELECT count(*)::int AS orphan_count
      FROM distributions d
      WHERE d.waybill_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM waybills w WHERE w.id = d.waybill_id)
    `,
    assert: (row) => Number(row?.orphan_count ?? -1) === 0,
  },
  {
    id: "linked_count",
    sql: `SELECT count(*)::int AS linked_count FROM distributions WHERE waybill_id IS NOT NULL`,
    optional: true,
  },
  {
    id: "sample_join",
    sql: `
      SELECT d.distribution_number, w.wb_number, w.status
      FROM distributions d
      INNER JOIN waybills w ON w.id = d.waybill_id
      ORDER BY d.id DESC
      LIMIT 5
    `,
    optional: true,
    multi: true,
  },
];

async function main() {
  if (!DATABASE_URL) {
    console.error("FAIL: DATABASE_URL is not set (.env required for live verification)");
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL, { max: 1 });
  const results = [];

  try {
    for (const check of CHECKS) {
      try {
        const rows = await sql.unsafe(check.sql);
        const row = rows[0] ?? null;
        const pass = check.assert ? check.assert(row) : Array.isArray(rows) && rows.length > 0;
        results.push({ id: check.id, pass, detail: check.multi ? rows : row });

        if (!pass && !check.optional) {
          console.error(`FAIL: ${check.id}`, check.multi ? rows : row);
        } else if (check.id === "old_fk_dropped" && pass) {
          console.log("OK: old_fk_dropped — legacy FK constraint removed");
        } else if (check.id === "new_fk_exists" && pass) {
          console.log("OK: new_fk_exists — distributions_waybill_id_waybills_id_fk present");
        } else if (check.id === "no_orphan_waybill_ids" && pass) {
          console.log("OK: no_orphan_waybill_ids — orphaned distributions: 0");
        } else if (check.id === "linked_count") {
          console.log(`OK: linked_count — distributions pointing to waybills.id: ${row?.linked_count ?? 0}`);
        } else if (check.id === "sample_join") {
          console.log("OK: sample_join — spot check:");
          for (const sample of rows) {
            console.log(`  ${sample.distribution_number} → ${sample.wb_number} (${sample.status})`);
          }
          if (rows.length === 0) {
            console.log("  (no linked distributions yet)");
          }
        } else if (!check.optional) {
          console.log(`OK: ${check.id}`, row ?? "");
        }
      } catch (err) {
        if (check.optional) {
          console.warn(`SKIP (optional): ${check.id}`, err instanceof Error ? err.message : err);
          results.push({ id: check.id, pass: false, optional: true });
        } else {
          throw err;
        }
      }
    }

    const requiredFailed = results.some((r) => !r.pass && !r.optional);
    if (requiredFailed) {
      console.error("\nMigration 0054 verification FAILED — apply drizzle/0054_distributions_waybill_fk_repoint.sql");
      process.exit(1);
    }

    console.log("\nMigration 0054 verification PASSED");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
