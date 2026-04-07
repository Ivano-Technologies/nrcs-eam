import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "../helpers/e2eAuth";
import { shot } from "../helpers/shot";

test.describe.configure({ mode: "serial" });

test.describe("Error states (2h)", () => {
  test("empty asset create shows validation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaMagicLink(page);
    await page.goto("/app/assets");
    await page.getByTestId("asset-create-btn").click();
    await page.getByTestId("asset-form-submit").click();
    await expect(page.getByTestId("form-error")).toBeVisible();
    await shot(page, "error-empty-form-validation");
  });

  test("unknown route shows 404", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/this-page-does-not-exist");
    await expect(page).toHaveURL(/this-page-does-not-exist/);
    await expect(page.getByText("404")).toBeVisible();
    await shot(page, "error-404");
  });

  test("protected route redirects when logged out", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaMagicLink(page);
    await page.context().clearCookies();
    await page.goto("/app/assets");
    await expect(page).toHaveURL(/\/login/);
    await shot(page, "error-unauth-redirect");
  });
});
