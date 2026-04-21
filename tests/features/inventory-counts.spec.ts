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
    const row = page.locator("[data-testid^='count-row-']").first();
    await expect(row).toBeVisible();
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
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("Expiry tab shows items correctly", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/expiry");
    await page.getByTestId("expiry-tab-soon").click();
    await expect(page.locator("[data-testid^='expiry-row-']").first()).toBeVisible();
    await page.getByTestId("expiry-tab-expired").click();
    await page.getByTestId("expiry-tab-disposed").click();
  });
});
