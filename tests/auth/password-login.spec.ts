import { test, expect } from "@playwright/test";

/**
 * Live production smoke: password login → /app dashboard.
 * Requires a valid user with password set in production DB.
 */
test.describe("password login (nrcseam.techivano.com)", () => {
  test("signs in and shows app shell", async ({ page }) => {
    await page.goto("https://nrcseam.techivano.com/login");

    await expect(page.getByText("No procedure found")).toHaveCount(0);

    await page.getByTestId("login-email-input").fill("ivanonigeria@gmail.com");
    await page.getByTestId("login-password-input").fill("ChangeMe123!");
    await page.getByTestId("login-password-submit").click();

    await expect(page).toHaveURL(/\/app/, { timeout: 60_000 });
    await expect(page.getByTestId("sidebar-nav-dashboard")).toBeVisible({
      timeout: 60_000,
    });
  });
});
