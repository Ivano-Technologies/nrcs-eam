/** Normalize VITE_API_BASE_URL (trim, no trailing slash). Empty when unset. */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

/** tRPC batch endpoint — same-origin relative path when API base is not set. */
export function getTrpcUrl(): string {
  const base = getApiBaseUrl();
  return base ? `${base}/api/trpc` : "/api/trpc";
}

/**
 * OAuth redirect_uri must hit the Express server. When the SPA is on another host
 * (S3/CloudFront), set VITE_API_BASE_URL so this points at App Runner.
 */
export function getOAuthCallbackUrl(): string {
  const base = getApiBaseUrl();
  if (base) {
    return `${base}/api/oauth/callback`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/oauth/callback`;
  }
  return "/api/oauth/callback";
}
