import { test, expect } from "@playwright/test";

test.describe("logout (live)", () => {
  test("sign out redirects to login and blocks /app", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByTestId("sidebar-nav-dashboard")).toBeVisible({
      timeout: 60_000,
    });

    await page.getByTestId("user-menu-trigger").click();

    const start = Date.now();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    const elapsed = Date.now() - start;
    console.log(`Logout completed in ${elapsed}ms`);
    await expect(page.getByTestId("login-email-input")).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/app");
    await expect(page.getByTestId("login-email-input")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });
});
