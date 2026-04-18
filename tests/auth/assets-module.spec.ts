import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./live-helpers";
import {
  deleteAssetByTagViaUi,
  ensureTestSite,
  LIVE_E2E_SHARED_SITE_NAME,
  runLiveBrowserCleanup,
} from "../helpers/liveTestData";

test.describe.configure({ mode: "serial" });

test.describe("assets module (live)", () => {
  /** Set in the test; removed in afterAll so production is not left with E2E assets. */
  let createdAssetTag: string | undefined;

  test.beforeAll(async () => {
    await runLiveBrowserCleanup(async (page) => {
      await loginAsAdmin(page);
      await ensureTestSite(page, LIVE_E2E_SHARED_SITE_NAME);
    });
  });

  test.afterAll(async () => {
    if (!createdAssetTag) return;
    await runLiveBrowserCleanup((page) => deleteAssetByTagViaUi(page, createdAssetTag!));
  });

  test("list, create, view detail, edit asset", async ({ page }) => {
    const tag = `E2E-A-${Date.now()}`;
    createdAssetTag = tag;
    const name = `E2E Asset ${Date.now()}`;
    const nameEdited = `${name} (edited)`;

    await loginAsAdmin(page);
    await page.goto("/app/assets");
    await expect(page.getByRole("heading", { name: /Asset Register/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("asset-list-table")).toBeVisible();

    await page.getByTestId("asset-create-btn").click();
    await page.getByLabel(/Asset Code/i).fill(tag);
    await page.getByLabel(/Item Description \*/i).fill(name);

    await page.getByTestId("asset-form-category").click();
    await page.locator("[role='option']").first().click();

    await page.getByTestId("asset-form-site").click();
    await page.getByRole("option", { name: LIVE_E2E_SHARED_SITE_NAME }).click();

    await page.getByTestId("asset-form-submit").click();
    await expect(page.getByText(/Asset created successfully/i)).toBeVisible({
      timeout: 60_000,
    });

    await page.getByTestId("asset-search-input").fill(tag);
    await expect(page.getByText(tag)).toBeVisible({ timeout: 30_000 });

    await page.locator("tr").filter({ hasText: tag }).first().click();

    await expect(page).toHaveURL(/\/app\/assets\/\d+/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: name })
    ).toBeVisible({ timeout: 30_000 });

    const editBtn = page.getByTestId("asset-detail-edit-btn");
    if (await editBtn.count() === 0) {
      await page.getByRole("button", { name: /Edit Asset/i }).click();
    } else {
      await editBtn.click();
    }
    await page.locator("#edit-name").fill(nameEdited);
    const saveBtn = page.getByTestId("asset-detail-save-btn");
    if ((await saveBtn.count()) > 0) {
      await saveBtn.click();
    } else {
      await page
        .getByRole("dialog", { name: /Edit Asset/i })
        .getByRole("button", { name: /Update Asset/i })
        .click();
    }
    await expect(page.getByText(/Asset updated successfully/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { level: 1, name: nameEdited })).toBeVisible();
  });
});
