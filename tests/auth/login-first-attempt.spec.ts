import { test, expect } from "@playwright/test";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./live-helpers";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("login first attempt (live)", () => {
  test("succeeds on first sign-in without retry", async ({ page }) => {
    const loginResponses: { status: number; body: string }[] = [];

    page.on("response", async (response) => {
      if (!response.url().includes("auth.loginWithPassword")) return;
      let body = "";
      try {
        body = await response.text();
      } catch {
        body = "(could not read body)";
      }
      loginResponses.push({ status: response.status(), body });
    });

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(E2E_USER_EMAIL);
    await page.getByTestId("login-password-input").fill(E2E_USER_PASSWORD);
    await page.getByTestId("login-password-submit").click();

    await expect(page).toHaveURL(/\/app/, { timeout: 90_000 });
    await expect(page.getByTestId("sidebar-nav-dashboard")).toBeVisible({
      timeout: 60_000,
    });

    expect(
      loginResponses.length,
      `expected one loginWithPassword call, got ${loginResponses.length}: ${JSON.stringify(loginResponses)}`
    ).toBe(1);
    expect(loginResponses[0]?.status).toBe(200);
  });
});
