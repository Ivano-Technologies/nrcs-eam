/** Prefix for all authenticated app routes (sidebar, dashboard). */
export const APP_BASE = "/app";

/** Build full path under the app shell, e.g. `/app`, `/app/assets`. */
export function appPath(subPath: string): string {
  if (!subPath || subPath === "/") return APP_BASE;
  const s = subPath.startsWith("/") ? subPath : `/${subPath}`;
  return `${APP_BASE}${s}`;
}

/** Matches `/app` and `/app/...` (for wouter Route). */
export const APP_ROUTE_PATTERN = /^\/app(\/.*)?$/;
