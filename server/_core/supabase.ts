import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./env";

let publishableClient: SupabaseClient | null = null;
let secretClient: SupabaseClient | null = null;

function requireSupabaseConfig(): { url: string; publishableKey: string } {
  const url = ENV.supabaseUrl.trim();
  const publishableKey = ENV.supabasePublishableKey.trim();
  if (!url || !publishableKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set for Supabase Auth"
    );
  }
  return { url, publishableKey };
}

/** Publishable key — sign-in, getUser(accessToken), refreshSession. Never expose the secret key to the browser. */
export function getSupabasePublishableServer(): SupabaseClient {
  if (!publishableClient) {
    const { url, publishableKey } = requireSupabaseConfig();
    publishableClient = createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return publishableClient;
}

/** Secret key — admin invite/create user only. Server-side only. */
export function getSupabaseSecret(): SupabaseClient {
  if (!secretClient) {
    const url = ENV.supabaseUrl.trim();
    const key = ENV.supabaseSecretKey.trim();
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SECRET_KEY must be set for admin auth operations"
      );
    }
    secretClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return secretClient;
}
