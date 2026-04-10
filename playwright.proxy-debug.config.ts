import { defineConfig } from "@playwright/test";

/** Production proxy audit — no local webServer (hits nrcseam.techivano.com). */
export default defineConfig({
  testDir: "./tests/mvp-audit/specs",
  testMatch: "proxy-debug.spec.ts",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "https://nrcseam.techivano.com",
    headless: true,
  },
});
