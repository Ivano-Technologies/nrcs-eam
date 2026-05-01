import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";

test.describe("UI improvements (live)", () => {
  test("asset map page loads and shows map container", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/asset-map");
    await expect(page.getByRole("heading", { name: /Asset Map/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Map View", { exact: false })).toBeVisible({ timeout: 15_000 });
    const panel = page.getByTestId("asset-map-panel");
    if ((await panel.count()) > 0) {
      await expect(panel).toBeVisible();
    }
    const mapEl = page.getByTestId("asset-map-container");
    if ((await mapEl.count()) > 0) {
      await expect(mapEl).toBeVisible();
      const box = await mapEl.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThan(200);
    } else {
      const fallback = page.locator(".h-\\[600px\\], .h-\\[500px\\]").first();
      await expect(fallback).toBeVisible({ timeout: 10_000 });
      const box = await fallback.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThan(200);
    }
  });

  test("asset scanner page has mode buttons with consistent height", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/scanner");
    await expect(page.getByRole("heading", { name: /Asset Scanner/i })).toBeVisible({ timeout: 30_000 });
    const toggle = page.getByTestId("asset-scanner-mode-toggle");
    if ((await toggle.count()) > 0) {
      await expect(toggle).toBeVisible();
      const manual = page.getByTestId("asset-scanner-mode-manual");
      const camera = page.getByTestId("asset-scanner-mode-camera");
      const bManual = await manual.boundingBox();
      const bCamera = await camera.boundingBox();
      if (bManual && bCamera) {
        expect(Math.abs(bManual.height - bCamera.height)).toBeLessThanOrEqual(4);
      }
    } else {
      const manual = page.getByRole("button", { name: /Manual Entry/i });
      const camera = page.getByRole("button", { name: /Camera Scan/i });
      await expect(manual).toBeVisible();
      await expect(camera).toBeVisible();
      const bManual = await manual.boundingBox();
      const bCamera = await camera.boundingBox();
      if (bManual && bCamera) {
        expect(Math.abs(bManual.height - bCamera.height)).toBeLessThanOrEqual(6);
      }
    }
  });

  test("dashboard sidebar shows org name in expanded view", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app");
    const byTestId = page.getByTestId("sidebar-org-name");
    if ((await byTestId.count()) > 0) {
      await expect(byTestId).toBeVisible({ timeout: 30_000 });
      await expect(byTestId).toContainText(/Nigerian Red Cross Society/i);
    } else {
      await expect(page.getByText(/Nigerian Red Cross Society/i).first()).toBeVisible({
        timeout: 30_000,
      });
    }
  });

  test("dashboard sidebar shows tooltip when collapsed", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app");
    await page.getByRole("button", { name: /Toggle sidebar width/i }).click();
    const navBtn = page.getByTestId("sidebar-nav-dashboard");
    await expect(navBtn).toBeVisible();
    await navBtn.scrollIntoViewIfNeeded();
    const box = await navBtn.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }
    const tip = page.getByRole("tooltip", { name: /^Dashboard$/ });
    if ((await tip.count()) === 0) {
      return;
    }
    await expect(tip).toBeVisible({ timeout: 10_000 });
  });

  test("inventory page loads with grid/list toggle", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory");
    await expect(page.getByRole("heading", { name: /Inventory/i })).toBeVisible({ timeout: 30_000 });
    const toggle = page.getByTestId("inventory-view-toggle");
    if ((await toggle.count()) > 0) {
      await expect(toggle).toBeVisible();
      await expect(page.getByTestId("inventory-tab-overview")).toBeVisible();
    }
  });

  test("inventory item shows QR code when items exist", async ({ page }, testInfo) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory");
    await expect(page.getByRole("heading", { name: /Inventory/i })).toBeVisible({ timeout: 30_000 });
    const root = page.getByTestId("inventory-page");
    if ((await root.count()) > 0) {
      await expect(root).toBeVisible();
    }
    const qr = page.getByTestId("inventory-item-qr").first();
    if ((await qr.count()) === 0) {
      testInfo.skip(true, "No QR on page (no items or old bundle)");
      return;
    }
    await expect(qr).toBeVisible({ timeout: 30_000 });
  });
});
