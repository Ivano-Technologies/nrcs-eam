/**
 * Client routes that the SPA shell (index.html) answers with HTTP 200.
 *
 * Every other non API path still gets the same shell, so the client router renders
 * the NotFound page, but with HTTP 404 so crawlers, uptime checks and link checkers
 * see a real not found.
 *
 * Keep in sync with the top level routes in client/src/App.tsx and the rewrites in
 * vercel.json. `server/_core/spaRoutes.test.ts` checks all three agree.
 *
 * Trade off: everything under /app is allowed by prefix. Those routes sit behind auth and
 * the in app router already renders its own NotFound, so listing roughly 100 parameterised
 * app routes here (and in vercel.json) would add a second route table that must change
 * with every new page, and a missed entry would turn a real page into a 404 on reload.
 */
export const PUBLIC_SPA_PATHS = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/legal/terms",
  "/legal/privacy",
] as const;

/** Prefix for the authenticated app shell. Mirrors APP_BASE in client/src/lib/routes.ts. */
export const APP_SPA_PREFIX = "/app";

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

/** True when `pathname` is a client route that should be served with HTTP 200. */
export function isKnownSpaPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  if ((PUBLIC_SPA_PATHS as readonly string[]).includes(path)) return true;
  return path === APP_SPA_PREFIX || path.startsWith(`${APP_SPA_PREFIX}/`);
}

/** Asset detail page in the app shell, e.g. `/app/assets/1015`. */
export function assetDetailPath(assetId: number | string): string {
  return `${APP_SPA_PREFIX}/assets/${assetId}`;
}

/**
 * Old QR labels encoded `/assets/<id>` (asset ids are integers). Those URLs are forwarded with
 * a permanent redirect to `/app/assets/<id>`. Digits only, so Vite's hashed bundle files under
 * `/assets/` (always `name-hash.ext`) can never match. Mirrors the `redirects` entry in vercel.json.
 */
export const LEGACY_ASSET_PATH = /^\/assets\/(\d+)\/?$/;

/** Redirect target for a legacy `/assets/<id>` path, or null when the path is anything else. */
export function legacyAssetRedirectTarget(pathname: string): string | null {
  const match = LEGACY_ASSET_PATH.exec(pathname);
  return match ? assetDetailPath(match[1]!) : null;
}
