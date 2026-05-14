import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import * as db from "./db";
import {
  REGISTER_STATUS_LABELS,
  legacyStatusFromRegister,
  type RegisterStatusKey,
} from "./assetRegister";
import type { AssetRegisterListParams } from "./db";
import type { Site } from "../drizzle/schema";

const NRCS_TITLE = "NIGERIA RED CROSS SOCIETY - ASSET REGISTER";

/** Official NRCS workbook often uses `5. Asset Register-Ver…`; our export uses `Asset Register`. */
const ASSET_REGISTER_SHEET_EXPORT = "Asset Register";

function pickAssetRegisterSheetName(sheetNames: string[]): string | undefined {
  if (!sheetNames.length) return undefined;
  const versioned = sheetNames.find((n) => /^5\.\s*Asset Register/i.test(n.trim()));
  if (versioned) return versioned;
  if (sheetNames.includes(ASSET_REGISTER_SHEET_EXPORT)) return ASSET_REGISTER_SHEET_EXPORT;
  const fuzzy = sheetNames.find((n) => /asset\s*register/i.test(n));
  if (fuzzy) return fuzzy;
  return sheetNames[0];
}

const HEADER_TITLES = [
  "S/No",
  "Item Type",
  "Item Category",
  "Sub Item Category",
  "Item Description",
  "Branch Code",
  "Category Code",
  "NUM",
  "Asset Code",
  "Serial Number",
  "Actual Unit Value",
  "Depreciated Value",
  "Method of Acquisition",
  "Acquisition Detail",
  "Project Ref / Name",
  "Year Acquired",
  "New/Used",
  "Current Status",
  "Assigned To",
  "Department",
  "Location",
  "Condition",
  "Last Check Date",
  "Check Conducted By",
  "Remarks",
] as const;

function sanitizeFilenamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "Site";
}

function writeNRCSAssetRegisterHeader(sheet: ExcelJS.Worksheet) {
  sheet.mergeCells(1, 1, 1, HEADER_TITLES.length);
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = NRCS_TITLE;
  titleRow.getCell(1).font = { bold: true, size: 14 };
  titleRow.getCell(1).alignment = { horizontal: "center" };
  sheet.getRow(2).getCell(1).value = "Branch Name:";
  sheet.getRow(2).getCell(2).value = "";
  sheet.getRow(3).getCell(1).value = "Updated By:";
  sheet.getRow(3).getCell(2).value = "";
  sheet.getRow(4).getCell(1).value = "Approved By:";
  sheet.getRow(4).getCell(2).value = "";
  const groupingRow = sheet.getRow(5);
  const groups = [
    ["ITEM DETAILS", 1, 5],
    ["ITEM CODE", 6, 9],
    ["FINANCIAL VALUE", 10, 11],
    ["PURCHASE/ACQUISITION INFORMATION", 12, 18],
    ["ASSIGNED TO", 19, 21],
    ["CONDITION", 22, 25],
  ] as const;
  for (const [label, start, end] of groups) {
    sheet.mergeCells(5, start, 5, end);
    const c = groupingRow.getCell(start);
    c.value = label;
    c.font = { bold: true };
    c.alignment = { horizontal: "center" };
  }
  [2, 3, 4].forEach((rowIndex) => {
    sheet.getRow(rowIndex).font = { bold: true };
  });
  const headerRow = sheet.getRow(6);
  HEADER_TITLES.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    c.font = { color: { argb: "FFFFFFFF" }, bold: true };
  });
}

function setNRCSColumnWidths(sheet: ExcelJS.Worksheet) {
  HEADER_TITLES.forEach((_, i) => {
    sheet.getColumn(i + 1).width = i === 4 ? 36 : i === 24 ? 28 : 14;
  });
}

export async function generateNRCSAssetRegisterTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Asset Register", {
    views: [{ state: "frozen", ySplit: 6 }],
  });
  writeNRCSAssetRegisterHeader(sheet);
  setNRCSColumnWidths(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function registerStatusKeyFromLabel(label: string): RegisterStatusKey | null {
  const t = label.trim().toLowerCase();
  for (const [k, v] of Object.entries(REGISTER_STATUS_LABELS)) {
    if (v.toLowerCase() === t) return k as RegisterStatusKey;
  }
  const underscored = t.replace(/\s+/g, "_");
  if ((REGISTER_STATUS_LABELS as Record<string, string>)[underscored]) {
    return underscored as RegisterStatusKey;
  }
  return null;
}

export async function buildNRCSAssetRegisterWorkbook(
  params: Omit<AssetRegisterListParams, "limit" | "offset"> & { siteLabel?: string }
): Promise<{ buffer: Buffer; filename: string }> {
  const { rows } = await db.getAssetRegisterExportRows(params);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Asset Register", {
    views: [{ state: "frozen", ySplit: 6 }],
  });

  writeNRCSAssetRegisterHeader(sheet);

  const currencyFmt = '"NGN" #,##0.00';
  const dateFmt = "dd/mm/yyyy";

  rows.forEach((row, idx) => {
    const r = sheet.getRow(idx + 7);
    const year = row.acquisitionDate
      ? new Date(row.acquisitionDate).getFullYear()
      : "";
    const desc =
      row.description && row.description.trim()
        ? `${row.name} — ${row.description}`
        : row.name;
    const locationCell = [row.siteName, row.location].filter(Boolean).join(" / ");
    const rsKey = row.registerStatus as RegisterStatusKey;
    const statusLabel = REGISTER_STATUS_LABELS[rsKey] ?? row.registerStatus;

    const assigned =
      row.assignedToName?.trim() ||
      row.assignedUserName?.trim() ||
      "";

    r.getCell(1).value = idx + 1;
    r.getCell(2).value = row.itemType === "Inventory" ? "Inventory" : "Asset";
    r.getCell(3).value = row.categoryName ?? "";
    r.getCell(4).value = row.subCategory ?? "";
    r.getCell(5).value = row.itemDescription ?? desc;
    r.getCell(6).value = row.branchCode ?? "";
    r.getCell(7).value = row.itemCategoryCode ?? "";
    r.getCell(8).value = row.assetNum ?? "";
    r.getCell(9).value = row.assetCode ?? row.assetTag;
    r.getCell(10).value = row.serialNumber ?? "";

    const unitVal = row.acquisitionCost != null ? Number(row.acquisitionCost) : null;
    const depVal =
      row.currentDepreciatedValue != null
        ? Number(row.currentDepreciatedValue)
        : row.currentValue != null
          ? Number(row.currentValue)
          : null;

    r.getCell(11).value = unitVal;
    r.getCell(11).numFmt = currencyFmt;
    r.getCell(12).value = depVal;
    r.getCell(12).numFmt = currencyFmt;

    r.getCell(13).value = row.acquisitionMethod ?? "";
    r.getCell(14).value = row.acquisitionOtherDetail ?? "";
    r.getCell(15).value = row.projectRef ?? "";
    r.getCell(16).value = row.yearAcquiredRegister ?? (year === "" ? "" : year);
    r.getCell(17).value = row.acquiredNewOrUsed ?? row.acquisitionCondition ?? "";
    r.getCell(18).value = row.currentStatus ?? statusLabel;
    r.getCell(19).value = assigned;
    r.getCell(20).value = row.department ?? "";
    r.getCell(21).value = row.currentLocation ?? locationCell;
    r.getCell(22).value = row.conditionRegister ?? row.physicalCondition ?? "";

    const lastCheck = row.lastPhysicalCheck
      ? new Date(row.lastPhysicalCheck)
      : row.lastCheckedAt
        ? new Date(row.lastCheckedAt)
        : null;
    r.getCell(23).value = lastCheck ? lastCheck : "";
    if (lastCheck) {
      r.getCell(23).numFmt = dateFmt;
    }

    r.getCell(24).value = row.checkConductedBy ?? row.checkedBy ?? "";
    r.getCell(25).value = row.remarksRegister ?? row.notes ?? "";

    [11, 12].forEach((col) => {
      const cell = r.getCell(col);
      if (cell.value === "" || cell.value === null) cell.numFmt = currencyFmt;
    });
  });

  setNRCSColumnWidths(sheet);

  const site = sanitizeFilenamePart(params.siteLabel ?? "All_Sites");
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const filename = `NRCS_Asset_Register_${site}_${dateStr}.xlsx`;
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, filename };
}

