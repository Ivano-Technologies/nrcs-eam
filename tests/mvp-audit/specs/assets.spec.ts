import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "../helpers/e2eAuth";
import { shot } from "../helpers/shot";
import { deleteAssetByTagViaUi, runLiveBrowserCleanup } from "../../helpers/liveTestData";

test.describe.configure({ mode: "serial" });

test.describe("Assets CRUD (2c)", () => {
  /** If the test fails after create, afterAll still removes the asset (same admin session as live helpers). */
  let createdAssetTag: string | undefined;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaMagicLink(page);
  });

  test.afterAll(async () => {
    if (!createdAssetTag) return;
    await runLiveBrowserCleanup((page) => deleteAssetByTagViaUi(page, createdAssetTag!));
  });

  test("full asset lifecycle", async ({ page }) => {
    const tag = `E2E-A-${Date.now()}`;
    createdAssetTag = tag;
    const name = `E2E Asset ${tag}`;
    const nameEdited = `${name} (edited)`;

    await page.goto("/app/assets");
    await expect(page.getByRole("heading", { name: "Asset Register" })).toBeVisible();

    await page.getByTestId("asset-create-btn").click();
    await page.locator("#assetTag").fill(tag);
    await page.locator("#name").fill(name);
    await page.getByTestId("asset-form-category").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("asset-form-site").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("asset-form-submit").click();
    await expect(page.getByTestId("toast-success")).toBeVisible();
    await shot(page, "asset-create-success");

    await page.goto("/app/assets");
    await expect(page.getByTestId("asset-list-table")).toContainText(name);
    await shot(page, "asset-list");

    await page.getByTestId("asset-search-input").fill(tag);
    await page.getByTestId("asset-edit-btn").first().click();
    await page.locator("#edit-name").fill(nameEdited);
    await page.getByTestId("asset-form-submit").click();
    await expect(page.getByTestId("toast-success")).toBeVisible();
    await page.goto("/app/assets");
    await page.getByTestId("asset-search-input").fill(tag);
    await expect(page.getByTestId("asset-list-table")).toContainText(nameEdited);
    await shot(page, "asset-edit-success");

    await page.getByTestId("asset-delete-btn").first().click();
    await page.getByTestId("asset-delete-confirm").click();
    await expect(page.getByTestId("toast-success")).toBeVisible();
    await page.goto("/app/assets");
    await expect(page.getByTestId("asset-list-table")).not.toContainText(nameEdited);
    await shot(page, "asset-delete-success");

    await page.getByTestId("asset-search-input").fill("");
    await shot(page, "asset-search-result");
  });
});
