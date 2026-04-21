/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Same project URL as server `SUPABASE_URL` — baked at build for optional client-side use. */
  readonly VITE_SUPABASE_URL?: string;
  /** Same value as server `SUPABASE_ANON_KEY` (public) — baked at build. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ANALYTICS_ENDPOINT?: string;
  readonly VITE_ANALYTICS_WEBSITE_ID?: string;
  readonly VITE_APP_ID?: string;
  readonly VITE_OAUTH_PORTAL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
