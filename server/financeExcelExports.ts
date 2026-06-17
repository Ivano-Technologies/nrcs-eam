import ExcelJS from "exceljs";
import type { DepreciationScheduleRow, InsuranceListRow } from "./financeModulesDb";

async function toBuffer(workbook: ExcelJS.Workbook, filename: string) {
  const raw = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
  return { buffer, filename };
}

export async function buildDepreciationScheduleWorkbook(rows: DepreciationScheduleRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Depreciation schedule");
  sheet.addRow([
    "Asset code",
    "Asset name",
    "Category",
    "Facility",
    "Acquisition date",
    "Acquisition cost (₦)",
    "Useful life (years)",
    "Annual depreciation (₦)",
    "Accumulated depreciation (₦)",
    "Net book value (₦)",
    "% depreciated",
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    sheet.addRow([
      r.assetCode ?? "",
      r.assetName,
      r.categoryName,
      r.facilityName,
      r.acquisitionDate ?? "",
      r.acquisitionCostNgn,
      r.usefulLifeYears,
      r.annualDepreciationNgn,
      r.accumulatedDepreciationNgn,
      r.netBookValueNgn,
      r.percentDepreciated,
    ]);
  }
  return toBuffer(workbook, `depreciation-schedule-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function buildInsuranceRegisterWorkbook(rows: InsuranceListRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Insurance register");
  sheet.addRow([
    "Asset/Property",
    "Facility",
    "Type",
    "Insurer",
    "Policy number",
    "Insured value (₦)",
    "Annual premium (₦)",
    "Start",
    "End",
    "Days to renewal",
    "Status",
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    sheet.addRow([
      r.assetOrProperty,
      r.facilityName,
      r.insuranceType,
      r.insurer,
      r.policyNumber,
      r.insuredValueNgn,
      r.annualPremiumNgn,
      r.policyStart,
      r.policyEnd,
      r.daysToRenewal,
      r.status,
    ]);
  }
  return toBuffer(workbook, `insurance-register-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
