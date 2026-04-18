import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./live-helpers";

test.describe("assets module (live)", () => {
  test("list, create, view detail, edit asset", async ({ page }) => {
    const tag = `E2E-A-${Date.now()}`;
    const name = `E2E Asset ${Date.now()}`;
    const nameEdited = `${name} (edited)`;

    await loginAsAdmin(page);
    await page.goto("/app/assets");
    await expect(page.getByRole("heading", { name: /^Assets$/ })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("asset-list-table")).toBeVisible();

    await page.getByTestId("asset-create-btn").click();
    await page.getByLabel(/Asset Tag \*/i).fill(tag);
    await page.getByLabel(/Asset Name \*/i).fill(name);

    await page.getByTestId("asset-form-category").click();
    await page.locator("[role='option']").first().click();

    await page.getByTestId("asset-form-site").click();
    await page.locator("[role='option']").first().click();

    await page.getByTestId("asset-form-submit").click();
    await expect(page.getByText(/Asset created successfully/i)).toBeVisible({
      timeout: 60_000,
    });

    await page.getByTestId("asset-search-input").fill(tag);
    await expect(page.getByText(tag)).toBeVisible({ timeout: 30_000 });

    await page
      .locator('a[href*="/app/assets/"]')
      .filter({ hasText: tag })
      .first()
      .click();

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
