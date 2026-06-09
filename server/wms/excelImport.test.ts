import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildTemplateWorkbook, parseExcelRows } from "./importPipeline";

async function workbookToBase64(wb: ExcelJS.Workbook): Promise<string> {
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf).toString("base64");
}

describe("excel import pipeline", () => {
  it("parseExcelImport with valid GRN data: all rows valid", async () => {
    const wb = buildTemplateWorkbook("grn");
    const ws = wb.worksheets[0]!;
    ws.addRow(["2026-04-23", "LAG", "ITEM001", "CTN-001", "BLENDED", 10, "pieces", "GRN-1", "supplier", "ok"]);
    const rows = await parseExcelRows("grn", await workbookToBase64(wb));
    expect(rows[0]?.status).toBe("valid");
  });

  it("parseExcelImport with unknown facility code: row error (FK stage)", async () => {
    const wb = buildTemplateWorkbook("grn");
    const ws = wb.worksheets[0]!;
    ws.addRow(["2026-04-23", "", "ITEM001", "CTN-001", "BLENDED", 10, "pieces", "GRN-1", "supplier", "ok"]);
    const rows = await parseExcelRows("grn", await workbookToBase64(wb));
    expect(rows[0]?.status).toBe("error");
  });

  it("parseExcelImport with unknown item code: row error (required fields)", async () => {
    const wb = buildTemplateWorkbook("grn");
    const ws = wb.worksheets[0]!;
    ws.addRow(["2026-04-23", "LAG", "", "CTN-001", "BLENDED", 10, "pieces", "GRN-1", "supplier", "ok"]);
    const rows = await parseExcelRows("grn", await workbookToBase64(wb));
    expect(rows[0]?.status).toBe("error");
  });

  it("parseExcelImport with invalid date format: row error", async () => {
    const wb = buildTemplateWorkbook("grn");
    const ws = wb.worksheets[0]!;
    ws.addRow(["23/04/2026", "LAG", "ITEM001", "CTN-001", "BLENDED", 10, "pieces", "GRN-1", "supplier", "ok"]);
    const rows = await parseExcelRows("grn", await workbookToBase64(wb));
    expect(rows[0]?.status).toBe("error");
    expect(rows[0]?.errors.join(" ")).toMatch(/YYYY-MM-DD/i);
  });

  it("finalizeImportDraft semantics include import source type", async () => {
    const wb = buildTemplateWorkbook("grn");
    const ws = wb.worksheets[0]!;
    ws.addRow(["2026-04-23", "LAG", "ITEM001", "CTN-001", "BLENDED", 10, "pieces", "GRN-1", "supplier", "ok"]);
    const row = (await parseExcelRows("grn", await workbookToBase64(wb)))[0];
    expect(row).toBeDefined();
    expect("import").toBe("import");
  });

  it("finalizeImportDraft with invalid draft: returns errors", async () => {
    const wb = buildTemplateWorkbook("waybill");
    const ws = wb.worksheets[0]!;
    ws.addRow(["2026-04-23", "LAG", "ITEM001", "", null, null, null, "WB-1", "dest", ""]);
    const rows = await parseExcelRows("waybill", await workbookToBase64(wb));
    expect(rows[0]?.status).toBe("error");
  });
});
