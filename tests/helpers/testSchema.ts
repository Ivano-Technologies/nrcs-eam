import type { SupabaseClient } from "@supabase/supabase-js";

export function getPlaywrightTestSchema(): string {
  const value = process.env.SUPABASE_TEST_SCHEMA?.trim();
  return value || "test";
}

export async function applySupabaseTestSchema(
  supabase: SupabaseClient,
  label: string,
): Promise<void> {
  const schema = getPlaywrightTestSchema();
  const { error } = await supabase.rpc("set_config", {
    setting: "search_path",
    value: schema,
    is_local: true,
  });
  if (error) {
    throw new Error(`[${label}] Failed to set search_path to '${schema}': ${error.message}`);
  }
}
