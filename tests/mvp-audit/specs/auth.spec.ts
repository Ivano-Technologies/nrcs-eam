import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { testUser } from "../fixtures/testUser";
import { shot } from "../helpers/shot";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");

function seedE2E() {
  try {
    execSync("pnpm run seed-e2e:local", {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch {
    throw new Error(
      "seed-e2e failed. Ensure .env.e2e is configured and MySQL is reachable, then run:\n" +
        "  pnpm run db:seed:e2e\n" +
        "  pnpm run seed-e2e:local",
    );
  }
}

test.describe.configure({ mode: "serial" });

test.describe("Authentication (2a)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        // eslint-disable-next-line no-console
        console.warn("BROWSER ERROR:", msg.text());
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        // eslint-disable-next-line no-console
        console.warn(`HTTP ${response.status()} — ${response.url()}`);
      }
    });

    if (testInfo.title.includes("protected route redirects")) {
      return;
    }

    seedE2E();
    await page.goto(`/auth/verify?token=${testUser.magicToken}`);
    await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
  });

  test("magic-link login redirects to dashboard", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, "auth-login-success");
  });

  test("session persists across reload", async ({ page }) => {
    await page.reload();
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("logout redirects to login", async ({ page }) => {
    await page.getByTestId("user-menu-trigger").click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /sign in to nrcs asset management/i }),
    ).toBeVisible();
    await shot(page, "auth-logout");
  });

  test("protected route redirects when logged out", async ({ page }) => {
    await page.goto("/app/assets");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
