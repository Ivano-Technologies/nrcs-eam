import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./live-helpers";

/**
 * KPI value: `data-testid` when present; else derive from layout (KPI row is `following-sibling` of the dashboard title row)
 * and a strict numeric `getByText` so we never depend on Tailwind class strings on production.
 */
function metricValueLocator(page: import("@playwright/test").Page, title: string | RegExp, valueTestId: string) {
  const pattern = typeof title === "string" ? new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : title;
  const byTestId = page.getByTestId(valueTestId);
  const kpiGrid = page
    .getByRole("heading", { name: /^Dashboard$/i })
    .locator("xpath=ancestor::div[2]/following-sibling::div[1]");
  const card = kpiGrid.locator(":scope > div").filter({ hasText: pattern });
  const numeric =
    pattern.source.includes("Beneficiaries") || pattern.source.includes("beneficiaries")
      ? card.getByText(/^\d[\d,]*$/)
      : card.getByText(/^\d+$/);
  return byTestId.or(numeric.first()).first();
}

test.describe("dashboard (live)", () => {
  test("admin sees KPI cards with numeric values", async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({
      timeout: 30_000,
    });

    const beneficiaries = metricValueLocator(page, /Beneficiaries Reached/, "dashboard-kpi-value-beneficiaries");
    const pending = metricValueLocator(page, /Pending Approvals/, "dashboard-kpi-value-approvals");

    await expect(beneficiaries).toBeVisible({ timeout: 30_000 });
    await expect(beneficiaries).toHaveText(/[\d,]+/);

    await expect(pending).toBeVisible({ timeout: 15_000 });
    await expect(pending).toHaveText(/\d+/);

    const totalById = page.getByTestId("dashboard-metric-total-assets-value");
    if (await totalById.count()) {
      await expect(totalById).toHaveText(/\d+/);
    }
  });
});
