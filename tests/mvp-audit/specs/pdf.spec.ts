import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { loginViaPassword } from "../helpers/e2eAuth";
import { shot } from "../helpers/shot";

const REPORT_TYPES = [
  "assetInventory",
  "maintenanceSchedule",
  "workOrders",
  "financial",
  "compliance",
] as const;

const REPORT_LABEL: Record<(typeof REPORT_TYPES)[number], RegExp> = {
  assetInventory: /Asset Inventory/,
  maintenanceSchedule: /Maintenance Schedule/,
  workOrders: /^Work Orders$/,
  financial: /Financial Summary/,
  compliance: /Compliance Audit/,
};

test.describe.configure({ mode: "serial" });

test.describe("PDF reports (2e)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaPassword(page);
  });

  for (const reportType of REPORT_TYPES) {
    test(`generates PDF — ${reportType}`, async ({ page }) => {
      await page.goto("/app/reports");
      await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

      await page.getByTestId("report-type-select").click();
      await page.getByRole("option", { name: REPORT_LABEL[reportType] }).click();

      await page.getByTestId("report-format-select").click();
      await page.getByRole("option", { name: /PDF/i }).click();

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByTestId(`pdf-generate-${reportType}`).click(),
      ]);

      const filePath = await download.path();
      expect(filePath).toBeTruthy();
      const { size } = fs.statSync(filePath!);
      expect(size).toBeGreaterThan(1000);

      const outDir = path.join(process.cwd(), "tests/mvp-audit/screenshots");
      await download.saveAs(path.join(outDir, `report-${reportType}-${Date.now()}.pdf`));
      await shot(page, `pdf-${reportType}-success`);
    });
  }
});
