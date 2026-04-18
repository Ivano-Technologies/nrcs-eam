import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./live-helpers";
import {
  cancelWorkOrderByNumberViaUi,
  resolveLiveTestSiteName,
  runLiveBrowserCleanup,
} from "../helpers/liveTestData";

test.describe.configure({ mode: "serial" });

// Skipped: requires test data creation in production DB
test.describe.skip("work orders module (live)", () => {
  /** Work orders have no delete API; we cancel in afterAll to avoid leaving active E2E rows. */
  let createdWorkOrderNumber: string | undefined;
  /** First available site name from live sites (read-only). */
  let liveSiteName = "";

  test.beforeAll(async () => {
    await runLiveBrowserCleanup(async (page) => {
      await loginAsAdmin(page);
      liveSiteName = await resolveLiveTestSiteName(page);
    });
  });

  test.afterAll(async () => {
    if (!createdWorkOrderNumber) return;
    await runLiveBrowserCleanup((page) =>
      cancelWorkOrderByNumberViaUi(page, createdWorkOrderNumber!)
    );
  });

  test("list loads, create work order, update status on detail", async ({ page }) => {
    const woNum = `WO-E2E-${Date.now()}`;
    createdWorkOrderNumber = woNum;
    const title = `E2E Work Order ${Date.now()}`;

    expect(liveSiteName.length, "beforeAll must resolve a site name").toBeGreaterThan(0);

    await loginAsAdmin(page);
    await page.goto("/app/work-orders");
    await expect(page.getByRole("heading", { name: /^Work Orders$/ })).toBeVisible({
      timeout: 30_000,
    });

    const createBtn = page.getByTestId("work-order-create-btn");
    if ((await createBtn.count()) > 0) {
      await createBtn.click();
    } else {
      await page.getByRole("button", { name: /Create Work Order/i }).first().click();
    }

    const createDialog = page.getByRole("dialog", { name: /Create New Work Order/i });
    await expect(createDialog).toBeVisible({ timeout: 15_000 });

    await createDialog.getByLabel(/Work Order Number \*/i).fill(woNum);
    await createDialog.getByLabel(/^Title \*$/i).fill(title);

    const assetTrigger = createDialog.getByTestId("work-order-form-asset");
    if ((await assetTrigger.count()) > 0) {
      await assetTrigger.click();
    } else {
      await createDialog.getByRole("combobox").nth(0).click();
    }
    await page.locator("[role='option']").first().click();

    const siteTrigger = createDialog.getByTestId("work-order-form-site");
    if ((await siteTrigger.count()) > 0) {
      await siteTrigger.click();
    } else {
      await createDialog.getByRole("combobox").nth(1).click();
    }
    await page.getByRole("option", { name: liveSiteName, exact: true }).click();

    const submitBtn = createDialog.getByTestId("work-order-form-submit");
    if ((await submitBtn.count()) > 0) {
      await submitBtn.click();
    } else {
      await createDialog.getByRole("button", { name: /^Create Work Order$/ }).click();
    }

    await expect(page.getByText(/Work order created successfully/i)).toBeVisible({
      timeout: 60_000,
    });

    const list = page.getByTestId("work-order-list");
    if ((await list.count()) > 0) {
      await expect(list).toBeVisible();
    }
    await expect(page.getByText(woNum)).toBeVisible({ timeout: 30_000 });

    await page
      .locator('a[href*="/app/work-orders/"]')
      .filter({ hasText: woNum })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/work-orders\/\d+/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 30_000,
    });

    const editBtn = page.getByTestId("work-order-edit-btn");
    if ((await editBtn.count()) > 0) {
      await editBtn.click();
    } else {
      await page.getByRole("button", { name: /^Edit$/ }).click();
    }

    const updateDialog = page.getByRole("dialog", { name: /Update Work Order/i });
    await expect(updateDialog).toBeVisible({ timeout: 15_000 });

    const statusSelect = updateDialog.getByTestId("work-order-status-select");
    if ((await statusSelect.count()) > 0) {
      await statusSelect.click();
    } else {
      await updateDialog.getByRole("combobox").first().click();
    }
    await page.getByRole("option", { name: /^In Progress$/i }).click();

    const updateWoBtn = updateDialog.getByTestId("work-order-update-btn");
    if ((await updateWoBtn.count()) > 0) {
      await updateWoBtn.click();
    } else {
      await updateDialog.getByRole("button", { name: /^Update$/ }).click();
    }

    await expect(page.getByText(/Work order updated/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("in_progress").first()).toBeVisible();
  });
});
