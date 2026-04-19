import { test, expect } from "@playwright/test";

/**
 * Live production smoke: password login → /app dashboard.
 * Requires Supabase Auth: app `users` row with matching `auth_user_id` and password set in Supabase (or via admin).
 */
test.describe("password login (nrcseam.techivano.com)", () => {
  test("signs in and shows app shell", async ({ page }) => {
    await page.goto("https://nrcseam.techivano.com/login");

    await expect(page.getByText("No procedure found")).toHaveCount(0);

    await page.getByTestId("login-email-input").fill("ivanonigeria@gmail.com");
    await page.getByTestId("login-password-input").fill("@Localhost001");
    await page.getByTestId("login-password-submit").click();

    await expect(page).toHaveURL(/\/app/, { timeout: 60_000 });
    await expect(page.getByTestId("sidebar-nav-dashboard")).toBeVisible({
      timeout: 60_000,
    });
  });
});
