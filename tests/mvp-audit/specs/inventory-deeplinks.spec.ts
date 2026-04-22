import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "../helpers/e2eAuth";
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
    execSync("pnpm run seed-e2e:local", {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch {
    throw new Error(
      "seed-e2e failed. Ensure .env.e2e is configured and PostgreSQL is reachable, then run:\n" +
        "  pnpm run db:seed:e2e\n" +
        "  pnpm run seed-e2e:local",
    );
  }
}

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
    seedE2E();
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
