import { defineConfig } from "@playwright/test";

/**
 * MVP audit: headed Chrome, base URL from local dev server.
 * Start DB + seed before tests: `pnpm db:seed && pnpm exec tsx scripts/db/seed-e2e.ts`
 * Mailpit (optional): `npx mailpit` then SMTP_HOST=127.0.0.1 SMTP_PORT=1025
 */
export default defineConfig({
  testDir: "./tests/mvp-audit",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: false,
    screenshot: "on",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm run dev:e2e",
    url: "http://127.0.0.1:3000/health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
