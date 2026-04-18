import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";

test.describe("Asset Register (live)", () => {
  test("page title, table, sort, filter, export, add form fields", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/assets");

    await expect(page.getByTestId("asset-register-heading")).toHaveText(/Asset Register/i, {
      timeout: 60_000,
    });
    await expect(page).toHaveTitle(/Asset Register/i, { timeout: 15_000 });

    await expect(page.getByTestId("asset-register-data-table")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("columnheader", { name: /Asset Code/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Item Description/i })).toBeVisible();

    await page.getByRole("columnheader", { name: /Asset Code/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole("columnheader", { name: /Asset Code/i }).click();

    await page.getByTestId("asset-filter-status").click();
    await page.getByRole("option", { name: /In Use/i }).click();

    await expect(page.getByTestId("asset-export-excel-btn")).toBeVisible();

    await page.getByTestId("asset-create-btn").click();
    await expect(page.getByTestId("asset-form-item-type")).toBeVisible();
    await expect(page.getByTestId("asset-form-subcategory")).toBeVisible();
    await expect(page.getByTestId("asset-form-serial")).toBeVisible();
    await expect(page.getByTestId("asset-form-unit-value")).toBeVisible();
    await expect(page.getByTestId("asset-form-depreciated-value")).toBeVisible();
    await expect(page.getByTestId("asset-form-acquisition-method")).toBeVisible();
    await expect(page.getByTestId("asset-form-year")).toBeVisible();
    await expect(page.getByTestId("asset-form-new-used-new")).toBeVisible();
    await expect(page.getByTestId("asset-form-status")).toBeVisible();
    await expect(page.getByTestId("asset-form-assigned")).toBeVisible();
    await expect(page.getByTestId("asset-form-department")).toBeVisible();
    await expect(page.getByTestId("asset-form-condition")).toBeVisible();
    await expect(page.getByTestId("asset-form-remarks")).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
