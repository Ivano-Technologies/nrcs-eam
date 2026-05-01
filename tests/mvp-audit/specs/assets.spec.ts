import { test, expect } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";
import { shot } from "../helpers/shot";
import { deleteAssetByTagViaUi, runLiveBrowserCleanup } from "../../helpers/liveTestData";
import { readGeneratedAssetCodeFromRegister } from "../../helpers/generatedAssetCode";

test.describe.configure({ mode: "serial" });

test.describe("Assets CRUD (2c)", () => {
  /** Set after create; removed in afterAll if the test does not delete the row. */
  let createdAssetTag: string | undefined;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaPassword(page);
  });

  test.afterAll(async () => {
    if (!createdAssetTag) return;
    await runLiveBrowserCleanup((page) => deleteAssetByTagViaUi(page, createdAssetTag!));
  });

  test("full asset lifecycle", async ({ page }) => {
    const name = `E2E Asset ${Date.now()}`;
    const nameEdited = `${name} (edited)`;

    await page.goto("/app/assets");
    await expect(page.getByRole("heading", { name: "Asset Register" })).toBeVisible();

    const createDialog = page.getByRole("dialog", { name: "Add New Asset" });
    await page.getByTestId("asset-create-btn").click();
    await expect(createDialog).toBeVisible({ timeout: 15_000 });
    await createDialog.getByTestId("asset-form-description").fill(name);
    await createDialog.getByTestId("asset-form-category").click();
    // Must be a category with an NRCS two-letter code (see `nrcs_item_category_code` / ITEM_CATEGORY_CODE_MAP).
    await page
      .getByRole("option")
      .filter({
        hasText:
          /Computer|Furniture & Fixtures|Generator|Land|Land & Building|Medical Equipment|Office Equipment|Vehicle/,
      })
      .first()
      .click();
    await createDialog.getByTestId("asset-form-site").click();
    await page.getByRole("option").first().click();

    const createRespPromise = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("assets.create"),
      { timeout: 60_000 },
    );
    await createDialog.getByTestId("asset-form-submit").click();
    const createResp = await createRespPromise;
    const createBody = await createResp.text();
    if (!createResp.ok()) {
      throw new Error(`assets.create failed: ${createResp.status()} ${createBody.slice(0, 12000)}`);
    }
    await shot(page, "asset-create-success");

    await page.goto("/app/assets");
    await expect(page.getByTestId("asset-list-table")).toContainText(name);
    // Server assigns NRCS_* code after save (dialog closes; authoritative value is on the register).
    const generatedTag = await readGeneratedAssetCodeFromRegister(page, name);
    createdAssetTag = generatedTag;
    await shot(page, "asset-list");

    await page.getByTestId("asset-search-input").fill(generatedTag);
    await page.getByTestId("asset-edit-btn").first().click();
    await page
      .getByRole("dialog", { name: "Edit Asset" })
      .getByRole("textbox")
      .nth(1)
      .fill(nameEdited);
    await page.getByRole("dialog", { name: "Edit Asset" }).getByTestId("asset-form-submit").click();
    await expect(page.getByText("Asset updated successfully").first()).toBeVisible({ timeout: 60_000 });
    await page.goto("/app/assets");
    await page.getByTestId("asset-search-input").fill(generatedTag);
    await expect(page.getByTestId("asset-list-table")).toContainText(nameEdited);
    await shot(page, "asset-edit-success");

    await page.getByTestId("asset-delete-btn").first().click();
    await page.getByTestId("asset-delete-confirm").click();
    await expect(page.getByText(/Asset deleted/i).first()).toBeVisible({ timeout: 60_000 });
    await page.goto("/app/assets");
    await expect(page.getByTestId("asset-list-table")).not.toContainText(nameEdited);
    await shot(page, "asset-delete-success");

    createdAssetTag = undefined;
    await page.getByTestId("asset-search-input").fill("");
    await shot(page, "asset-search-result");
  });
});
