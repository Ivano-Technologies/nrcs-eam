import { test, expect } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";
import { shot } from "../helpers/shot";

/**
 * Reports UI uses client-side CSV (blob + programmatic anchor click), which does not always
 * emit Playwright's `download` event. We assert the report opens, data renders, and export controls work.
 */
const REPORT_CASES = [
  { accordionName: "Stock Reports", reportId: "stockStatus", slug: "stock-status" },
  { accordionName: "Movement Reports", reportId: "stockMovement", slug: "stock-movement" },
  { accordionName: "Expiry Reports", reportId: "vedAnalysis", slug: "ved-analysis" },
] as const;

test.describe.configure({ mode: "serial" });

test.describe("Reports export (2e)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaPassword(page);
  });

  for (const { accordionName, reportId, slug } of REPORT_CASES) {
    test(`reports table and CSV control — ${slug}`, async ({ page }) => {
      await page.goto("/app/reports");
      await expect(page.getByRole("heading", { name: /Reports & Analytics/i })).toBeVisible();

      await page.getByRole("button", { name: accordionName }).click();
      await page.getByTestId(`report-card-${reportId}`).getByRole("button", { name: "Open" }).click();

      await expect(page.getByText("Chart + table view for selected report")).toBeVisible({
        timeout: 60_000,
      });

      await expect(page.getByTestId("report-download-csv-btn")).toBeEnabled();
      await page.getByTestId("report-download-csv-btn").click();
      await shot(page, `report-${slug}-csv-success`);
    });
  }
});
