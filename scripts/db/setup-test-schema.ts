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

  const warn = (step: string, e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[setup-test-schema] public→${schema} ${step} skipped: ${msg}`);
  };

  try {
    // Remove prior partial copies so INSERT…SELECT from public cannot hit unique (id) vs unique (code) skew.
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("stock_movements")}`);
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("stock_cards")}`);
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("commodity_tracking_numbers")}`);
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("stock_settings")}`);
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("inventory_catalogue")}`);
    await sql.unsafe(`DELETE FROM ${s}.${quoteIdent("donors")}`);

    // Deduplicate by `code` so a dirty public catalogue (duplicate donor codes) cannot
    // abort the whole sync and leave `test` without inventory rows for Playwright.
    await sql.unsafe(`
      INSERT INTO ${s}.${quoteIdent("donors")} (id, name, code, type, country, notes, created_at)
      SELECT id, name, code, type, country, notes, created_at
      FROM (
        SELECT
          id,
          name,
          code,
          type,
          country,
          notes,
          created_at,
          ROW_NUMBER() OVER (PARTITION BY code ORDER BY id) AS rn
        FROM public.${quoteIdent("donors")}
      ) d
      WHERE d.rn = 1;
    `);
  } catch (e) {
    warn("donor wipe/insert", e);
    return;
  }

  // Catalogue + CTNs must sync even when `sites` hits duplicate-code drift vs existing test rows
  // (otherwise waybill E2E waits forever on an empty item Select).
  try {
    await sql.unsafe(`
      INSERT INTO ${s}.${quoteIdent("inventory_catalogue")} SELECT * FROM public.${quoteIdent("inventory_catalogue")};
    `);
  } catch (e) {
    warn("inventory_catalogue copy", e);
  }

  try {
    await sql.unsafe(`
      INSERT INTO ${s}.${quoteIdent("commodity_tracking_numbers")} SELECT * FROM public.${quoteIdent("commodity_tracking_numbers")};
    `);
  } catch (e) {
    warn("commodity_tracking_numbers copy", e);
  }

  try {
    // `sites.code` is UNIQUE. Stale `test` rows can share a facility code with `public` under a
    // different `id`, which aborts the whole INSERT and leaves `stock_cards` (FK to `sites.id`)
    // out of sync — waybill CTN dropdowns then miss E2E-CTN balances.
    await sql.unsafe(`
      WITH canon AS (
        SELECT DISTINCT ON (COALESCE(NULLIF(trim(ps.code), ''), ps.id::text))
          ps.id AS canon_id,
          COALESCE(NULLIF(trim(ps.code), ''), ps.id::text) AS dedup_key
        FROM public.${quoteIdent("sites")} ps
        ORDER BY COALESCE(NULLIF(trim(ps.code), ''), ps.id::text), ps.id
      ),
      stale AS (
        SELECT t.id AS stale_id, c.canon_id
        FROM ${s}.${quoteIdent("sites")} t
        INNER JOIN canon c ON c.dedup_key = COALESCE(NULLIF(trim(t.code), ''), t.id::text)
        WHERE t.id <> c.canon_id
      )
      UPDATE ${s}.${quoteIdent("sites")} t
      SET code = NULL
      FROM stale st
      WHERE t.id = st.stale_id;
    `);
    await sql.unsafe(`
      INSERT INTO ${s}.${quoteIdent("sites")}
      SELECT s.* FROM public.${quoteIdent("sites")} s
      INNER JOIN (
        SELECT DISTINCT ON (COALESCE(NULLIF(trim(code), ''), id::text)) id
        FROM public.${quoteIdent("sites")}
        ORDER BY COALESCE(NULLIF(trim(code), ''), id::text), id
      ) pick ON pick.id = s.id
      ON CONFLICT (id) DO NOTHING;
    `);
  } catch (e) {
    warn("sites copy", e);
  }

  try {
    await sql.unsafe(`
      INSERT INTO ${s}.${quoteIdent("stock_cards")} SELECT sc.* FROM public.${quoteIdent("stock_cards")} sc
      WHERE EXISTS (
        SELECT 1 FROM ${s}.${quoteIdent("commodity_tracking_numbers")} c WHERE c.id = sc.ctn_id
      );
    `);
  } catch (e) {
    warn("stock_cards copy", e);
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
