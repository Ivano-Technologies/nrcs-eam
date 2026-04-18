import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./live-helpers";

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
});
