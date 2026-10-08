import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";

/**
 * Asset Map regressions (SPEC 7.4). Google doesn't load under navigator.webdriver, so these use
 * `?mapMock=1`, a DOM stub with clickable markers (`asset-map-marker-<code>`).
 */
test.describe("Asset Map (mapMock)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/asset-map?mapMock=1");
    await expect(page.getByRole("heading", { name: /Asset Map/i })).toBeAttached({ timeout: 30_000 });
    const mock = page.getByTestId("asset-map-mock");
    if (!(await mock.isVisible({ timeout: 15_000 }).catch(() => false))) {
      test.skip(true, "Asset Map redesign (mapMock) is not deployed on this host yet");
    }
  });

  test("clicking a marker opens the drawer, adds ?facility= and keeps the zoom", async ({ page }) => {
    const mock = page.getByTestId("asset-map-mock");
    const marker = page.locator("[data-testid^='asset-map-marker-']").first();
    await expect(marker).toBeVisible({ timeout: 15_000 });
    const zoomBefore = await mock.getAttribute("data-zoom");
    const label = (await marker.getAttribute("aria-label")) ?? "";
    await marker.click();
    const drawer = page.getByTestId("asset-map-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { level: 2 })).toHaveText(label.split(",")[0]);
    await expect(page).toHaveURL(/[?&]facility=/);
    expect(await mock.getAttribute("data-zoom")).toBe(zoomBefore);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("a filter with no results shows the empty state and Clear filters", async ({ page }) => {
    const search = page.getByTestId("asset-map-search");
    await search.fill("zzzz no such facility");
    const empty = page.getByTestId("asset-map-empty");
    await expect(empty).toBeVisible();
    await empty.getByRole("button", { name: "Clear filters" }).click();
    await expect(empty).toBeHidden();
    await expect(page.locator("[data-testid^='asset-map-marker-']").first()).toBeVisible();
  });

  test("switching layers keeps the selection and the map", async ({ page }) => {
    const mock = page.getByTestId("asset-map-mock");
    await page.locator("[data-testid^='asset-map-marker-']").first().click();
    for (let i = 0; i < 5; i += 1) {
      await page.getByTestId("asset-map-assets-tab").click();
      await page.getByTestId("asset-map-network-tab").click();
    }
    await expect(page.getByTestId("asset-map-drawer")).toBeVisible();
    await expect(mock).toBeVisible();
  });
});
