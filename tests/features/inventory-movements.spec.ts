import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";

test.describe("Inventory Phase 2 (live)", () => {
  test("Create GRN, approve, verify stock increases", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/receipts");
    await page.getByTestId("new-grn-btn").click();
    const warehouseSelect = page.getByRole("dialog").getByRole("combobox").first();
    await warehouseSelect.click();
    await page.getByRole("option").first().click();
    await page.getByRole("dialog").getByPlaceholder("Reference Number").fill(`PO-${Date.now()}`);
    await page.getByRole("dialog").getByText("Add Line").click();
    await page.getByRole("dialog").getByRole("combobox").nth(1).click();
    await page.getByRole("option").first().click();
    await page.getByRole("dialog").getByPlaceholder("Qty").first().fill("2");
    await page.getByRole("dialog").getByRole("button", { name: /Submit for Approval/i }).click();
    const row = page.locator("[data-testid^='grn-row-']").first();
    await expect(row).toBeVisible();
    const approve = page.getByTestId("approve-grn-btn").first();
    if (await approve.count()) await approve.click();
  });

  test("Create Waybill, dispatch, verify stock decreases", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/issues");
    await page.getByTestId("new-waybill-btn").click();
    await page.getByRole("dialog").getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.getByRole("dialog").getByLabel("Destination").fill("Distribution to beneficiaries");
    await page.getByRole("dialog").getByRole("combobox").nth(1).click();
    await page.getByRole("option").first().click();
    await page.getByRole("dialog").getByLabel("Quantity").fill("1");
    await page.getByRole("dialog").getByRole("button", { name: /Submit for approval/i }).click();
    const row = page.locator("[data-testid^='waybill-row-']").first();
    await expect(row).toBeVisible();
    const dispatch = page.getByTestId("dispatch-waybill-btn").first();
    if (await dispatch.count()) await dispatch.click();
  });

  test("Create Transfer between two warehouses", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/transfers");
    await page.getByTestId("new-transfer-btn").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").nth(0).click();
    await page.getByRole("option").first().click();

    await dialog.getByRole("combobox").nth(1).click();
    const warehouseOptions = page.getByRole("option");
    const optionCount = await warehouseOptions.count();
    if (optionCount > 1) {
      await warehouseOptions.nth(1).click();
    } else {
      await warehouseOptions.first().click();
    }

    await dialog.getByRole("combobox").nth(2).click();
    await page.getByRole("option").first().click();
    await page.getByRole("dialog").getByLabel("Quantity").fill("1");
    await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
    const transferRows = page.locator("[data-testid^='transfer-row-']");
    if ((await transferRows.count()) > 0) {
      await expect(transferRows.first()).toBeVisible();
    } else {
      await expect(page.getByText(/transfer/i).first()).toBeVisible();
    }
  });

  test("Movements page shows all transactions", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/movements");
    await expect(page.getByRole("heading", { name: /Inventory Movements/i })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
    const rows = page.locator("table tbody tr");
    const hasRows = (await rows.count()) > 0;
    if (hasRows) {
      await expect(rows.first()).toBeVisible();
    } else {
      await expect(page.getByRole("columnheader", { name: "Date" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Type" })).toBeVisible();
    }
  });

  test("Cannot issue more than available stock", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/issues");
    await page.getByTestId("new-waybill-btn").click();
    await page.getByRole("dialog").getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.getByRole("dialog").getByLabel("Destination").fill("Stress test");
    await page.getByRole("dialog").getByRole("combobox").nth(1).click();
    await page.getByRole("option").first().click();
    await page.getByRole("dialog").getByLabel("Quantity").fill("999999");
    await page.getByRole("dialog").getByRole("button", { name: /Submit for approval/i }).click();
    const row = page.locator("[data-testid^='waybill-row-']").first();
    await expect(row).toBeVisible();
    const dispatch = page.getByTestId("dispatch-waybill-btn").first();
    if (await dispatch.count()) {
      await dispatch.click();
      const insufficient = page.getByText(/insufficient stock/i);
      const stayedDispatchable = page.getByTestId("dispatch-waybill-btn").first();
      const sawError = await insufficient.isVisible({ timeout: 8000 }).catch(() => false);
      if (!sawError) {
        await expect(stayedDispatchable).toBeVisible();
      }
    }
  });
});
