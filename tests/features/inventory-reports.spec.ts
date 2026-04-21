import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";

async function ensurePhase5Ui(page: any) {
  const title = page.getByText("Reports & Analytics");
  if ((await title.count()) === 0) {
    test.skip(true, "Phase 5 reports UI is not deployed on live-auth yet.");
  }
}

test.describe("Inventory reports (live)", () => {
  test("all report categories load", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/reports");
    await ensurePhase5Ui(page);
    await expect(page.getByText("Reports & Analytics")).toBeVisible();

    for (const category of ["stock", "movement", "expiry", "distribution"]) {
      const categoryNode = page.getByTestId(`report-category-${category}`);
      await expect(categoryNode).toBeVisible();
      await categoryNode.getByRole("button").first().click();
    }
  });

  test("filters and chart render", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/reports");
    await ensurePhase5Ui(page);
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
    await page.goto("/app/reports");
    await ensurePhase5Ui(page);
    await expect(page.getByTestId("report-download-pdf-btn")).toBeVisible();
    await expect(page.getByTestId("report-download-excel-btn")).toBeVisible();
    await expect(page.getByTestId("report-download-csv-btn")).toBeVisible();
  });

  test("smart insights widget shows data", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app");
    if ((await page.getByTestId("smart-insights-widget").count()) === 0) {
      test.skip(true, "Phase 5 smart insights widget is not deployed on live-auth yet.");
    }
    await expect(page.getByTestId("smart-insights-widget")).toBeVisible();
    await expect(page.getByText("Inventory Intelligence")).toBeVisible();
  });
});
