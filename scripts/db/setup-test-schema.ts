import "dotenv/config";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { getPostgresJsSslOption } from "../../shared/mysqlSsl";

type TableRow = { table_name: string };

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[setup-test-schema] Missing required env var: ${name}`);
  }
  return value;
}

function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/** Copy idempotent rows from public into the mirrored schema (FK-safe order). */
async function syncPublicReferenceIntoTest(
  sql: ReturnType<typeof postgres>,
  schema: string,
): Promise<void> {
  if (!/^\w+$/.test(schema)) {
    throw new Error(`[setup-test-schema] invalid schema name: ${schema}`);
  }
  const s = quoteIdent(schema);
  const tablesToResync = [
    "donors",
    "sites",
    "inventory_catalogue",
    "commodity_tracking_numbers",
    "stock_cards",
  ] as const;

  try {
    // Remove prior partial copies so INSERT…SELECT from public cannot hit unique (id) vs unique (code) skew.
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("stock_movements")}`);
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("stock_cards")}`);
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("commodity_tracking_numbers")}`);
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("stock_settings")}`);
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("inventory_catalogue")}`);
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("donors")}`);

    await sql.unsafe(`
      INSERT INTO ${s}.${quoteIdent("donors")} SELECT * FROM public.${quoteIdent("donors")};
    `);
    await sql.unsafe(`
      INSERT INTO ${s}.${quoteIdent("sites")} SELECT * FROM public.${quoteIdent("sites")}
      ON CONFLICT (id) DO NOTHING;
    `);
    await sql.unsafe(`
      INSERT INTO ${s}.${quoteIdent("inventory_catalogue")} SELECT * FROM public.${quoteIdent("inventory_catalogue")};
    `);
    await sql.unsafe(`
      INSERT INTO ${s}.${quoteIdent("commodity_tracking_numbers")} SELECT * FROM public.${quoteIdent("commodity_tracking_numbers")};
    `);
    await sql.unsafe(`
      INSERT INTO ${s}.${quoteIdent("stock_cards")} SELECT sc.* FROM public.${quoteIdent("stock_cards")} sc
      WHERE EXISTS (
        SELECT 1 FROM ${s}.${quoteIdent("commodity_tracking_numbers")} c WHERE c.id = sc.ctn_id
      );
    `);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[setup-test-schema] public→${schema} reference sync skipped: ${msg}`);
    return;
  }

  for (const t of tablesToResync) {
    try {
      await sql.unsafe(`
        SELECT setval(
          pg_get_serial_sequence('${schema}.${t}', 'id'),
          COALESCE((SELECT MAX(id) FROM ${s}.${quoteIdent(t)}), 1)
        );
      `);
    } catch {
      // Table may use non-serial PK; ignore.
    }
  }
}

export async function setupTestSchema(): Promise<void> {
  const databaseUrl = requireEnv("DATABASE_URL");
  // Require service role key so this script only runs in privileged test contexts.
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const schema = process.env.SUPABASE_TEST_SCHEMA?.trim() || "test";

  const ssl = getPostgresJsSslOption();
  const options: Parameters<typeof postgres>[1] = {
    max: 1,
    prepare: false,
  };
  if (ssl !== undefined) {
    options.ssl = ssl;
  }

  const sql = postgres(databaseUrl, options);
  try {
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)};`);

    const tables = await sql<TableRow[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    for (const { table_name: tableName } of tables) {
      await sql.unsafe(
        `CREATE TABLE IF NOT EXISTS ${quoteIdent(schema)}.${quoteIdent(tableName)} (LIKE public.${quoteIdent(tableName)} INCLUDING ALL);`,
      );
    }

    // Empty `LIKE public …` shells shadow `public` once the API uses `search_path = test, public`.
    // Copy fixture/reference rows from `public` so E2E (waybill catalogue dropdown, CTN balances) works.
    await syncPublicReferenceIntoTest(sql, schema);

    await sql.unsafe(`SET search_path TO ${quoteIdent(schema)};`);
    console.log(`[setup-test-schema] schema '${schema}' ready with ${tables.length} mirrored tables`);
  } finally {
    await sql.end({ timeout: 10 });
  }
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isDirectRun) {
  setupTestSchema()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
