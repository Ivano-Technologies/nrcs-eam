/**
 * Verify migration 0052 (distribution_outbound_daily materialized view).
 *
 * Usage:
 *   node scripts/verify-0052.mjs
 *   dotenv -e .env -- node scripts/verify-0052.mjs
 */
import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

const CHECKS = [
  {
    id: "matview_exists",
    sql: `SELECT 1 AS ok FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'distribution_outbound_daily' LIMIT 1`,
  },
  {
    id: "unique_index_date_location",
    sql: `SELECT 1 AS ok FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_distribution_outbound_daily_date_location' LIMIT 1`,
  },
  {
    id: "index_location_date",
    sql: `SELECT 1 AS ok FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_distribution_outbound_daily_location_date' LIMIT 1`,
  },
  {
    id: "refresh_function",
    sql: `
      SELECT 1 AS ok
      FROM pg_proc p
      INNER JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'refresh_distribution_outbound_daily'
      LIMIT 1
    `,
  },
  {
    id: "row_count",
    sql: `SELECT count(*)::bigint AS row_count FROM distribution_outbound_daily`,
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
      console.error("\nMigration 0052 verification FAILED — apply drizzle/0052_distribution_velocity_mv.sql");
      process.exit(1);
    }

    console.log("\nMigration 0052 verification PASSED");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
