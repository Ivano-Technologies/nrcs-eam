/**
 * Vite public env (set in Vercel **Build** environment for the frontend).
 * Use when adding a browser Supabase client; tRPC auth does not require these at runtime.
 */
export function getViteSupabasePublicConfig(): {
  url: string;
  anonKey: string;
} {
  return {
    url: import.meta.env.VITE_SUPABASE_URL?.trim() ?? "",
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "",
  };
}
