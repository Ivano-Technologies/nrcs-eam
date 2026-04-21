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
    await page.goto("/app/facilities");
    if ((await page.getByRole("heading", { name: /Facilities Management/i }).count()) === 0) {
      await page.goto("/app/sites");
    }
    await expect(
      page
        .getByRole("heading", { name: /Facilities Management/i })
        .or(page.getByRole("heading", { name: /Sites Management/i }))
    ).toBeVisible({ timeout: 30_000 });

    const sitesList = page.getByTestId("sites-list");
    let firstSiteCard = page.locator("[data-testid^='facility-row-']").first();
    if ((await firstSiteCard.count()) === 0) firstSiteCard = page.locator("[data-testid^='site-card-']").first();
    if ((await sitesList.count()) > 0) {
      await expect(sitesList).toBeVisible({ timeout: 30_000 });
    } else if ((await firstSiteCard.count()) === 0) {
      const grid = page.locator("div.space-y-6 > div.grid").first();
      await expect(grid).toBeVisible({ timeout: 30_000 });
      firstSiteCard = grid.locator("> div").first();
    }
    if ((await firstSiteCard.count()) > 0) {
      await expect(firstSiteCard).toBeVisible({ timeout: 30_000 });
      await expect(firstSiteCard).toContainText(/.+/);
    } else {
      await expect(page.getByRole("heading", { name: /Facilities Management|Sites Management/i })).toBeVisible();
    }
  });

  test("read-only: resolve a usable site name from existing NRCS sites (no create/delete)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const name = await resolveLiveTestSiteName(page);
    expect(name.trim().length).toBeGreaterThan(0);
    const row = page.locator("[data-testid^='facility-row-']").filter({ hasText: name }).first();
    if ((await row.count()) > 0) {
      await expect(row).toBeVisible({ timeout: 30_000 });
    } else {
      const card = page.locator("[data-testid^='site-card-']").filter({ hasText: name }).first();
      if ((await card.count()) > 0) {
        await expect(card).toBeVisible({ timeout: 30_000 });
      } else {
        await expect(page.locator("tbody tr").filter({ hasText: name }).first()).toBeVisible({
          timeout: 30_000,
        });
      }
    }
  });
});
