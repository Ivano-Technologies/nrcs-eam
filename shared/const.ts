/** @deprecated Legacy Manus/JWT session; cleared on logout for migration. */
export const COOKIE_NAME = "app_session_id";

/** httpOnly cookies for Supabase sessions (set by tRPC auth mutations). */
export const SUPABASE_ACCESS_TOKEN_COOKIE = "sb-access-token";
export const SUPABASE_REFRESH_TOKEN_COOKIE = "sb-refresh-token";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
