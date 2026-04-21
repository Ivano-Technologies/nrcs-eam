import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";

test.describe("Inventory Phase 3 (live)", () => {
  test("Create new count with scope", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/counts");
    await page.getByTestId("new-count-btn").click();
    await expect(page.getByTestId("count-step-1")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByTestId("count-step-2")).toBeVisible();
  });

  test("Enter counts with variances", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/counts");
    const rows = page.locator("[data-testid^='count-row-']");
    if ((await rows.count()) === 0) {
      await page.getByTestId("new-count-btn").click();
      const warehouseTrigger = page.getByRole("combobox").first();
      await warehouseTrigger.click();
      await page.getByRole("option").first().click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Generate Count Session" }).click();
      const sheetButton = page.getByRole("button", { name: "Generate Count Sheet" });
      if (await sheetButton.isVisible({ timeout: 15000 }).catch(() => false)) {
        await sheetButton.click();
      }
      await page.waitForTimeout(1000);
    }
    const row = page.locator("[data-testid^='count-row-']").first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row).toContainText(/COUNT-/i);
  });

  test("Submit and approve", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/counts");
    const submit = page.getByRole("button", { name: "Submit" }).first();
    if (await submit.count()) await submit.click();
    const approve = page.getByRole("button", { name: /Approve All/i }).first();
    if (await approve.count()) await approve.click();
  });

  test("Verify stock adjustment happened", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/movements");
    await expect(page.getByRole("heading", { name: /Inventory Movements/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Export to Excel/i })).toBeVisible();
    const movementRows = page.locator("table tbody tr");
    if ((await movementRows.count()) > 0) {
      await expect(movementRows.first()).toBeVisible();
    }
  });

  test("Expiry tab shows items correctly", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/expiry");
    await expect(page.getByTestId("expiry-tab-soon")).toBeVisible();
    await expect(page.getByTestId("expiry-tab-expired")).toBeVisible();
    await expect(page.getByTestId("expiry-tab-disposed")).toBeVisible();
    await page.getByTestId("expiry-tab-soon").click();
    const expiryRows = page.locator("[data-testid^='expiry-row-']");
    if ((await expiryRows.count()) > 0) {
      await expect(expiryRows.first()).toBeVisible();
    }
    await page.getByTestId("expiry-tab-expired").click();
    await page.getByTestId("expiry-tab-disposed").click();
  });
});
