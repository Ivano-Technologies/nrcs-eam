/**
 * Verify migration 0050 (stock_card_balances materialized view).
 *
 * Usage:
 *   node scripts/verify-0050.mjs
 *   dotenv -e .env -- node scripts/verify-0050.mjs
 *
 * Manual SQL (Supabase SQL editor):
 *   SELECT * FROM pg_matviews WHERE matviewname = 'stock_card_balances';
 *   SELECT indexname FROM pg_indexes WHERE tablename = 'stock_card_balances';
 *   SELECT proname FROM pg_proc WHERE proname = 'refresh_stock_card_balances';
 *   SELECT count(*) FROM stock_card_balances;
 *   SELECT refresh_stock_card_balances(true);
 */
import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

const CHECKS = [
  {
    id: "matview_exists",
    sql: `SELECT 1 AS ok FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'stock_card_balances' LIMIT 1`,
  },
  {
    id: "unique_index_stock_card_id",
    sql: `SELECT 1 AS ok FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_stock_card_balances_stock_card_id' LIMIT 1`,
  },
  {
    id: "index_location_id",
    sql: `SELECT 1 AS ok FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_stock_card_balances_location_id' LIMIT 1`,
  },
  {
    id: "refresh_function",
    sql: `
      SELECT 1 AS ok
      FROM pg_proc p
      INNER JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'refresh_stock_card_balances'
      LIMIT 1
    `,
  },
  {
    id: "row_count",
    sql: `SELECT count(*)::bigint AS row_count FROM stock_card_balances`,
    optional: true,
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
        const pass = Array.isArray(rows) && rows.length > 0;
        results.push({ id: check.id, pass, detail: rows[0] ?? null });
        if (!pass && !check.optional) {
          console.error(`FAIL: ${check.id}`);
        } else {
          console.log(`OK: ${check.id}`, rows[0] ?? "");
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
      console.error("\nMigration 0050 verification FAILED — apply drizzle/0050_stock_card_balances_mv.sql");
      process.exit(1);
    }

    console.log("\nMigration 0050 verification PASSED");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
