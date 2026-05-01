import type { SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { getPostgresJsSslOption } from "../../shared/mysqlSsl";

export function getPlaywrightTestSchema(): string {
  const value = process.env.SUPABASE_TEST_SCHEMA?.trim();
  return value || "test";
}

export async function applySupabaseTestSchema(
  _supabase: SupabaseClient,
  label: string,
): Promise<void> {
  const schema = getPlaywrightTestSchema();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(`[${label}] Missing DATABASE_URL for search_path setup`);
  }

  const ssl = getPostgresJsSslOption();
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ...(ssl !== undefined ? { ssl } : {}),
  });
  try {
    await sql.unsafe(`SET search_path TO "${schema}";`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[${label}] Failed to set search_path to '${schema}': ${message}`);
  } finally {
    await sql.end({ timeout: 10 });
  }
}
