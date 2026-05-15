import ExcelJS from "exceljs";
import type {
  BudgetVsActualBranch,
  DepreciationScheduleRow,
  InsuranceListRow,
  MaintenanceCostListRow,
} from "./financeModulesDb";

async function toBuffer(workbook: ExcelJS.Workbook, filename: string) {
  const raw = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
  return { buffer, filename };
}

export async function buildMaintenanceCostsWorkbook(rows: MaintenanceCostListRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Maintenance costs");
  sheet.addRow([
    "Asset code",
    "Asset name",
    "Facility",
    "Type",
    "Date",
    "Cost (₦)",
    "Logged by",
    "Notes",
    "Reference",
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    sheet.addRow([
      r.assetCode ?? "",
      r.assetName,
      r.facilityName,
      r.maintenanceType,
      r.date,
      r.costNgn,
      r.loggedByName ?? "",
      r.description ?? "",
      r.referenceNumber ?? "",
    ]);
  }
  return toBuffer(workbook, `maintenance-costs-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function buildBudgetSummaryWorkbook(rows: BudgetVsActualBranch[], year: number) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Budget summary");
  sheet.addRow(["Branch", "Annual budget (₦)", "YTD spend (₦)", "Remaining (₦)", "% used", "Status"]);
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    sheet.addRow([
      r.siteName,
      r.budget,
      r.spend,
      Math.max(0, r.budget - r.spend),
      r.percentUsed,
      r.status,
    ]);
  }
  return toBuffer(workbook, `budget-summary-${year}.xlsx`);
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

export async function buildAnnualFinanceReportWorkbook(
  data: Awaited<ReturnType<typeof import("./financeModulesDb").getAnnualFinanceReportData>>
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NRCS EAM";

  const v = workbook.addWorksheet("Asset valuation");
  v.addRow(["Metric", "Amount (₦)"]);
  v.getRow(1).font = { bold: true };
  v.addRow(["Total certified property", data.valuation.totalCertifiedPropertyNgn]);
  v.addRow(["Total movable (acquisition)", data.valuation.totalMovableAcquisitionNgn]);
  v.addRow(["Combined total", data.valuation.combinedTotalNgn]);

  const d = workbook.addWorksheet("Depreciation");
  d.addRow(["Metric", "Amount (₦)"]);
  d.getRow(1).font = { bold: true };
  d.addRow(["Gross asset value", data.depreciation.totalGrossAssetValue]);
  d.addRow(["Accumulated depreciation", data.depreciation.totalAccumulatedDepreciation]);
  d.addRow(["Net book value", data.depreciation.totalNetBookValue]);
  d.addRow(["Fully depreciated assets", data.depreciation.assetsFullyDepreciated]);

  const b = workbook.addWorksheet("Budget vs actual");
  b.addRow(["Branch", "Budget (₦)", "Spend (₦)", "Variance (₦)", "% used"]);
  b.getRow(1).font = { bold: true };
  for (const row of data.budgetVsActual) {
    b.addRow([
      row.siteName,
      row.budget,
      row.spend,
      row.budget - row.spend,
      row.percentUsed,
    ]);
  }

  const m = workbook.addWorksheet("Maintenance");
  m.addRow(["Total spend (₦)", data.maintenance.totalSpend]);
  m.addRow([]);
  m.addRow(["Asset", "Code", "Total maintenance (₦)"]);
  m.getRow(3).font = { bold: true };
  for (const t of data.maintenance.topAssets) {
    m.addRow([t.assetName, t.assetCode ?? "", t.total]);
  }

  const i = workbook.addWorksheet("Insurance");
  i.addRow(["Metric", "Value"]);
  i.getRow(1).font = { bold: true };
  i.addRow(["Total insured value (₦)", data.insurance.totalInsuredValue]);
  i.addRow(["Total annual premiums (₦)", data.insurance.totalAnnualPremiums]);
  i.addRow(["Policies expiring in year", data.insurance.policiesExpiringInYear]);
  i.addRow(["Active policies", data.insurance.activeCount]);

  return toBuffer(workbook, `annual-finance-report-${data.year}.xlsx`);
}
