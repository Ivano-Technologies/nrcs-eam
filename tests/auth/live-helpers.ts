import { expect, type Page } from "@playwright/test";

export const E2E_USER_EMAIL =
  process.env.E2E_USER_EMAIL ??
  process.env.PLAYWRIGHT_ADMIN_EMAIL ??
  "playwright@nrcseam.techivano.com";
export const E2E_USER_PASSWORD =
  process.env.E2E_USER_PASSWORD ?? process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "PlaywrightTest@2026";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  const emailInput = page.getByTestId("login-email-input");
  if ((await emailInput.count()) > 0) {
    await expect(emailInput).toBeVisible({
      timeout: 30_000,
    });
    await emailInput.fill(E2E_USER_EMAIL);
    await page.getByTestId("login-password-input").fill(E2E_USER_PASSWORD);
    await page.getByTestId("login-password-submit").click();
  }
  await expect(page).toHaveURL(/\/app/, { timeout: 90_000 });
}
