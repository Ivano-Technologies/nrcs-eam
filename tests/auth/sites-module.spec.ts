/**
 * Live sites tests are read-only (no create-site flow). Destructive site creation tests were removed
 * to avoid polluting production; nothing to skip here.
 */
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./live-helpers";
import { resolveLiveTestSiteName } from "../helpers/liveTestData";

test.describe.configure({ mode: "serial" });

test.describe("sites module (live)", () => {
  test("sites list loads with at least one site", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/sites");
    await expect(page.getByRole("heading", { name: /Sites Management/i })).toBeVisible({
      timeout: 30_000,
    });

    const sitesList = page.getByTestId("sites-list");
    let firstSiteCard = page.locator("[data-testid^='site-card-']").first();
    if ((await sitesList.count()) > 0) {
      await expect(sitesList).toBeVisible({ timeout: 30_000 });
    } else {
      const grid = page.locator("div.space-y-6 > div.grid").first();
      await expect(grid).toBeVisible({ timeout: 30_000 });
      firstSiteCard = grid.locator("> div").first();
    }

    await expect(firstSiteCard).toBeVisible({ timeout: 30_000 });
    await expect(firstSiteCard).toContainText(/.+/);
  });

  test("read-only: resolve a usable site name from existing NRCS sites (no create/delete)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const name = await resolveLiveTestSiteName(page);
    expect(name.trim().length).toBeGreaterThan(0);
    await expect(
      page.locator("[data-testid^='site-card-']").filter({ hasText: name })
    ).toBeVisible({ timeout: 30_000 });
  });
});