export type NRCSImportPreviewRow = {
  sheetRow: number;
  errors: string[];
  payload: {
    assetTag: string;
    name: string;
    description?: string;
    categoryId: number;
    siteId: number;
    itemType: "Asset" | "Inventory";
    subCategory?: string;
    serialNumber?: string;
    acquisitionCost?: string;
    currentDepreciatedValue?: number;
    currentValue?: string;
    acquisitionMethod?: string;
    projectRef?: string;
    acquisitionDate?: Date;
    acquisitionCondition?: "New" | "Used";
    registerStatus: RegisterStatusKey;
    assignedToName?: string;
    department?: string;
    location?: string;
    physicalCondition?: "Good" | "Fair" | "Damaged" | "Beyond Repair";
    lastCheckedAt?: Date;
    notes?: string;
  } | null;
};

function normHeader(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function strCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "text" in v && typeof (v as { text: string }).text === "string") {
    return (v as { text: string }).text;
  }
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** Zero-based indices for columns A–Y (25 columns). Same layout for app export and NRCS Ver 1.1.2.25. */
const AR_COL = {
  S_NO: 0,
  ITEM_TYPE: 1,
  ITEM_CATEGORY: 2,
  SUB_ITEM_CATEGORY: 3,
  ITEM_DESCRIPTION: 4,
  BRANCH_CODE: 5,
  CATEGORY_CODE: 6,
  NUM: 7,
  ASSET_CODE: 8,
  SERIAL_NUMBER: 9,
  ACTUAL_UNIT_VALUE: 10,
  DEPRECIATED_VALUE: 11,
  METHOD_OF_ACQUISITION: 12,
  ACQUISITION_DETAIL: 13,
  PROJECT_REF: 14,
  YEAR_ACQUIRED: 15,
  NEW_OR_USED: 16,
  CURRENT_STATUS: 17,
  ASSIGNED_TO: 18,
  DEPARTMENT: 19,
  LOCATION: 20,
  CONDITION: 21,
  LAST_CHECK_DATE: 22,
  CHECK_CONDUCTED_BY: 23,
  REMARKS: 24,
} as const;

function cellAtCol(row: unknown[] | undefined, colIdx: number): unknown {
  if (!row || colIdx < 0) return undefined;
  return colIdx < row.length ? row[colIdx] : undefined;
}

function strAtCol(row: unknown[] | undefined, colIdx: number): string {
  return strCell(cellAtCol(row, colIdx));
}

/** Column A is `S/No` (export) or `S.No` (NRCS) — identifies the header row regardless of other labels. */
function isSNoHeaderCell(val: unknown): boolean {
  const h = normHeader(val);
  if (!h) return false;
  if (h === "s/no" || h === "s.no" || h === "s no") return true;
  return /^s[./\s]*no\.?$/i.test(String(val ?? "").trim());
}

/**
 * Header row for the 25-column grid (export: row 6, NRCS Ver 1.1.2.25: row 9).
 * Prefer column A S/No; fall back to column I = Asset Code / ITEM CODE.
 */
function findAssetRegisterHeaderRow(matrix: unknown[][]): number | null {
  const maxRow = Math.min(matrix.length, 45);
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber++) {
    const row = matrix[rowNumber - 1];
    if (!row?.length) continue;
    if (isSNoHeaderCell(row[AR_COL.S_NO])) return rowNumber;
  }
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber++) {
    const row = matrix[rowNumber - 1];
    if (!row?.length) continue;
    const h = normHeader(row[AR_COL.ASSET_CODE]);
    if (h === "asset code" || h === "item code" || h.startsWith("item code")) return rowNumber;
  }
  return null;
}

/**
 * Match `sites.code`: exact `ABI` or `ABI-001`, or prefix `ABI` → `ABI-001` (equivalent to `code = $1 OR code LIKE $1 || '-%'`).
 * When multiple rows match, returns the lowest code lexicographically.
 */
export function matchSiteByBranchCode(sitesList: Site[], raw: string): Site | undefined {
  const q = raw.trim().toUpperCase();
  if (!q) return undefined;
  const matches = sitesList.filter((s) => {
    const c = (s.code ?? "").trim().toUpperCase();
    if (!c) return false;
    return c === q || c.startsWith(`${q}-`);
  });
  if (!matches.length) return undefined;
  matches.sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "", undefined, { sensitivity: "base" }));
  return matches[0];
}

function parseDateFlexible(s: string): Date | undefined {
  if (!s.trim()) return undefined;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const yyyy = Number(m[3]);
    return new Date(Date.UTC(yyyy, mm, dd));
  }
  return undefined;
}

