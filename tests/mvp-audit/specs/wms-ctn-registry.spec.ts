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

test.describe.configure({ mode: "serial" });

test.describe("WMS CTN registry (Phase 1)", () => {
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

  test("CTN registry page loads and shell tab is active", async ({ page }) => {
    await page.goto("/app/inventory/ctn-registry");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("inventory-shell-tab-ctn-registry")).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Commodity tracking numbers (CTN)" })).toBeVisible();
    await expect(page.getByTestId("ctn-create-open")).toBeVisible();
  });
});
