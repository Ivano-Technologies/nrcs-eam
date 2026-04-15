export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** SPA login (Supabase Auth). */
export const getLoginUrl = (): string => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/login`;
  }
  return "/login";
};
