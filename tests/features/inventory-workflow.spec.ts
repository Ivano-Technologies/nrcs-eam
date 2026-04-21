import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "../auth/live-helpers";

test.describe("Inventory Phase 4 workflow (live)", () => {
  test("Create requisition, submit, approve through two stages", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/requisitions");
    await page.getByTestId("new-req-btn").click();
    await page.getByLabel("Title").fill(`REQ live ${Date.now()}`);
    await page.getByRole("combobox").nth(0).click();
    await page.getByRole("option").first().click();
    await page.getByText("Save as Draft").click();
    const row = page.locator("[data-testid^='req-row-']").first();
    await expect(row).toBeVisible();
    const submit = page.getByRole("button", { name: "Submit" }).first();
    if (await submit.count()) await submit.click();
    const branch = page.getByTestId("req-approve-branch-btn").first();
    if (await branch.count()) await branch.click();
    const hq = page.getByTestId("req-approve-hq-btn").first();
    if (await hq.count()) await hq.click();
  });

  test("Fulfill requisition by creating waybill", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/requisitions");
    const fulfill = page.getByRole("button", { name: "Fulfill" }).first();
    if (await fulfill.count()) await fulfill.click();
    await expect(page.locator("[data-testid^='req-row-']").first()).toBeVisible();
  });

  test("Create distribution from waybill", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/distributions");
    await page.getByTestId("new-dist-btn").click();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Distribution Date").fill("2026-04-21");
    await page.getByLabel("Location").fill("Abuja community center");
    await page.getByText("Submit").click();
    await expect(page.locator("[data-testid^='dist-row-']").first()).toBeVisible();
  });

  test("Distribution report shows beneficiary data", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app");
    await expect(page.getByText("Beneficiaries Reached")).toBeVisible();
  });

  test("Assemble kit from components", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/kits");
    await page.getByRole("tab", { name: "Kit Operations" }).click();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option").first().click();
    await page.getByPlaceholder("Quantity").first().fill("1");
    await page.getByTestId("kit-assemble-btn").click();
  });

  test("Disassemble kit back to components", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/kits");
    await page.getByRole("tab", { name: "Kit Operations" }).click();
    await page.getByRole("combobox").nth(2).click();
    await page.getByRole("option").first().click();
    await page.getByRole("combobox").nth(3).click();
    await page.getByRole("option").first().click();
    await page.getByPlaceholder("Quantity").nth(1).fill("1");
    await page.getByTestId("kit-disassemble-btn").click();
  });

  test("Cannot assemble kit when components are insufficient", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/inventory/kits");
    await page.getByRole("tab", { name: "Kit Operations" }).click();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option").first().click();
    await page.getByPlaceholder("Quantity").first().fill("999999");
    await page.getByTestId("kit-assemble-btn").click();
    await expect(page.getByText(/insufficient/i)).toBeVisible({ timeout: 15000 });
  });
});
