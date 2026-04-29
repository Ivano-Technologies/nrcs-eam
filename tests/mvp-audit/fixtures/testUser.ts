/** Playwright / MVP audit — synthetic test identity (matches seeded DB user). */
export const testUser = {
  openId: "e2e-playwright-openid",
  email: "playwright@nrcseam.techivano.com",
  name: "E2E Admin",
  role: "admin" as const,
  /** Legacy `magicToken` fixture removed: E2E auth now uses Supabase session bootstrap. */
};
