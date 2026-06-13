import ExcelJS from "exceljs";

export type ImportDocumentType = "grn" | "waybill" | "monthly_report" | "stock_card";
export type ImportSource = "excel" | "pdf";

export type ParsedImportRow = {
  rowIndex: number;
  status: "valid" | "warning" | "error";
  errors: string[];
  data: Record<string, string | number | null>;
  confidence?: Record<string, number>;
};

export const TEMPLATE_COLUMNS: Record<ImportDocumentType, string[]> = {
  grn: ["date", "facility_code", "item_code", "ctn_code", "donor_code", "quantity_in", "unit_type", "document_ref", "from_to", "remarks"],
  waybill: [
    "date",
    "facility_code",
    "item_code",
    "ctn_code",
    "quantity_out",
    "destination_type",
    "document_ref",
    "from_to",
    "remarks",
  ],
  monthly_report: ["date", "facility_code", "item_code", "ctn_code", "donor_code", "quantity_in", "quantity_out", "document_ref", "remarks"],
  stock_card: ["date", "facility_code", "item_code", "ctn_code", "donor_code", "quantity_in", "quantity_out", "document_ref", "remarks"],
};

const TEMPLATE_HINTS: Record<string, string> = {
  date: "YYYY-MM-DD",
  facility_code: "Existing sites.code",
  item_code: "Existing inventory_catalogue.item_code",
  ctn_code: "CTN code (required)",
  donor_code: "Existing donors.code",
  quantity_in: "Number >= 0",
  quantity_out: "Number >= 0",
  unit_type: "e.g. pieces, cartons",
  destination_type: "distribution_point|branch_store|other",
  document_ref: "Optional source document number",
  from_to: "Origin or destination text",
  remarks: "Optional notes",
};

export function buildTemplateWorkbook(type: ImportDocumentType): ExcelJS.Workbook {
  const cols = TEMPLATE_COLUMNS[type];
  const head = cols;
  const hints = cols.map((c) => TEMPLATE_HINTS[c] ?? "");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Template");
  ws.addRows([head, hints]);
  return wb;
}

function normalizeCell(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const text = String(value).trim();
  return text.length ? text : null;
}

export async function parseExcelRows(type: ImportDocumentType, base64File: string): Promise<ParsedImportRow[]> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS @types/exceljs declares load(input: Buffer) but at runtime it
  // accepts any ArrayBuffer-backed object; cast silences the Buffer<T> mismatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(Buffer.from(base64File, "base64") as any);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  // Build a 0-based row matrix (same shape as XLSX header:1 output).
  // ExcelJS getSheetValues() is 1-based: index 0 is null; each row's index 0 is also undefined.
  const allRows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    allRows.push((row.values as unknown[]).slice(1));
  });
  const headers = (allRows[0] ?? []).map((h) => String(h ?? "").trim());
  const rows = allRows.slice(2).map((cells) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      if (header) obj[header] = cells[idx];
    });
    return obj;
  });
  const required = TEMPLATE_COLUMNS[type];
  return rows.map((raw, idx) => {
    const data: Record<string, string | number | null> = {};
    const errors: string[] = [];
    for (const column of required) {
      data[column] = normalizeCell(raw[column]);
      if (["date", "facility_code", "item_code", "ctn_code"].includes(column) && (data[column] == null || data[column] === "")) {
        errors.push(`${column} is required`);
      }
    }
    if (data.date && typeof data.date === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      errors.push("date must be YYYY-MM-DD");
    }
    if (data.quantity_in != null && Number(data.quantity_in) < 0) errors.push("quantity_in must be >= 0");
    if (data.quantity_out != null && Number(data.quantity_out) < 0) errors.push("quantity_out must be >= 0");
    if (data.destination_type && !["distribution_point", "branch_store", "other"].includes(String(data.destination_type))) {
      errors.push("destination_type is invalid");
    }
    return {
      rowIndex: idx + 3,
      status: errors.length ? "error" : "valid",
      errors,
      data,
    };
  });
}

export function parseTypedPdfText(text: string, type: "grn" | "waybill"): ParsedImportRow[] {
  const clean = text.replace(/\r/g, "");
  const fields: Record<string, string | number | null> = {};
  const confidence: Record<string, number> = {};
  const capture = (key: string, regex: RegExp, score = 0.9) => {
    const match = clean.match(regex);
    fields[key] = match?.[1]?.trim() ?? null;
    confidence[key] = match ? score : 0.4;
  };
  capture("document_ref", /(?:GRN|WB|Waybill)\s*(?:No|Number)?[:\s]+([A-Z0-9\-\/]+)/i, 0.95);
  capture("date", /Date[:\s]+(\d{4}-\d{2}-\d{2})/i, 0.9);
  capture("facility_code", /Warehouse[:\s]+([A-Z0-9]{2,8})/i, 0.85);
  capture("item_code", /Item\s*Code[:\s]+([A-Z0-9\-_]+)/i, 0.8);
  capture("ctn_code", /CTN[:\s]+([A-Z0-9\-_]+)/i, 0.8);
  capture("quantity_in", /Quantity\s*In[:\s]+([0-9.]+)/i, 0.8);
  capture("quantity_out", /Quantity\s*Out[:\s]+([0-9.]+)/i, 0.8);
  capture("destination_type", /Destination\s*Type[:\s]+([a-z_]+)/i, 0.85);
  const row: ParsedImportRow = {
    rowIndex: 1,
    status: "valid",
    errors: [],
    data: fields,
    confidence,
  };
  if (!fields.date || !fields.facility_code || !fields.item_code || !fields.ctn_code) {
    row.status = "warning";
    row.errors.push("One or more required fields were not extracted confidently.");
  }
  if (type === "grn" && !fields.quantity_in) {
    row.status = "warning";
    row.errors.push("quantity_in could not be extracted.");
  }
  if (type === "waybill" && !fields.quantity_out) {
    row.status = "warning";
    row.errors.push("quantity_out could not be extracted.");
  }
  return [row];
}

