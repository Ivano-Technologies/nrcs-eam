import { test, expect } from "@playwright/test";
import { SIDEBAR_NAV_ADMIN } from "../fixtures/sidebarNav";
import { loginViaMagicLink } from "../helpers/e2eAuth";
import {
  attachGuards,
  createGuardState,
  filterBenignConsoleErrors,
  type GuardState,
} from "../helpers/guards";
import { shot } from "../helpers/shot";

test.describe.configure({ mode: "serial" });

test.describe("Dashboard (2b)", () => {
  let guard!: GuardState;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    guard = createGuardState();
    attachGuards(page, guard);
    await loginViaMagicLink(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 20_000,
    });
  });

  test.afterEach(() => {
    expect(
      guard.http4xx5xx,
      `HTTP 4xx/5xx: ${JSON.stringify(guard.http4xx5xx)}`,
    ).toEqual([]);
    const bad = filterBenignConsoleErrors(guard.consoleErrors);
    expect(
      bad,
      `Unexpected console.error: ${JSON.stringify(bad)}`,
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
      // Direct navigation: items live inside collapsible groups in the sidebar, so `goto` avoids expand-order flakiness.
      await page.goto(item.path);
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
      const main = page.getByTestId("app-page-main");
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
