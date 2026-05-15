import ExcelJS from "exceljs";
import type { AssetValuationReport } from "./db";

export async function buildAssetValuationRegisterWorkbook(report: AssetValuationReport): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NRCS EAM";

  const reg = workbook.addWorksheet("Property register", {
    properties: { defaultColWidth: 14 },
  });
  reg.addRow([
    "State",
    "Facility code",
    "Facility name",
    "Land area (sqm)",
    "Market value (₦)",
    "Certified value (₦)",
    "Valuation date",
    "Reference",
    "Notes",
  ]);
  reg.getRow(1).font = { bold: true };
  for (const r of report.propertyRegister) {
    reg.addRow([
      r.state ?? "",
      r.facilityCode ?? "",
      r.facilityName,
      r.landAreaSqm != null ? Number(r.landAreaSqm) : "",
      r.marketValueNgn,
      r.certifiedValueNgn,
      r.valuationDate,
      r.valuationReference ?? "",
      r.notes ?? "",
    ]);
  }

  const pend = workbook.addWorksheet("Pending valuation");
  pend.addRow(["Facility code", "Facility name", "State", "Facility type", "Status"]);
  pend.getRow(1).font = { bold: true };
  for (const p of report.pendingValuation) {
    pend.addRow([p.facilityCode ?? "", p.facilityName, p.state ?? "", p.facilityType, "Not yet valued"]);
  }

  const mov = workbook.addWorksheet("Movable summary");
  mov.addRow(["Category", "Count", "Total acquisition (₦)", "Total depreciated (₦)"]);
  mov.getRow(1).font = { bold: true };
  for (const m of report.movableByCategory) {
    mov.addRow([m.categoryName, m.count, m.totalAcquisitionNgn, m.totalDepreciatedNgn]);
  }

  const raw = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
  return {
    buffer,
    filename: `nrcs-asset-valuation-${new Date().toISOString().slice(0, 10)}.xlsx`,
  };
}
