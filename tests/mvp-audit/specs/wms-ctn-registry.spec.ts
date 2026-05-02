import { test, expect } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";
import {
  attachGuards,
  createGuardState,
  filterBenignConsoleErrors,
  type GuardState,
} from "../helpers/guards";

test.describe.configure({ mode: "serial" });

test.describe("WMS CTN registry (Phase 1)", () => {
  let guard!: GuardState;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    guard = createGuardState();
    attachGuards(page, guard);
    await loginViaPassword(page);
    await page.keyboard.press("Escape");
    await page.goto("/app/inventory/ctn-registry");
    await page.waitForURL(/\/app\/inventory\/ctn-registry/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("ctn-create-open")).toBeVisible({ timeout: 20_000 });
    // Ignore bootstrap noise and guard the stabilized page state only.
    guard.consoleErrors = [];
    guard.http4xx5xx = [];
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

  test("CTN registry page loads and shell tab is active", async ({ page }) => {
    const tab = page.getByTestId("inventory-shell-tab-ctn-registry");
    await expect(tab).toBeVisible({ timeout: 20_000 });
    // InventoryShell derives active tab from wouter location; wait until URL-driven state commits.
    await expect(tab).toHaveAttribute("data-active", "true", { timeout: 25_000 });
    await expect(page.getByRole("heading", { name: "Commodity tracking numbers (CTN)" })).toBeVisible();
  });
});
