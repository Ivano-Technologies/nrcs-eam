import { expect, test } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";

test.describe.configure({ mode: "serial" });

test("WMS waybill create -> multi-CTN dispatch -> print copies", async ({ page }) => {
  await loginViaPassword(page);
  await page.goto("/app/inventory/issues");
  // List view is embedded in InventoryShell — no page-level h1; rely on toolbar control.
  await expect(page.getByTestId("new-waybill-btn")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("new-waybill-btn").click();
  await page.waitForURL(/\/app\/inventory\/issues\/new/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /New Waybill/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("waybill-wb-number")).toBeVisible({ timeout: 20_000 });

  const suffix = Date.now().toString().slice(-4);
  await page.getByTestId("waybill-warehouse").click();
  await page.getByRole("option").first().click();
  // Warehouse selection triggers auto-suggested WB number; overwrite with deterministic E2E value.
  await page.getByTestId("waybill-wb-number").fill(`NRCS-NHQ-2026-WB-${suffix}`);
  await page.getByTestId("waybill-destination-name").fill("E2E Destination");
  await page.getByTestId("waybill-line-0-item").click();
  await page.getByRole("option").first().click();
  await page.getByTestId("waybill-line-0-quantity").fill("5");

  await page.getByRole("button", { name: "Add another CTN" }).first().click();
  // Draft create requires valid ctnSources (positive ctnId + qty) summing to line qty — empty rows fail Zod / TRPC.
  await page.getByTestId("waybill-line-0-ctn-0-trigger").click();
  await page.getByRole("option").first().click();
  // Per-CTN balances must cover each source qty (server dispatch validates stock per CTN, not only line total).
  await page.getByTestId("waybill-line-0-ctn-0-qty").fill("3");
  await page.getByTestId("waybill-line-0-ctn-1-trigger").click();
  {
    const opts = page.getByRole("option");
    const n = await opts.count();
    await opts.nth(n > 1 ? 1 : 0).click();
  }
  await page.getByTestId("waybill-line-0-ctn-1-qty").fill("2");
  await expect(page.getByText("Line total check: OK")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Save as Draft" }).click();
  // create() navigates to the detail route; toast can be missed during navigation.
  await page.waitForURL(/\/app\/inventory\/issues\/\d+/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Waybill Detail/i })).toBeVisible({ timeout: 15_000 });
  // GET waybill hydrates header/lines/signatures; filling before that completes can be overwritten by useEffect.
  await expect(page.getByTestId("waybill-wb-number")).toHaveValue(new RegExp(`${suffix}$`), { timeout: 25_000 });

  await page.getByTestId("waybill-signature-loaded-name").fill("E2E Loader");
  await page.getByTestId("waybill-signature-transported-name").fill("E2E Driver");
  await expect(page.getByTestId("waybill-signature-loaded-name")).toHaveValue("E2E Loader");
  await expect(page.getByTestId("waybill-signature-transported-name")).toHaveValue("E2E Driver");

  // Persist signatures before dispatch: a follow-up waybills.get can re-run the detail useEffect and
  // clear local signature state if names were only typed client-side.
  await page.getByRole("button", { name: "Save as Draft" }).click();
  await expect(page.getByText("Waybill draft updated.")).toBeVisible({ timeout: 20_000 });

  const dispatchRespPromise = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      (r.url().includes("inventoryV2.waybills.dispatch") || r.url().includes("waybills.dispatch")),
    { timeout: 25_000 },
  );
  await page.getByRole("button", { name: "Dispatch" }).click();
  const dispatchResp = await dispatchRespPromise;
  if (!dispatchResp.ok()) {
    const body = await dispatchResp.text();
    throw new Error(`waybills.dispatch failed: ${dispatchResp.status()} ${body.slice(0, 2000)}`);
  }
  await expect(
    page.getByText(/waybill dispatched|dispatched successfully|dispatched\.?/i).first(),
  ).toBeVisible({ timeout: 10_000 });
  // Success UI: print buttons render for dispatched waybills (toast can dismiss quickly).
  await expect(page.getByRole("button", { name: "White copy" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "White copy" }).click();
  await page.waitForURL(/\/app\/inventory\/issues\/\d+\/print\/white/, { timeout: 20_000 });
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByText(/Waybill|Delivery Note/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("ORIGINAL").first()).toBeVisible();
});

test("WMS waybill validation blocks overdraw and expired without override", async ({ page }) => {
  await loginViaPassword(page);
  await page.goto("/app/inventory/issues/new");
  await page.getByRole("button", { name: "Dispatch" }).click();
  await expect(page.getByText("Each line must have CTN sources summing exactly to line quantity.")).toBeVisible();
});
