import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { SIDEBAR_NAV_ADMIN } from "../fixtures/sidebarNav";
import { testUser } from "../fixtures/testUser";
import {
  attachGuards,
  createGuardState,
  filterBenignConsoleErrors,
  type GuardState,
} from "../helpers/guards";
import { shot } from "../helpers/shot";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");

function seedE2E() {
  try {
    execSync("pnpm exec tsx scripts/db/seed-e2e.ts", {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch {
    throw new Error(
      "seed-e2e failed. Ensure MySQL is reachable (DATABASE_URL in .env), then run:\n" +
        "  pnpm db:seed\n" +
        "  pnpm exec tsx scripts/db/seed-e2e.ts",
    );
  }
}

test.describe.configure({ mode: "serial" });

test.describe("Dashboard (2b)", () => {
  let guard!: GuardState;

  /**
   * Fresh magic-link token + login each test: Playwright uses an isolated browser
   * context per test, and tokens are single-use.
   */
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    guard = createGuardState();
    attachGuards(page, guard);
    seedE2E();
    await page.goto(`/auth/verify?token=${testUser.magicToken}`);
    await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 20_000,
    });
  });

  test.afterEach(() => {
    const bad = filterBenignConsoleErrors(guard.consoleErrors);
    expect(
      bad,
      `Unexpected console.error: ${JSON.stringify(bad)}`,
    ).toEqual([]);
    expect(
      guard.http4xx5xx,
      `HTTP 4xx/5xx: ${JSON.stringify(guard.http4xx5xx)}`,
    ).toEqual([]);
  });

  test("login and reach dashboard", async ({ page }) => {
    await shot(page, "dashboard-landing");
  });

  test("no console.error after reload", async ({ page }) => {
    guard.consoleErrors.length = 0;
    guard.http4xx5xx.length = 0;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 20_000,
    });
    const bad = filterBenignConsoleErrors(guard.consoleErrors);
    expect(bad, JSON.stringify(bad)).toEqual([]);
    expect(guard.http4xx5xx).toEqual([]);
    await shot(page, "dashboard-no-errors");
  });

  test("sidebar nav links navigate without error boundary", async ({ page }) => {
    const search = page.locator('input[placeholder="Search menu..."]');
    if (await search.isVisible()) {
      await search.fill("");
    }

    for (const item of SIDEBAR_NAV_ADMIN) {
      await page.getByTestId(item.testId).click();
      const pathname = new URL(page.url()).pathname;
      if (item.path === "/app") {
        expect(pathname).toBe("/app");
      } else {
        expect(
          pathname.startsWith(item.path),
          `${pathname} vs ${item.path}`,
        ).toBe(true);
      }
      await expect(
        page.getByText("An unexpected error occurred."),
      ).toHaveCount(0);
      const main = page.locator("main");
      await expect(main).toBeVisible();
      const text = await main.innerText();
      expect(text.length).toBeGreaterThan(20);
      await shot(page, `dashboard-nav-${item.shotSlug}`);
    }
  });

  test("dashboard widgets render without bad placeholders", async ({ page }) => {
    await page.getByTestId("sidebar-nav-dashboard").click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 20_000,
    });

    const cards = page.locator('[data-slot="card"]');
    const n = await cards.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const card = cards.nth(i);
      await expect(card).toBeVisible();
      const t = await card.innerText();
      expect(t).not.toMatch(/\bundefined\b/i);
      expect(t).not.toMatch(/\bNaN\b/);
      expect(t).not.toMatch(/\bnull\b/);
    }
    await shot(page, "dashboard-widgets");
  });

  test("reload dashboard — no failed HTTP responses", async ({ page }) => {
    guard.consoleErrors.length = 0;
    guard.http4xx5xx.length = 0;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 20_000,
    });
    expect(guard.http4xx5xx, JSON.stringify(guard.http4xx5xx)).toEqual([]);
  });
});
