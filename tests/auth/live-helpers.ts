import { expect, type Page } from "@playwright/test";

export const LIVE_ADMIN_EMAIL =
  process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "ivanonigeria@gmail.com";
export const LIVE_ADMIN_PASSWORD =
  process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "@Localhost001";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await expect(page.getByTestId("login-email-input")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("login-email-input").fill(LIVE_ADMIN_EMAIL);
  await page.getByTestId("login-password-input").fill(LIVE_ADMIN_PASSWORD);
  await page.getByTestId("login-password-submit").click();
  await expect(page).toHaveURL(/\/app/, { timeout: 90_000 });
}
