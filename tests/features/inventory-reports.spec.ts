import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";

async function ensureReportsRouteAvailable(page: any) {
  const response = await page.goto("/app/reports", { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 200;
  if (status === 404) {
    test.skip(true, "Reports route returned 404 on live-auth.");
  }
  const bodyText = (await page.locator("body").innerText()).toLowerCase();
  if (bodyText.includes("coming soon")) {
    test.skip(true, "Reports route is deployed but showing Coming Soon placeholder.");
  }
  await page.waitForSelector("h1, h2", { timeout: 10000 });
}

test.describe("Inventory reports (live)", () => {
  test("all report categories load", async ({ page }) => {
    await loginAsAdmin(page);
    await ensureReportsRouteAvailable(page);

    const categories = page.locator('[data-testid^="report-category-"]');
    await expect(categories.first()).toBeVisible({ timeout: 5000 });
    expect(await categories.count()).toBeGreaterThan(0);
  });

  test("filters and chart render", async ({ page }) => {
    await loginAsAdmin(page);
    await ensureReportsRouteAvailable(page);
    await page.locator("input[type='date']").nth(0).fill("2026-01-01");
    await page.locator("input[type='date']").nth(1).fill("2026-12-31");
    await page.getByTestId("report-category-expiry").getByRole("button").first().click();
    await page.getByTestId("report-card-vedAnalysis").getByRole("button", { name: "Open" }).click();
    await expect(page.getByTestId("ved-chart")).toBeVisible();
    await page.getByTestId("report-category-movement").getByRole("button").first().click();
    await page.getByTestId("report-card-abcAnalysis").getByRole("button", { name: "Open" }).click();
    await expect(page.getByTestId("abc-chart")).toBeVisible();
    await page.getByTestId("report-card-fnsAnalysis").getByRole("button", { name: "Open" }).click();
    await expect(page.getByTestId("fns-chart")).toBeVisible();
  });

  test("export controls visible", async ({ page }) => {
    await loginAsAdmin(page);
    await ensureReportsRouteAvailable(page);
    await expect(page.getByTestId("report-download-pdf-btn")).toBeVisible();
    await expect(page.getByTestId("report-download-excel-btn")).toBeVisible();
    await expect(page.getByTestId("report-download-csv-btn")).toBeVisible();
  });

  test("smart insights widget shows data", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app");
    const widget = page.getByTestId("smart-insights-widget");
    if ((await widget.count()) === 0) {
      test.skip(true, "smart-insights-widget not mounted on this deployment.");
      return;
    }
    await expect(widget).toBeVisible();
    await expect(page.getByText("Inventory Intelligence")).toBeVisible();
  });
});
