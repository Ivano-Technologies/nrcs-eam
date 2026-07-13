import { test, expect } from "@playwright/test";

test.describe("Branch scorecards", () => {
  test("manager can open branch scorecards page", async ({ page }) => {
    await page.goto("/app/reports/branch-scorecards");
    await expect(page.getByTestId("branch-scorecards-page")).toBeVisible({ timeout: 15000 });
  });
});
