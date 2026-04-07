import { defineConfig } from "@playwright/test";

/**
 * MVP audit: headed Chrome, base URL from local dev server.
 * Local E2E: create `.env.e2e` from `.env.e2e.example`, then
 * `pnpm run db:migrate:e2e && pnpm run db:seed:e2e && pnpm run seed-e2e:local`
 * Mailpit: `pnpm run mailpit` (SMTP 127.0.0.1:1025, UI 127.0.0.1:8025)
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
