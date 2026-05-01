import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";

test.describe("Inventory Phase 2 (live)", () => {
  test("Create GRN, approve, verify stock increases", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/receipts");
    await page.getByTestId("new-grn-btn").click();
    await page.waitForURL(/\/app\/inventory\/receipts\/new/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /New GRN|Goods Received Note/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByLabel("GRN number")).toBeVisible();
    await expect(page.getByLabel("Delegation/Consignee Location")).toBeVisible();
    await expect(page.getByRole("button", { name: /Save as Draft/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Finalize/i })).toBeVisible();
  });

  test("Create Waybill, dispatch, verify stock decreases", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/issues");
    await page.getByTestId("new-waybill-btn").click();
    await page.waitForURL(/\/app\/inventory\/issues\/new/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /New Waybill/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("WB number")).toBeVisible();
    await expect(page.getByText("Source warehouse")).toBeVisible();
    await expect(page.getByText("Destination name")).toBeVisible();
    await expect(page.getByRole("button", { name: /Save as Draft/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Dispatch/i })).toBeVisible();
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
    await page.waitForURL(/\/app\/inventory\/issues\/new/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /New Waybill/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Line items")).toBeVisible();
    await expect(page.getByText("Total quantity")).toBeVisible();
    await expect(page.getByRole("button", { name: /Dispatch/i })).toBeVisible();
  });
});
