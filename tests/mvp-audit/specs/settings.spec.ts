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
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 20_000 });
    await shot(page, "settings-dashboard-before");

    const toggle = page.getByTestId("settings-widget-kpiCards");
    const before = await toggle.getAttribute("aria-checked");
    const waitSave = () =>
      page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          r.url().includes("updateDashboardWidgets") &&
          r.ok(),
        { timeout: 30_000 },
      );
    await toggle.click();
    await waitSave();
    await page.waitForTimeout(200);
    const mid = await toggle.getAttribute("aria-checked");
    expect(mid, `widget toggle should flip (before=${before})`).not.toBe(before);
    await toggle.click();
    await waitSave();
    await page.waitForTimeout(200);
    const restored = await toggle.getAttribute("aria-checked");
    expect(restored).toBe(before);
    await shot(page, "settings-dashboard-after");
  });

  test("notification preference toggle", async ({ page }) => {
    await page.goto("/app/notification-preferences");
    await expect(page.getByRole("heading", { name: "Notification Preferences" })).toBeVisible({
      timeout: 20_000,
    });
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
