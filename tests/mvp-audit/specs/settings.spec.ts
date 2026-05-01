import { test, expect } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";
import { shot } from "../helpers/shot";

test.describe.configure({ mode: "serial" });

test.describe("Settings (2g)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaPassword(page);
  });

  test("dashboard widget toggle persists", async ({ page }) => {
    await page.goto("/app/dashboard-settings");
    await expect(page.getByRole("heading", { name: "Dashboard Settings" })).toBeVisible();
    await shot(page, "settings-dashboard-before");

    const toggle = page.getByTestId("settings-widget-totalAssets");
    const before = await toggle.getAttribute("aria-checked");
    await toggle.click();
    await page.waitForTimeout(800);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Dashboard Settings" })).toBeVisible();
    const after = await page.getByTestId("settings-widget-totalAssets").getAttribute("aria-checked");
    expect(after).not.toBe(before);
    await shot(page, "settings-dashboard-after");
  });

  test("notification preference toggle", async ({ page }) => {
    await page.goto("/app/notification-preferences");
    await expect(page.getByRole("heading", { name: "Notification Preferences" })).toBeVisible();
    await shot(page, "settings-notifications-before");

    const sw = page.getByTestId("settings-notify-maintenanceDue");
    const before = await sw.getAttribute("aria-checked");
    await sw.click();
    await expect(page.getByTestId("toast-success")).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Notification Preferences" })).toBeVisible();
    const after = await page.getByTestId("settings-notify-maintenanceDue").getAttribute("aria-checked");
    expect(after).not.toBe(before);
    await shot(page, "settings-notifications-after");
  });
});
