import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./live-helpers";
import {
  deleteAssetByTagViaUi,
  resolveLiveTestSiteName,
  runLiveBrowserCleanup,
} from "../helpers/liveTestData";
import { readGeneratedAssetCodeFromRegister } from "../helpers/generatedAssetCode";

test.describe.configure({ mode: "serial" });

// Skipped: requires test data creation in production DB
test.describe.skip("assets module (live)", () => {
  /** Set in the test; removed in afterAll so production is not left with E2E assets. */
  let createdAssetTag: string | undefined;
  /** Resolved from live sites list (read-only); used for Site dropdown. */
  let liveSiteName = "";

  test.beforeAll(async () => {
    await runLiveBrowserCleanup(async (page) => {
      await loginAsAdmin(page);
      liveSiteName = await resolveLiveTestSiteName(page);
    });
  });

  test.afterAll(async () => {
    if (!createdAssetTag) return;
    await runLiveBrowserCleanup((page) => deleteAssetByTagViaUi(page, createdAssetTag!));
  });

  test("list, create, view detail, edit asset", async ({ page }) => {
    const name = `E2E Asset ${Date.now()}`;
    const nameEdited = `${name} (edited)`;

    expect(liveSiteName.length, "beforeAll must resolve a site name").toBeGreaterThan(0);

    await loginAsAdmin(page);
    await page.goto("/app/assets");
    await expect(page.getByRole("heading", { name: /Asset Register/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("asset-list-table")).toBeVisible();

    await page.getByTestId("asset-create-btn").click();
    await page.getByLabel(/Item Description \*/i).fill(name);

    await page.getByTestId("asset-form-category").click();
    await page.locator("[role='option']").first().click();

    await page.getByTestId("asset-form-site").click();
    await page.getByRole("option", { name: liveSiteName, exact: true }).click();

    await page.getByTestId("asset-form-submit").click();
    await expect(page.getByText(/Asset created successfully/i)).toBeVisible({
      timeout: 60_000,
    });

    await page.goto("/app/assets");
    const generatedTag = await readGeneratedAssetCodeFromRegister(page, name);
    createdAssetTag = generatedTag;

    await page.getByTestId("asset-search-input").fill(generatedTag);
    await expect(page.getByText(generatedTag)).toBeVisible({ timeout: 30_000 });

    await page.locator("tr").filter({ hasText: generatedTag }).first().click();

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
