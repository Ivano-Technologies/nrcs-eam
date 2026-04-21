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

    await page.getByTestId("inventory-tab-catalogue").click();
    await expect(page.getByRole("button", { name: /Import from IFRC Catalogue/i })).toBeVisible();

    const rows = page.locator('[data-testid^="catalogue-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 60_000 });
    await expect(rows).toHaveCount(await rows.count());
    expect(await rows.count()).toBeGreaterThanOrEqual(40);

    const categoryFilter = page.getByRole("combobox").nth(0);
    await categoryFilter.click();
    await page.getByRole("option", { name: "Food" }).click();
    await expect(rows.first()).toBeVisible();
    const firstTen = await rows.allTextContents();
    const subset = firstTen.slice(0, Math.min(firstTen.length, 10));
    for (const line of subset) {
      expect(line).toContain("Food");
    }

    await page.getByTestId("inventory-tab-overview").click();
    await page.getByTestId("view-toggle-table").click();

    const table = page.locator("table").first();
    await expect(table).toBeVisible();
    const stickyHeaders = table.locator("thead th").filter({ hasText: /Item Code|Item Name|Warehouse/ });
    await expect(stickyHeaders).toHaveCount(3);

    const stickyPositions = await stickyHeaders.evaluateAll((els) =>
      els.map((el) => window.getComputedStyle(el).position)
    );
    expect(stickyPositions.every((p) => p === "sticky")).toBeTruthy();

    const scroller = page.locator(".overflow-x-auto").first();
    await scroller.evaluate((el) => {
      (el as HTMLElement).scrollLeft = 800;
    });
    await expect(table.locator("thead th").first()).toBeVisible();
  });
});
