import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./env";

let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

function requireSupabaseConfig(): { url: string; anonKey: string } {
  const url = ENV.supabaseUrl.trim();
  const anonKey = ENV.supabaseAnonKey.trim();
  if (!url || !anonKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY must be set for Supabase Auth"
    );
  }
  return { url, anonKey };
}

/** Anon key — sign-in, getUser(accessToken), refreshSession. Never expose service role to the browser. */
export function getSupabaseAnonServer(): SupabaseClient {
  if (!anonClient) {
    const { url, anonKey } = requireSupabaseConfig();
    anonClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return anonClient;
}

/** Service role — admin invite/create user only. Server-side only. */
export function getSupabaseServiceRole(): SupabaseClient {
  if (!serviceClient) {
    const url = ENV.supabaseUrl.trim();
    const key = ENV.supabaseServiceRoleKey.trim();
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin auth operations"
      );
    }
    serviceClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return serviceClient;
}
