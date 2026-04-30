import "dotenv/config";
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

async function setupTestSchema(): Promise<void> {
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

    await sql.unsafe(`SET search_path TO ${quoteIdent(schema)};`);
    console.log(`[setup-test-schema] schema '${schema}' ready with ${tables.length} mirrored tables`);
  } finally {
    await sql.end({ timeout: 10 });
  }
}

setupTestSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
