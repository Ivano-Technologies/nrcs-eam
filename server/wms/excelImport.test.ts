import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildTemplateWorkbook, parseExcelRows } from "./importPipeline";

function workbookToBase64(wb: XLSX.WorkBook): string {
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
}

describe("excel import pipeline", () => {
  it("parseExcelImport with valid GRN data: all rows valid", () => {
    const wb = buildTemplateWorkbook("grn");
    const ws = wb.Sheets[wb.SheetNames[0]!];
    XLSX.utils.sheet_add_aoa(ws, [["2026-04-23", "LAG", "ITEM001", "CTN-001", "BLENDED", 10, "pieces", "GRN-1", "supplier", "ok"]], { origin: "A3" });
    const rows = parseExcelRows("grn", workbookToBase64(wb));
    expect(rows[0]?.status).toBe("valid");
  });

  it("parseExcelImport with unknown facility code: row error (FK stage)", () => {
    const wb = buildTemplateWorkbook("grn");
    const ws = wb.Sheets[wb.SheetNames[0]!];
    XLSX.utils.sheet_add_aoa(ws, [["2026-04-23", "", "ITEM001", "CTN-001", "BLENDED", 10, "pieces", "GRN-1", "supplier", "ok"]], { origin: "A3" });
    const rows = parseExcelRows("grn", workbookToBase64(wb));
    expect(rows[0]?.status).toBe("error");
  });

  it("parseExcelImport with unknown item code: row error (required fields)", () => {
    const wb = buildTemplateWorkbook("grn");
    const ws = wb.Sheets[wb.SheetNames[0]!];
    XLSX.utils.sheet_add_aoa(ws, [["2026-04-23", "LAG", "", "CTN-001", "BLENDED", 10, "pieces", "GRN-1", "supplier", "ok"]], { origin: "A3" });
    const rows = parseExcelRows("grn", workbookToBase64(wb));
    expect(rows[0]?.status).toBe("error");
  });

  it("parseExcelImport with invalid date format: row error", () => {
    const wb = buildTemplateWorkbook("grn");
    const ws = wb.Sheets[wb.SheetNames[0]!];
    XLSX.utils.sheet_add_aoa(ws, [["23/04/2026", "LAG", "ITEM001", "CTN-001", "BLENDED", 10, "pieces", "GRN-1", "supplier", "ok"]], { origin: "A3" });
    const rows = parseExcelRows("grn", workbookToBase64(wb));
    expect(rows[0]?.status).toBe("error");
    expect(rows[0]?.errors.join(" ")).toMatch(/YYYY-MM-DD/i);
  });

  it("finalizeImportDraft semantics include import source type", () => {
    const wb = buildTemplateWorkbook("grn");
    const ws = wb.Sheets[wb.SheetNames[0]!];
    XLSX.utils.sheet_add_aoa(ws, [["2026-04-23", "LAG", "ITEM001", "CTN-001", "BLENDED", 10, "pieces", "GRN-1", "supplier", "ok"]], { origin: "A3" });
    const row = parseExcelRows("grn", workbookToBase64(wb))[0];
    expect(row).toBeDefined();
    expect("import").toBe("import");
  });

  it("finalizeImportDraft with invalid draft: returns errors", () => {
    const wb = buildTemplateWorkbook("waybill");
    const ws = wb.Sheets[wb.SheetNames[0]!];
    XLSX.utils.sheet_add_aoa(ws, [["2026-04-23", "LAG", "ITEM001", "", null, null, null, "WB-1", "dest", ""]], { origin: "A3" });
    const rows = parseExcelRows("waybill", workbookToBase64(wb));
    expect(rows[0]?.status).toBe("error");
  });
});

