import { getOAuthCallbackUrl } from "@/lib/apiBase";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Magic-link sign-in page when OAuth portal env is not configured. */
function magicLinkLoginPath(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/login`;
  }
  return "/login";
}

// Generate login URL at runtime (OAuth redirect hits API host when VITE_API_BASE_URL is set).
export const getLoginUrl = (): string => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL?.trim();
  const appId = import.meta.env.VITE_APP_ID?.trim();
  if (!oauthPortalUrl || !appId) {
    return magicLinkLoginPath();
  }

  const redirectUri = getOAuthCallbackUrl();
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl.replace(/\/+$/, "")}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
