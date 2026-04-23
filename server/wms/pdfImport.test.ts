import { describe, expect, it } from "vitest";
import { parseTypedPdfText } from "./importPipeline";

describe("typed PDF import parser", () => {
  it("parses typed PDF GRN fixture with confidence scores", () => {
    const text = `
      GRN Number: GRN-2026-001
      Date: 2026-04-23
      Warehouse: LAG
      Item Code: ITEM001
      CTN: CTN-1001
      Quantity In: 40
    `;
    const rows = parseTypedPdfText(text, "grn");
    expect(rows[0]?.data.document_ref).toBe("GRN-2026-001");
    expect(Number(rows[0]?.confidence?.document_ref ?? 0)).toBeGreaterThan(0.8);
  });

  it("reject signal for PDF with no text layer", () => {
    const rows = parseTypedPdfText("", "grn");
    expect(rows[0]?.status).toBe("warning");
  });

  it("damaged text layer returns partial extraction and warnings", () => {
    const text = `Date: 2026-04-23\nWarehouse: LAG`;
    const rows = parseTypedPdfText(text, "waybill");
    expect(rows[0]?.status).toBe("warning");
    expect(rows[0]?.errors.length).toBeGreaterThan(0);
  });
});

