import { test, expect } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";
import {
  attachGuards,
  createGuardState,
  filterBenignConsoleErrors,
  type GuardState,
} from "../helpers/guards";
import { shot } from "../helpers/shot";

const TRACKING_SUB_ROUTES = [
  "/app/inventory/movements",
  "/app/inventory/transfers",
  "/app/inventory/counts",
  "/app/inventory/adjustments",
  "/app/inventory/expiry",
  "/app/inventory/kits",
  "/app/inventory/distributions",
] as const;

test.describe.configure({ mode: "serial" });

test.describe("Inventory deep links — tracking tab + sidebar", () => {
  let guard!: GuardState;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    guard = createGuardState();
    attachGuards(page, guard);
    await loginViaPassword(page);
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

  for (const pathname of TRACKING_SUB_ROUTES) {
    test(`tracking shell + sidebar active for ${pathname}`, async ({ page }) => {
      await page.goto(pathname);
      await expect(page.getByTestId("inventory-shell-tab-tracking")).toHaveAttribute(
        "data-active",
        "true",
        { timeout: 20_000 },
      );
      await expect(page.getByTestId("sidebar-nav-inventory-tracking")).toHaveAttribute(
        "data-active",
        "true",
      );
    });
  }

  test("screenshot — stock overview at 1366px (layout review)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/app/inventory/stock-overview");
    await expect(page.getByTestId("inventory-shell-tab-stock-overview")).toHaveAttribute(
      "data-active",
      "true",
      { timeout: 20_000 },
    );
    await shot(page, "inventory-stock-overview-1366");
  });
});
