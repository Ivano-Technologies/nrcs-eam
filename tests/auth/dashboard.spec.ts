import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./live-helpers";

function metricValueLocator(page: import("@playwright/test").Page, title: string) {
  return page
    .locator("div")
    .filter({ has: page.getByText(title, { exact: true }) })
    .locator(".text-2xl.font-bold")
    .first();
}

test.describe("dashboard (live)", () => {
  test("admin sees Total Assets and Pending Work Orders with numeric values", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({
      timeout: 30_000,
    });

    const totalByText = metricValueLocator(page, "Total Assets");
    const pendingByText = metricValueLocator(page, "Pending Work Orders");

    await expect(totalByText).toBeVisible({ timeout: 30_000 });
    await expect(totalByText).toHaveText(/\d+/);

    await expect(pendingByText).toBeVisible({ timeout: 15_000 });
    await expect(pendingByText).toHaveText(/\d+/);

    const totalById = page.getByTestId("dashboard-metric-total-assets-value");
    if (await totalById.count()) {
      await expect(totalById).toHaveText(/\d+/);
    }
  });
});
