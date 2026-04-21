import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Default RDS CA bundle for local `dev:e2e` when `.env.e2e` enables strict DB TLS but omits the path. */
const DEFAULT_DATABASE_SSL_CA = path.join(__dirname, "certs", "global-bundle.pem");

const LIVE_AUTH_BASE = "https://nrcseam.techivano.com";

/** Skip local dev server when running live auth specs (see projects below). */
const runLiveAuthOnly =
  process.env.PLAYWRIGHT_LIVE_AUTH === "1" ||
  process.argv.some(
    (arg) =>
      arg.includes("tests/auth") ||
      arg.includes("password-login") ||
      arg.includes("live-auth")
  );

/**
 * - `live-auth`: production login smoke (`tests/auth/`) — no webServer.
 * - `mvp-audit`: local E2E (`tests/mvp-audit/`) — starts dev server when not in live-auth-only mode.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: "live-auth",
      testMatch: ["**/auth/**/*.spec.ts", "**/features/**/*.spec.ts"],
      use: {
        baseURL: LIVE_AUTH_BASE,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
      },
    },
    {
      name: "mvp-audit",
      testMatch: "**/mvp-audit/**/*.spec.ts",
      use: {
        baseURL: "http://127.0.0.1:3000",
        headless: false,
        screenshot: "on",
        trace: "retain-on-failure",
      },
    },
  ],
  webServer: runLiveAuthOnly
    ? undefined
    : {
        command: "pnpm run dev:e2e",
        url: "http://127.0.0.1:3000/health",
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          ...(process.env.DATABASE_SSL_CA_PATH?.trim()
            ? {}
            : { DATABASE_SSL_CA_PATH: DEFAULT_DATABASE_SSL_CA }),
        },
      },
});
