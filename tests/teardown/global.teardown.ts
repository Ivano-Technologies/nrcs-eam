import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { getPostgresJsSslOption } from "../../shared/mysqlSsl";
import { getPlaywrightTestSchema } from "../helpers/testSchema";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[teardown] Missing required env var: ${name}`);
  }
  return value;
}

export default async function globalTeardown(): Promise<void> {
  const schema = getPlaywrightTestSchema();
  const databaseUrl = requireEnv("DATABASE_URL");
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const ssl = getPostgresJsSslOption();

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ...(ssl !== undefined ? { ssl } : {}),
  });

  try {
    await sql.unsafe(`
      TRUNCATE TABLE ${schema}.movements, ${schema}.grns, ${schema}.waybills,
        ${schema}.requisitions, ${schema}.assets, ${schema}.users CASCADE;
    `);
  } catch {
    // Fallback to current table names in this schema.
    await sql.unsafe(`
      TRUNCATE TABLE ${schema}.stock_movements, ${schema}.goods_received_notes, ${schema}.waybills,
        ${schema}.requisitions, ${schema}.assets, ${schema}.users CASCADE;
    `);
  }

  for (const table of ["users", "assets", "requisitions", "waybills", "goods_received_notes", "stock_movements"]) {
    console.log(`[teardown] truncated ${schema}.${table}`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    throw new Error(`[teardown] listUsers failed: ${error.message}`);
  }
  const candidates = data.users.filter((user) =>
    (user.email ?? "").toLowerCase().startsWith("playwright_"),
  );
  for (const user of candidates) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      throw new Error(`[teardown] deleteUser failed for ${user.email}: ${deleteError.message}`);
    }
    console.log(`[teardown] deleted auth user ${user.email}`);
  }

  await sql.end({ timeout: 10 });
}
