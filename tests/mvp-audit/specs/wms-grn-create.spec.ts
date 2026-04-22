import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { testUser } from "../fixtures/testUser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");

function seedE2E() {
  execSync("pnpm run seed-e2e:local", {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
    encoding: "utf-8",
  });
}

test.describe.configure({ mode: "serial" });

test("WMS GRN create -> draft -> finalize -> print", async ({ page }) => {
  seedE2E();
  await page.goto(`/auth/verify?token=${testUser.magicToken}`);
  await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });

  await page.goto("/app/inventory/receipts");
  await page.getByTestId("new-grn-btn").click();
  await page.waitForURL(/\/app\/inventory\/receipts\/new/, { timeout: 20_000 });

  const suffix = Date.now().toString().slice(-4);
  await page.getByLabel("GRN number").fill(`NRCS-NHQ-2026-${suffix}`);
  await page.getByLabel("Received from").fill("E2E Donor");
  await page.getByLabel("Date of arrival").fill("2026-04-21");

  await page.getByRole("button", { name: "Select facility" }).click();
  await page.getByRole("option").first().click();

  await page.getByRole("button", { name: "+ Create new CTN" }).first().click();
  await page.getByLabel("CTN code").fill(`E2E-CTN-${suffix}`);
  await page.getByRole("button", { name: "Select donor" }).click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Select item" }).click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Original quantity").fill("10");
  await page.getByRole("button", { name: "Save CTN" }).click();

  await page.getByLabel("Number of units").first().fill("5");
  await page.getByRole("button", { name: "Save as Draft" }).click();
  await expect(page.getByText("GRN draft")).toBeVisible({ timeout: 10_000 });

  await page.goto("/app/inventory/receipts");
  await expect(page.getByText(`NRCS-NHQ-2026-${suffix}`)).toBeVisible({ timeout: 15_000 });
  await page.getByText(`NRCS-NHQ-2026-${suffix}`).click();

  await page.getByLabel("Name").first().fill("Delivered User");
  await page.getByLabel("Name").nth(1).fill("Received User");
  await page.getByRole("button", { name: "Finalize" }).click();
  await expect(page.getByText("GRN finalized.")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "White copy" }).click();
  await page.waitForURL(/\/app\/inventory\/receipts\/\d+\/print\/white/, { timeout: 20_000 });
  await expect(page.getByText("Goods Received Note (GRN)")).toBeVisible();
  await expect(page.getByText("ORIGINAL")).toBeVisible();
  await expect(page.getByText("Inventory")).not.toBeVisible();
});

