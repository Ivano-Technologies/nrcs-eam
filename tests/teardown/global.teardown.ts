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
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  const ssl = getPostgresJsSslOption();

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ...(ssl !== undefined ? { ssl } : {}),
  });

  // Waybill E2E posts `source_type=waybill` ledger rows. Removing only those restores CTN balances for the
  // next run; truncating all `stock_movements` wipes GRN opening balances and leaves CTNs at net 0.
  try {
    await sql.unsafe(`DELETE FROM ${schema}.stock_movements WHERE source_type = 'waybill'`);
    console.log(`[teardown] deleted ${schema}.stock_movements where source_type=waybill`);
  } catch {
    // Mirror schema may use different names in some environments.
  }

  try {
    // Do not TRUNCATE `users`: CASCADE would also truncate `stock_movements` (FK from created_by),
    // wiping GRN opening balances and leaving WMS CTNs at net 0 for the next E2E run.
    await sql.unsafe(`
      TRUNCATE TABLE ${schema}.movements, ${schema}.grns, ${schema}.waybills,
        ${schema}.requisitions, ${schema}.assets CASCADE;
    `);
  } catch {
    // Fallback to current table names in this schema (do not truncate all stock_movements — see above).
    await sql.unsafe(`
      TRUNCATE TABLE ${schema}.goods_received_notes, ${schema}.waybills,
        ${schema}.requisitions, ${schema}.assets CASCADE;
    `);
  }

  for (const table of ["assets", "requisitions", "waybills", "goods_received_notes"]) {
    console.log(`[teardown] truncated ${schema}.${table}`);
  }

  const supabase = createClient(supabaseUrl, secretKey, {
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
