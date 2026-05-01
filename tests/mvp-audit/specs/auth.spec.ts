import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "../helpers/e2eAuth";
import { shot } from "../helpers/shot";

test.describe.configure({ mode: "serial" });

test.describe("Authentication (2a)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        // eslint-disable-next-line no-console
        console.warn("BROWSER ERROR:", msg.text());
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        // eslint-disable-next-line no-console
        console.warn(`HTTP ${response.status()} — ${response.url()}`);
      }
    });

    if (testInfo.title.includes("protected route redirects")) {
      return;
    }

    await loginViaMagicLink(page);
  });

  test("session-auth login reaches dashboard", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, "auth-login-success");
  });

  test("session persists across reload", async ({ page }) => {
    await page.reload();
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("logout redirects to login", async ({ page }) => {
    await page.getByTestId("user-menu-trigger").click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /log in to nrcs eam/i }),
    ).toBeVisible();
    await shot(page, "auth-logout");
  });

  test("protected route redirects when logged out", async ({ page }) => {
    await page.goto("/app/assets");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
