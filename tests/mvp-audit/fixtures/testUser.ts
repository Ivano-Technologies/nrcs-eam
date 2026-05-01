/** Playwright / MVP audit — synthetic test identity (matches seeded DB user + tests/auth/live-helpers). */
export const testUser = {
  openId: "PLW_E2E_ADMIN_OPENID",
  email: "playwright@nrcseam.techivano.com",
  name: "[TEST] E2E Admin",
  role: "admin" as const,
  /** Legacy `magicToken` fixture removed: E2E auth now uses Supabase session bootstrap. */
};