export async function previewNRCSAssetImport(fileBuffer: Buffer): Promise<{
  headerRow: number;
  rows: NRCSImportPreviewRow[];
}> {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(fileBuffer, {
      type: "buffer",
      cellDates: true,
      cellFormula: false,
      cellHTML: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    throw new Error(`Could not read Excel file: ${msg}`);
  }

  const sheetName = pickAssetRegisterSheetName(wb.SheetNames ?? []);
  if (!sheetName) {
    return { headerRow: 0, rows: [] };
  }
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Worksheet "${sheetName}" was not found in the workbook.`);
  }

  let matrix: unknown[][];
  try {
    matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }) as unknown[][];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    throw new Error(`Could not parse worksheet "${sheetName}": ${msg}`);
  }

  const headerRow = findAssetRegisterHeaderRow(matrix);
  if (!headerRow) {
    throw new Error(
      `Could not find the asset register header row on sheet "${sheetName}". Expected "S/No" or "S.No" in column A (or "ITEM CODE" / "Asset Code" in column I).`
    );
  }

  const categories = await db.getAllAssetCategories();
  const sites = await db.getAllSites();

  const byCatName = (name: string) =>
    categories.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const bySiteName = (name: string) =>
    sites.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());

  const out: NRCSImportPreviewRow[] = [];

  for (let i = headerRow; i < matrix.length; i++) {
    const rowNumber = i + 1;
    const row = matrix[i];
    if (!row?.length) continue;
    const errors: string[] = [];

    const itemTypeRaw = strAtCol(row, AR_COL.ITEM_TYPE).toLowerCase();
    const itemType: "Asset" | "Inventory" =
      itemTypeRaw.includes("invent") ? "Inventory" : "Asset";

    const categoryName = strAtCol(row, AR_COL.ITEM_CATEGORY);
    const subCategory = strAtCol(row, AR_COL.SUB_ITEM_CATEGORY);
    const description = strAtCol(row, AR_COL.ITEM_DESCRIPTION);
    const assetTag = strAtCol(row, AR_COL.ASSET_CODE);
    const serialNumber = strAtCol(row, AR_COL.SERIAL_NUMBER);
    const unitVal = strAtCol(row, AR_COL.ACTUAL_UNIT_VALUE);
    const depVal = strAtCol(row, AR_COL.DEPRECIATED_VALUE);
    const acquisitionMethod = strAtCol(row, AR_COL.METHOD_OF_ACQUISITION);
    const projectRef = strAtCol(row, AR_COL.PROJECT_REF);
    const yearRaw = strAtCol(row, AR_COL.YEAR_ACQUIRED);
    const newOrUsedRaw = strAtCol(row, AR_COL.NEW_OR_USED).trim().toLowerCase();
    const statusLabel = strAtCol(row, AR_COL.CURRENT_STATUS);
    const assignedToName = strAtCol(row, AR_COL.ASSIGNED_TO);
    const department = strAtCol(row, AR_COL.DEPARTMENT);
    const branchCode = strAtCol(row, AR_COL.BRANCH_CODE).trim();
    const locationName = strAtCol(row, AR_COL.LOCATION).trim();
    const condition = strAtCol(row, AR_COL.CONDITION);
    const lastCheckRaw = strAtCol(row, AR_COL.LAST_CHECK_DATE);
    const remarks = strAtCol(row, AR_COL.REMARKS);

    if (!assetTag && !description) {
      continue;
    }

    if (!assetTag) errors.push("Asset Code is required");
    if (!description) errors.push("Item Description is required");

    const cat = categoryName ? byCatName(categoryName) : undefined;
    if (!cat) errors.push(`Unknown Item Category: "${categoryName || ""}"`);

    const siteFromCode = branchCode ? matchSiteByBranchCode(sites, branchCode) : undefined;
    const siteFromLoc = locationName ? bySiteName(locationName) : undefined;
    const site = siteFromCode ?? siteFromLoc;
    if (!site) {
      if (branchCode && !siteFromCode) {
        errors.push(
          `Branch code '${branchCode}' not found — check the code or import facilities first.`
        );
      }
      if (locationName && !siteFromLoc) {
        errors.push(`Unknown Current Location (site): "${locationName}"`);
      }
      if (!branchCode && !locationName) {
        errors.push("Branch code or Current Location is required to assign a facility.");
      }
    }

    let registerStatus: RegisterStatusKey = "in_use";
    if (statusLabel) {
      const k = registerStatusKeyFromLabel(statusLabel);
      if (k) registerStatus = k;
      else errors.push(`Unknown Current Status: "${statusLabel}"`);
    }

    let acquisitionCondition: "New" | "Used" | undefined;
    if (newOrUsedRaw) {
      if (/\bnew\b/.test(newOrUsedRaw) && !/\bused\b/.test(newOrUsedRaw)) acquisitionCondition = "New";
      else if (/\bused\b/.test(newOrUsedRaw)) acquisitionCondition = "Used";
      else errors.push(`New or Used must be New or Used (got "${newOrUsedRaw}")`);
    }

    let physicalCondition: "Good" | "Fair" | "Damaged" | "Beyond Repair" | undefined;
    const c = condition.toLowerCase();
    if (["good", "fair", "damaged", "beyond repair"].includes(c)) {
      physicalCondition =
        c === "beyond repair"
          ? "Beyond Repair"
          : ((c.charAt(0).toUpperCase() + c.slice(1)) as "Good" | "Fair" | "Damaged");
    } else if (condition) {
      errors.push(`Unknown Condition: "${condition}"`);
    }

    let acquisitionDate: Date | undefined;
    if (yearRaw) {
      const y = parseInt(yearRaw, 10);
      if (!Number.isNaN(y) && y > 1800 && y < 2200) {
        acquisitionDate = new Date(Date.UTC(y, 5, 15));
      } else {
        errors.push(`Invalid Year Acquired: "${yearRaw}"`);
      }
    }

    const lastCheckedAt = parseDateFlexible(lastCheckRaw);

    let currentDepreciatedValue: number | undefined;
    if (depVal) {
      const n = Number(depVal.replace(/,/g, ""));
      if (!Number.isNaN(n)) currentDepreciatedValue = n;
    }

    const payload =
      errors.length === 0 && cat && site && assetTag && description
        ? {
            assetTag: assetTag.toUpperCase(),
            name: description.slice(0, 255),
            description: description.length > 255 ? description : undefined,
            categoryId: cat.id,
            siteId: site.id,
            itemType,
            subCategory: subCategory || undefined,
            serialNumber: serialNumber || undefined,
            acquisitionCost: unitVal || undefined,
            currentDepreciatedValue,
            currentValue: depVal || undefined,
            acquisitionMethod: acquisitionMethod || undefined,
            projectRef: projectRef || undefined,
            acquisitionDate,
            acquisitionCondition,
            registerStatus,
            assignedToName: assignedToName || undefined,
            department: department || undefined,
            location: undefined,
            physicalCondition,
            lastCheckedAt,
            notes: remarks || undefined,
          }
        : null;

    out.push({ sheetRow: rowNumber, errors, payload });
  }

  return { headerRow, rows: out };
}

export async function confirmNRCSAssetImport(
  rows: NonNullable<NRCSImportPreviewRow["payload"]>[]
): Promise<{
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}> {
  let imported = 0;
  let skipped = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const p = rows[i]!;
    try {
      const existing = await db.getAssetByTag(p.assetTag);
      if (existing) {
        skipped++;
        errors.push({ row: i + 1, error: `Duplicate asset code ${p.assetTag}` });
        continue;
      }
      const status = legacyStatusFromRegister(p.registerStatus);
      await db.createAsset({
        assetTag: p.assetTag,
        name: p.name,
        description: p.description,
        categoryId: p.categoryId,
        siteId: p.siteId,
        status,
        registerStatus: p.registerStatus,
        itemType: p.itemType,
        subCategory: p.subCategory,
        serialNumber: p.serialNumber,
        acquisitionCost: p.acquisitionCost,
        currentValue: p.currentValue,
        currentDepreciatedValue: p.currentDepreciatedValue,
        acquisitionMethod: p.acquisitionMethod,
        projectRef: p.projectRef,
        acquisitionDate: p.acquisitionDate,
        acquisitionCondition: p.acquisitionCondition,
        assignedToName: p.assignedToName,
        department: p.department,
        location: p.location,
        physicalCondition: p.physicalCondition,
        lastCheckedAt: p.lastCheckedAt,
        notes: p.notes,
      });
      imported++;
    } catch (e: unknown) {
      skipped++;
      errors.push({
        row: i + 1,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return { imported, skipped, errors };
}
