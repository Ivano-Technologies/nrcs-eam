import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";

test.describe("Inventory V2 (live)", () => {
  test("overview, catalogue, filters, and freeze table behavior", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory");

    await expect(page.getByTestId("inventory-tab-overview")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByPlaceholder("Search item code/name")).toBeVisible();
    await expect(page.getByTestId("view-toggle-card")).toBeVisible();
    await expect(page.getByTestId("view-toggle-table")).toBeVisible();

    // Settings tab houses catalogue admin actions post inventory
    // restructure (was on Catalogue tab before commit 1b7325f)
    await page.getByTestId("inventory-tab-settings").click();
    await expect(page.getByRole("button", { name: /Import IFRC Catalogue/i })).toBeVisible();
    await page.getByTestId("inventory-tab-catalogue").click();

    const rows = page.locator('[data-testid^="catalogue-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 60_000 });
    const baselineCount = await rows.count();
    expect(baselineCount).toBeGreaterThanOrEqual(40);

    const catalogueToolbar = page
      .locator("div.rounded-md.border.p-3")
      .filter({ has: page.getByPlaceholder("Search code/name") });
    const categoryTrigger = page.getByTestId("catalogue-category-filter").or(catalogueToolbar.getByRole("combobox").first());
    await categoryTrigger.click();
    const filterOptions = page.getByRole("option");
    const optionCount = await filterOptions.count();
    expect(optionCount).toBeGreaterThan(1);
    await filterOptions.nth(1).click();
    await expect
      .poll(async () => await rows.count(), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
    await expect(rows).toHaveCount(await rows.count());
    expect(await rows.count()).toBeLessThanOrEqual(baselineCount);
    await expect(rows.first()).toBeVisible();

    await page.getByTestId("inventory-tab-overview").click();
    await page.getByTestId("view-toggle-table").click();

    const scroller = page.locator(".frozen-table-wrap").first();
    await expect(scroller).toBeVisible();
    const table = scroller.locator("table").first();
    await expect(table).toBeVisible();
    const pos1 = await table.locator("thead th").nth(0).evaluate((el) => window.getComputedStyle(el).position);
    const pos2 = await table.locator("thead th").nth(1).evaluate((el) => window.getComputedStyle(el).position);
    const pos3 = await table.locator("thead th").nth(2).evaluate((el) => window.getComputedStyle(el).position);
    expect(pos1).toBe("sticky");
    expect(pos2).toBe("sticky");
    expect(pos3).toBe("sticky");

    await scroller.evaluate((el) => {
      (el as HTMLElement).scrollLeft = 800;
    });
    await expect(table.locator("thead th").first()).toBeVisible();
  });
});
