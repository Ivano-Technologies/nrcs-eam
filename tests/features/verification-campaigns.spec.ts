import { test, expect } from "@playwright/test";

test.describe("Verification campaigns", () => {
  test("manager can open verification campaigns page", async ({ page }) => {
    // Requires authenticated manager session in E2E env
    await page.goto("/app/administration/verification-campaigns");
    await expect(page.getByTestId("verification-campaigns-page")).toBeVisible({ timeout: 15000 });
  });
});
