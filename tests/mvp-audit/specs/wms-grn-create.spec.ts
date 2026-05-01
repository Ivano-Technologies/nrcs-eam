import { expect, test } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";

test.describe.configure({ mode: "serial" });

test("WMS GRN create -> draft -> finalize -> print", async ({ page }) => {
  await loginViaPassword(page);

  await page.goto("/app/inventory/receipts");
  await page.getByTestId("new-grn-btn").click();
  await page.waitForURL(/\/app\/inventory\/receipts\/new/, { timeout: 20_000 });

  const suffix = Date.now().toString().slice(-4);
  await page.getByLabel("GRN number").fill(`NRCS-NHQ-2026-${suffix}`);
  await page.getByLabel("Received from").fill("E2E Donor");
  await page.getByLabel("Date of arrival").fill("2026-04-21");

  await page.getByLabel("Delegation/Consignee Location").click();
  await page.getByRole("option").first().click();

  await page.getByRole("button", { name: "+ Create new CTN" }).first().click();
  await page.getByLabel("CTN code").fill(`E2E-CTN-${suffix}`);
  await page.getByLabel("Donor").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Item").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Original quantity").fill("10");
  await page.getByRole("button", { name: "Save CTN" }).click();

  await page.getByLabel("Number of units").first().fill("5");
  await page.getByRole("button", { name: "Save as Draft" }).click();
  await expect(page.getByText("GRN draft saved.")).toBeVisible({ timeout: 10_000 });

  const deliveredBlock = page.getByText("Delivered by").first().locator("..");
  const receivedBlock = page.getByText("Received by").first().locator("..");
  await deliveredBlock.locator("input").first().fill("Delivered User");
  await receivedBlock.locator("input").first().fill("Received User");
  await page.getByRole("button", { name: "Finalize" }).click();
  await expect(page.getByRole("button", { name: "White copy" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "White copy" }).click();
  await page.waitForURL(/\/app\/inventory\/receipts\/\d+\/print\/white/, { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/GOODS RECEIVED NOTE|Goods Received Note/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("ORIGINAL")).toBeVisible();
  await expect(page.getByText("Inventory")).not.toBeVisible();
});

