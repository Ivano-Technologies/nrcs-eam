/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Same project URL as server `SUPABASE_URL` — baked at build for optional client-side use. */
  readonly VITE_SUPABASE_URL?: string;
  /** Same value as server `SUPABASE_PUBLISHABLE_KEY` (public) — baked at build. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_ANALYTICS_ENDPOINT?: string;
  readonly VITE_ANALYTICS_WEBSITE_ID?: string;
  readonly VITE_APP_ID?: string;
  readonly VITE_OAUTH_PORTAL_URL?: string;
  /** Google Maps JavaScript API browser key. Keep it HTTP referrer restricted. */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /**
   * Google Maps Map ID (JavaScript, vector) with a light and a dark cloud style attached.
   * Falls back to Google's unstyled `DEMO_MAP_ID` when unset.
   */
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
