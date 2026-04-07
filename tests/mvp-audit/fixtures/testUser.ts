/** Playwright / MVP audit — synthetic test identity (matches seeded DB user). */
export const testUser = {
  openId: "e2e-playwright-openid",
  email: "nrcs.eam.qa@gmail.com",
  name: "E2E Admin",
  role: "admin" as const,
  /** Magic-link token (64 chars) — must match DB row */
  magicToken:
    "e2e000000000000000000000000000000000000000000000000000000000000",
};
