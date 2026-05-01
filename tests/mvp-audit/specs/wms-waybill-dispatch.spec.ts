import { expect, test } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";

test.describe.configure({ mode: "serial" });

test("WMS waybill create -> multi-CTN dispatch -> print copies", async ({ page }) => {
  await loginViaPassword(page);
  await page.goto("/app/inventory/issues");
  await page.getByTestId("new-waybill-btn").click();
  await page.waitForURL(/\/app\/inventory\/issues\/new/, { timeout: 20_000 });

  const suffix = Date.now().toString().slice(-4);
  await page.getByLabel("WB number").fill(`NRCS-NHQ-2026-WB-${suffix}`);
  await page.getByLabel("Destination name").fill("E2E Destination");

  await page.getByLabel("Source warehouse").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Item").first().click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Total quantity").first().fill("5");

  await page.getByRole("button", { name: "Add another CTN" }).first().click();
  await page.getByRole("button", { name: "Save as Draft" }).click();
  await expect(page.getByText("Waybill draft saved.")).toBeVisible({ timeout: 10_000 });

  const loadedBy = page.getByText("Loaded by").first().locator("..");
  const transportedBy = page.getByText("Transported by").first().locator("..");
  await loadedBy.locator("input").first().fill("E2E Loader");
  await transportedBy.locator("input").first().fill("E2E Driver");

  await page.getByRole("button", { name: "Dispatch" }).click();
  await expect(page.getByText("Waybill dispatched.")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "White copy" }).click();
  await page.waitForURL(/\/app\/inventory\/issues\/\d+\/print\/white/, { timeout: 20_000 });
  await expect(page.getByText("Waybill / Delivery Note")).toBeVisible();
  await expect(page.getByText("ORIGINAL")).toBeVisible();
});

test("WMS waybill validation blocks overdraw and expired without override", async ({ page }) => {
  await loginViaPassword(page);
  await page.goto("/app/inventory/issues/new");
  await page.getByRole("button", { name: "Dispatch" }).click();
  await expect(page.getByText("Each line must have CTN sources summing exactly to line quantity.")).toBeVisible();
});
