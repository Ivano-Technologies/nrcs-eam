/**
 * Vite public env (set in Vercel **Build** environment for the frontend).
 * Use when adding a browser Supabase client; tRPC auth does not require these at runtime.
 */
export function getViteSupabasePublicConfig(): {
  url: string;
  publishableKey: string;
} {
  return {
    url: import.meta.env.VITE_SUPABASE_URL?.trim() ?? "",
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "",
  };
}
