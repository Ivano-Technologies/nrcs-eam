import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { assets, insuranceRecords, sites } from "../drizzle/schema";
import { calculateDepreciatedValue } from "./lib/depreciation";
import * as db from "./db";

function num(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function assetGross(a: {
  actualUnitValue: string | null;
  acquisitionCost: string | null;
}): number {
  const actual = a.actualUnitValue != null && String(a.actualUnitValue).trim() !== "";
  return actual ? num(a.actualUnitValue) : num(a.acquisitionCost);
}

function assetNetBook(a: {
  depreciatedValue: string | null;
  currentDepreciatedValue: number | null;
  actualUnitValue: string | null;
  acquisitionCost: string | null;
}): number {
  if (a.depreciatedValue != null && String(a.depreciatedValue).trim() !== "") {
    return num(a.depreciatedValue);
  }
  if (a.currentDepreciatedValue != null) return a.currentDepreciatedValue;
  return assetGross(a);
}

export type DepreciationScheduleRow = {
  assetId: number;
  assetCode: string | null;
  assetName: string;
  categoryName: string;
  facilityName: string;
  acquisitionDate: string | null;
  acquisitionCostNgn: number;
  usefulLifeYears: number;
  annualDepreciationNgn: number;
  accumulatedDepreciationNgn: number;
  netBookValueNgn: number;
  percentDepreciated: number;
  fullyDepreciated: boolean;
};

export async function getDepreciationSchedule(filters: {
  siteId?: number;
  categoryId?: number;
  yearAcquired?: number;
  status?: "active" | "fully_depreciated";
}): Promise<DepreciationScheduleRow[]> {
  const all = await db.getAllAssets();
  const categories = new Map(
    (
      await Promise.all(
        Array.from(new Set(all.map((a) => a.categoryId))).map(async (id) => {
          const c = await db.getAssetCategoryById(id);
          return [id, c?.name ?? "Unknown"] as const;
        })
      )
    )
  );
  const siteNames = new Map<number, string>();
  const rows: DepreciationScheduleRow[] = [];

  for (const a of all) {
    if (filters.siteId && a.siteId !== filters.siteId) continue;
    if (filters.categoryId && a.categoryId !== filters.categoryId) continue;
    const year =
      a.yearAcquiredRegister ?? (a.acquisitionDate ? new Date(a.acquisitionDate).getFullYear() : null);
    if (filters.yearAcquired != null && year !== filters.yearAcquired) continue;

    const gross = assetGross(a);
    if (gross <= 0) continue;

    const net = assetNetBook(a);
    const accumulated = Math.max(0, gross - net);
    const fullyDepreciated = net <= 0;
    if (filters.status === "fully_depreciated" && !fullyDepreciated) continue;
    if (filters.status === "active" && fullyDepreciated) continue;

    const usefulLife = a.usefulLifeYears ?? 5;
    const annualDepreciation = usefulLife > 0 ? gross / usefulLife : 0;
    const pct = gross > 0 ? Math.round((accumulated / gross) * 1000) / 10 : 0;

    if (!siteNames.has(a.siteId)) {
      const s = await db.getSiteById(a.siteId);
      siteNames.set(a.siteId, s?.name ?? "Unknown");
    }

    rows.push({
      assetId: a.id,
      assetCode: a.assetCode,
      assetName: a.name,
      categoryName: categories.get(a.categoryId) ?? "Unknown",
      facilityName: siteNames.get(a.siteId) ?? "Unknown",
      acquisitionDate: a.acquisitionDate ? new Date(a.acquisitionDate).toISOString().slice(0, 10) : null,
      acquisitionCostNgn: gross,
      usefulLifeYears: usefulLife,
      annualDepreciationNgn: Math.round(annualDepreciation * 100) / 100,
      accumulatedDepreciationNgn: Math.round(accumulated * 100) / 100,
      netBookValueNgn: Math.round(net * 100) / 100,
      percentDepreciated: pct,
      fullyDepreciated,
    });
  }

  return rows.sort((x, y) => (x.assetCode ?? "").localeCompare(y.assetCode ?? ""));
}

export async function getDepreciationReportSummary() {
  const schedule = await getDepreciationSchedule({});
  let gross = 0;
  let net = 0;
  let fullyDepreciated = 0;
  for (const r of schedule) {
    gross += r.acquisitionCostNgn;
    net += r.netBookValueNgn;
    if (r.fullyDepreciated) fullyDepreciated++;
  }
  return {
    totalGrossAssetValue: Math.round(gross * 100) / 100,
    totalAccumulatedDepreciation: Math.round((gross - net) * 100) / 100,
    totalNetBookValue: Math.round(net * 100) / 100,
    assetsFullyDepreciated: fullyDepreciated,
    assetCount: schedule.length,
  };
}

export async function recalculateAllRegisterDepreciation() {
  const rows = await db.listAssetsEligibleForAutoDepreciation();
  let updated = 0;
  for (const row of rows) {
    const dv = calculateDepreciatedValue(
      Number(row.actualUnitValue),
      row.itemCategory!,
      row.yearAcquiredRegister!
    );
    await db.updateAsset(row.id, {
      depreciatedValue: String(dv),
      currentDepreciatedValue: dv,
      depreciatedValueManualOverride: false,
    });
    updated++;
  }
  const total = await db.countAllAssets();
  return { updated, skipped: Math.max(0, total - updated) };
}

export function insuranceStatus(policyEnd: string): "active" | "expiring" | "expired" {
  const end = new Date(policyEnd);
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "active";
}

export type InsuranceListRow = {
  id: number;
  assetId: number | null;
  siteId: number | null;
  assetOrProperty: string;
  facilityName: string;
  insuranceType: string;
  insurer: string;
  policyNumber: string;
  insuredValueNgn: number;
  annualPremiumNgn: number;
  policyStart: string;
  policyEnd: string;
  daysToRenewal: number;
  status: "active" | "expiring" | "expired";
  notes: string | null;
};

export async function listInsuranceRecords(filters?: {
  siteId?: number;
  insuranceType?: string;
  status?: "active" | "expiring" | "expired";
}): Promise<InsuranceListRow[]> {
  const database = await db.getDb();
  if (!database) return [];
  const conditions: SQL[] = [];
  if (filters?.siteId) conditions.push(eq(insuranceRecords.siteId, filters.siteId));
  if (filters?.insuranceType) conditions.push(eq(insuranceRecords.insuranceType, filters.insuranceType));

  const rows = await database
    .select({
      id: insuranceRecords.id,
      assetId: insuranceRecords.assetId,
      siteId: insuranceRecords.siteId,
      assetName: assets.name,
      assetCode: assets.assetCode,
      siteName: sites.name,
      insuranceType: insuranceRecords.insuranceType,
      insurer: insuranceRecords.insurer,
      policyNumber: insuranceRecords.policyNumber,
      insuredValueNgn: insuranceRecords.insuredValueNgn,
      annualPremiumNgn: insuranceRecords.annualPremiumNgn,
      policyStart: insuranceRecords.policyStart,
      policyEnd: insuranceRecords.policyEnd,
      notes: insuranceRecords.notes,
    })
    .from(insuranceRecords)
    .leftJoin(assets, eq(insuranceRecords.assetId, assets.id))
    .leftJoin(sites, eq(insuranceRecords.siteId, sites.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(insuranceRecords.policyEnd));

  const out: InsuranceListRow[] = [];
  for (const r of rows) {
    const policyEnd = r.policyEnd ? String(r.policyEnd).slice(0, 10) : "";
    const status = insuranceStatus(policyEnd);
    if (filters?.status && status !== filters.status) continue;
    const end = new Date(policyEnd);
    const daysToRenewal = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    out.push({
      id: r.id,
      assetId: r.assetId,
      siteId: r.siteId,
      assetOrProperty: r.assetName ?? r.siteName ?? "—",
      facilityName: r.siteName ?? "—",
      insuranceType: r.insuranceType,
      insurer: r.insurer,
      policyNumber: r.policyNumber,
      insuredValueNgn: num(r.insuredValueNgn),
      annualPremiumNgn: num(r.annualPremiumNgn),
      policyStart: r.policyStart ? String(r.policyStart).slice(0, 10) : "",
      policyEnd,
      daysToRenewal,
      status,
      notes: r.notes,
    });
  }
  return out;
}

export async function countInsuranceExpiringSoon(): Promise<number> {
  const rows = await listInsuranceRecords({ status: "expiring" });
  return rows.length;
}

export async function createInsuranceRecord(input: {
  assetId: number | null;
  siteId: number | null;
  insuranceType: string;
  insurer: string;
  policyNumber: string;
  insuredValueNgn: number;
  annualPremiumNgn: number;
  policyStart: string;
  policyEnd: string;
  notes: string | null;
  createdBy: number;
}) {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  const now = new Date();
  const [row] = await database
    .insert(insuranceRecords)
    .values({
      assetId: input.assetId,
      siteId: input.siteId,
      insuranceType: input.insuranceType,
      insurer: input.insurer,
      policyNumber: input.policyNumber,
      insuredValueNgn: input.insuredValueNgn ? String(input.insuredValueNgn) : null,
      annualPremiumNgn: input.annualPremiumNgn ? String(input.annualPremiumNgn) : null,
      policyStart: parseIsoDate(input.policyStart),
      policyEnd: parseIsoDate(input.policyEnd),
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: insuranceRecords.id });
  return row!.id;
}

export async function updateInsuranceRecord(
  id: number,
  input: Partial<{
    assetId: number | null;
    siteId: number | null;
    insuranceType: string;
    insurer: string;
    policyNumber: string;
    insuredValueNgn: number;
    annualPremiumNgn: number;
    policyStart: string;
    policyEnd: string;
    notes: string | null;
  }>
) {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  await database
    .update(insuranceRecords)
    .set({
      ...(input.assetId !== undefined ? { assetId: input.assetId } : {}),
      ...(input.siteId !== undefined ? { siteId: input.siteId } : {}),
      ...(input.insuranceType ? { insuranceType: input.insuranceType } : {}),
      ...(input.insurer ? { insurer: input.insurer } : {}),
      ...(input.policyNumber ? { policyNumber: input.policyNumber } : {}),
      ...(input.insuredValueNgn !== undefined
        ? { insuredValueNgn: String(input.insuredValueNgn) }
        : {}),
      ...(input.annualPremiumNgn !== undefined
        ? { annualPremiumNgn: String(input.annualPremiumNgn) }
        : {}),
      ...(input.policyStart ? { policyStart: parseIsoDate(input.policyStart) } : {}),
      ...(input.policyEnd ? { policyEnd: parseIsoDate(input.policyEnd) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(insuranceRecords.id, id));
}

export async function deleteInsuranceRecord(id: number) {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  await database.delete(insuranceRecords).where(eq(insuranceRecords.id, id));
}
