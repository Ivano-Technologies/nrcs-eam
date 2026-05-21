import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import {
  assetCategories,
  assets,
  budgets,
  financialTransactions,
  insuranceRecords,
  maintenanceCosts,
  sites,
  users,
} from "../drizzle/schema";
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

function yearDateRange(year: number): { start: Date; end: Date } {
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
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

export type BudgetRow = {
  id: number;
  siteId: number | null;
  categoryId: number | null;
  siteName: string | null;
  categoryName: string | null;
  period: number;
  amount: number;
};

export async function listBudgets(period: number): Promise<BudgetRow[]> {
  const database = await db.getDb();
  if (!database) return [];
  const rows = await database
    .select({
      id: budgets.id,
      siteId: budgets.siteId,
      categoryId: budgets.categoryId,
      period: budgets.period,
      amount: budgets.amount,
      siteName: sites.name,
      categoryName: assetCategories.name,
    })
    .from(budgets)
    .leftJoin(sites, eq(budgets.siteId, sites.id))
    .leftJoin(assetCategories, eq(budgets.categoryId, assetCategories.id))
    .where(eq(budgets.period, period))
    .orderBy(asc(sites.name), asc(assetCategories.name));
  return rows.map((r) => ({
    id: r.id,
    siteId: r.siteId,
    categoryId: r.categoryId,
    siteName: r.siteName,
    categoryName: r.categoryName,
    period: r.period,
    amount: num(r.amount),
  }));
}

export async function upsertBudget(input: {
  id?: number;
  siteId: number | null;
  categoryId: number | null;
  period: number;
  amount: number;
  createdBy: number;
}) {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  const now = new Date();
  if (input.id) {
    await database
      .update(budgets)
      .set({ amount: String(input.amount), updatedAt: now })
      .where(eq(budgets.id, input.id));
    return input.id;
  }
  const [row] = await database
    .insert(budgets)
    .values({
      siteId: input.siteId,
      categoryId: input.categoryId,
      period: input.period,
      amount: String(input.amount),
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: budgets.id });
  return row!.id;
}

async function ytdSpendForSite(siteId: number, year: number): Promise<number> {
  const database = await db.getDb();
  if (!database) return 0;
  const { start, end } = yearDateRange(year);
  const mc = await database
    .select({ total: sql<number>`coalesce(sum(${maintenanceCosts.costNgn}::numeric), 0)`.mapWith(Number) })
    .from(maintenanceCosts)
    .innerJoin(assets, eq(maintenanceCosts.assetId, assets.id))
    .where(and(eq(assets.siteId, siteId), gte(maintenanceCosts.date, start), lte(maintenanceCosts.date, end)));
  const mcTotal = Number(mc[0]?.total ?? 0);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const ft = await database
    .select({ total: sql<number>`coalesce(sum(${financialTransactions.amount}::numeric), 0)`.mapWith(Number) })
    .from(financialTransactions)
    .innerJoin(assets, eq(financialTransactions.assetId, assets.id))
    .where(
      and(
        eq(assets.siteId, siteId),
        gte(financialTransactions.transactionDate, yearStart),
        lte(financialTransactions.transactionDate, yearEnd)
      )
    );
  return mcTotal + Number(ft[0]?.total ?? 0);
}

export type BudgetVsActualBranch = {
  siteId: number;
  siteName: string;
  budget: number;
  spend: number;
  percentUsed: number;
  status: "green" | "amber" | "red";
};

export async function getBudgetVsActualByBranch(year: number): Promise<BudgetVsActualBranch[]> {
  const database = await db.getDb();
  if (!database) return [];
  const branchSites = await database
    .select({ id: sites.id, name: sites.name })
    .from(sites)
    .where(and(eq(sites.facilityType, "branch"), eq(sites.isActive, true)))
    .orderBy(asc(sites.name));

  const budgetRows = await listBudgets(year);
  const branchBudget = new Map<number, number>();
  for (const b of budgetRows) {
    if (b.siteId == null) continue;
    if (b.categoryId != null) continue;
    branchBudget.set(b.siteId, (branchBudget.get(b.siteId) ?? 0) + b.amount);
  }

  const { start, end } = yearDateRange(year);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const [maintenanceBySite, financialBySite] = await Promise.all([
    database
      .select({
        siteId: assets.siteId,
        total: sql<number>`coalesce(sum(${maintenanceCosts.costNgn}::numeric), 0)`.mapWith(Number),
      })
      .from(maintenanceCosts)
      .innerJoin(assets, eq(maintenanceCosts.assetId, assets.id))
      .where(and(gte(maintenanceCosts.date, start), lte(maintenanceCosts.date, end)))
      .groupBy(assets.siteId),
    database
      .select({
        siteId: assets.siteId,
        total: sql<number>`coalesce(sum(${financialTransactions.amount}::numeric), 0)`.mapWith(Number),
      })
      .from(financialTransactions)
      .innerJoin(assets, eq(financialTransactions.assetId, assets.id))
      .where(
        and(
          gte(financialTransactions.transactionDate, yearStart),
          lte(financialTransactions.transactionDate, yearEnd)
        )
      )
      .groupBy(assets.siteId),
  ]);

  const maintenanceSpend = new Map(maintenanceBySite.map((r) => [r.siteId, Number(r.total ?? 0)]));
  const financialSpend = new Map(financialBySite.map((r) => [r.siteId, Number(r.total ?? 0)]));

  return branchSites.map((site) => {
    const budget = branchBudget.get(site.id) ?? 0;
    const spend =
      (maintenanceSpend.get(site.id) ?? 0) + (financialSpend.get(site.id) ?? 0);
    const percentUsed = budget > 0 ? Math.round((spend / budget) * 1000) / 10 : spend > 0 ? 100 : 0;
    let status: BudgetVsActualBranch["status"] = "green";
    if (percentUsed >= 100) status = "red";
    else if (percentUsed >= 75) status = "amber";
    return { siteId: site.id, siteName: site.name, budget, spend, percentUsed, status };
  });
}

export type MaintenanceCostListRow = {
  id: number;
  assetId: number;
  assetCode: string | null;
  assetName: string;
  facilityName: string;
  maintenanceType: string;
  date: string;
  costNgn: number;
  loggedByName: string | null;
  description: string | null;
  referenceNumber: string | null;
};

export async function listMaintenanceCosts(filters: {
  siteId?: number;
  categoryId?: number;
  dateFrom?: string;
  dateTo?: string;
  minCost?: number;
  maxCost?: number;
}): Promise<MaintenanceCostListRow[]> {
  const database = await db.getDb();
  if (!database) return [];
  const conditions: SQL[] = [];
  if (filters.siteId) conditions.push(eq(assets.siteId, filters.siteId));
  if (filters.categoryId) conditions.push(eq(assets.categoryId, filters.categoryId));
  if (filters.dateFrom) conditions.push(gte(maintenanceCosts.date, parseIsoDate(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(maintenanceCosts.date, parseIsoDate(filters.dateTo)));
  if (filters.minCost != null) conditions.push(sql`${maintenanceCosts.costNgn}::numeric >= ${filters.minCost}`);
  if (filters.maxCost != null) conditions.push(sql`${maintenanceCosts.costNgn}::numeric <= ${filters.maxCost}`);

  const rows = await database
    .select({
      id: maintenanceCosts.id,
      assetId: maintenanceCosts.assetId,
      assetCode: assets.assetCode,
      assetName: assets.name,
      facilityName: sites.name,
      maintenanceType: maintenanceCosts.maintenanceType,
      date: maintenanceCosts.date,
      costNgn: maintenanceCosts.costNgn,
      description: maintenanceCosts.description,
      referenceNumber: maintenanceCosts.referenceNumber,
      loggedByName: users.name,
    })
    .from(maintenanceCosts)
    .innerJoin(assets, eq(maintenanceCosts.assetId, assets.id))
    .innerJoin(sites, eq(assets.siteId, sites.id))
    .leftJoin(users, eq(maintenanceCosts.loggedBy, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(maintenanceCosts.date));

  return rows.map((r) => ({
    id: r.id,
    assetId: r.assetId,
    assetCode: r.assetCode,
    assetName: r.assetName,
    facilityName: r.facilityName,
    maintenanceType: r.maintenanceType,
    date: r.date ? String(r.date).slice(0, 10) : "",
    costNgn: num(r.costNgn),
    loggedByName: r.loggedByName,
    description: r.description,
    referenceNumber: r.referenceNumber,
  }));
}

export async function createMaintenanceCost(input: {
  assetId: number;
  maintenanceType: string;
  date: string;
  costNgn: number;
  description?: string;
  referenceNumber?: string;
  loggedBy: number;
}) {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  const [row] = await database
    .insert(maintenanceCosts)
    .values({
      assetId: input.assetId,
      maintenanceType: input.maintenanceType,
      date: parseIsoDate(input.date),
      costNgn: String(input.costNgn),
      description: input.description ?? null,
      referenceNumber: input.referenceNumber ?? null,
      loggedBy: input.loggedBy,
    })
    .returning({ id: maintenanceCosts.id });
  return row!.id;
}

export async function getMaintenanceCostSummary(year: number) {
  const database = await db.getDb();
  if (!database) {
    return {
      totalSpend: 0,
      topAsset: null as { assetCode: string | null; assetName: string; total: number } | null,
      topFacility: null as { facilityName: string; total: number } | null,
      avgPerEntry: 0,
      entryCount: 0,
    };
  }
  const { start, end } = yearDateRange(year);

  const totalRow = await database
    .select({
      total: sql<number>`coalesce(sum(${maintenanceCosts.costNgn}::numeric), 0)`.mapWith(Number),
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(maintenanceCosts)
    .where(and(gte(maintenanceCosts.date, start), lte(maintenanceCosts.date, end)));

  const topAssetRows = await database
    .select({
      assetCode: assets.assetCode,
      assetName: assets.name,
      total: sql<number>`sum(${maintenanceCosts.costNgn}::numeric)`.mapWith(Number),
    })
    .from(maintenanceCosts)
    .innerJoin(assets, eq(maintenanceCosts.assetId, assets.id))
    .where(and(gte(maintenanceCosts.date, start), lte(maintenanceCosts.date, end)))
    .groupBy(assets.id, assets.assetCode, assets.name)
    .orderBy(desc(sql`sum(${maintenanceCosts.costNgn}::numeric)`))
    .limit(1);

  const topFacilityRows = await database
    .select({
      facilityName: sites.name,
      total: sql<number>`sum(${maintenanceCosts.costNgn}::numeric)`.mapWith(Number),
    })
    .from(maintenanceCosts)
    .innerJoin(assets, eq(maintenanceCosts.assetId, assets.id))
    .innerJoin(sites, eq(assets.siteId, sites.id))
    .where(and(gte(maintenanceCosts.date, start), lte(maintenanceCosts.date, end)))
    .groupBy(sites.id, sites.name)
    .orderBy(desc(sql`sum(${maintenanceCosts.costNgn}::numeric)`))
    .limit(1);

  const totalSpend = Number(totalRow[0]?.total ?? 0);
  const entryCount = Number(totalRow[0]?.count ?? 0);
  const topA = topAssetRows[0];
  const topF = topFacilityRows[0];

  return {
    totalSpend,
    topAsset: topA
      ? { assetCode: topA.assetCode, assetName: topA.assetName, total: Number(topA.total) }
      : null,
    topFacility: topF ? { facilityName: topF.facilityName, total: Number(topF.total) } : null,
    avgPerEntry: entryCount > 0 ? totalSpend / entryCount : 0,
    entryCount,
  };
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
    (await Promise.all(
      Array.from(new Set(all.map((a) => a.categoryId))).map(async (id) => {
        const c = await db.getAssetCategoryById(id);
        return [id, c?.name ?? "Unknown"] as const;
      })
    ))
  );
  const siteNames = new Map<number, string>();
  const rows: DepreciationScheduleRow[] = [];

  for (const a of all) {
    if (filters.siteId && a.siteId !== filters.siteId) continue;
    if (filters.categoryId && a.categoryId !== filters.categoryId) continue;
    const year = a.yearAcquiredRegister ?? (a.acquisitionDate ? new Date(a.acquisitionDate).getFullYear() : null);
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
    const dv = calculateDepreciatedValue(Number(row.actualUnitValue), row.itemCategory!, row.yearAcquiredRegister!);
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

export async function getAnnualFinanceReportData(year: number, siteId?: number) {
  const valuation = await db.getAssetValuationReport();
  const depreciation = await getDepreciationReportSummary();
  const budgetRows = await getBudgetVsActualByBranch(year);
  const filteredBudget =
    siteId != null ? budgetRows.filter((b) => b.siteId === siteId) : budgetRows;

  const maintSummary = await getMaintenanceCostSummary(year);
  const maintList = await listMaintenanceCosts({
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
    ...(siteId != null ? { siteId } : {}),
  });
  const topAssets = new Map<string, { assetCode: string | null; assetName: string; total: number }>();
  for (const m of maintList) {
    const key = String(m.assetId);
    const cur = topAssets.get(key) ?? { assetCode: m.assetCode, assetName: m.assetName, total: 0 };
    cur.total += m.costNgn;
    topAssets.set(key, cur);
  }
  const topMaintenanceAssets = Array.from(topAssets.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const insurance = await listInsuranceRecords(siteId != null ? { siteId } : undefined);
  const expiringThisYear = insurance.filter((r) => {
    const endYear = new Date(r.policyEnd).getFullYear();
    return endYear === year;
  }).length;

  return {
    year,
    siteId: siteId ?? null,
    valuation: {
      totalCertifiedPropertyNgn: valuation.totalCertifiedPropertyNgn,
      totalMovableAcquisitionNgn: valuation.totalMovableAcquisitionNgn,
      combinedTotalNgn: valuation.combinedTotalNgn,
    },
    depreciation,
    budgetVsActual: filteredBudget,
    maintenance: {
      totalSpend: maintList.reduce((s, r) => s + r.costNgn, 0) || maintSummary.totalSpend,
      topAssets: topMaintenanceAssets,
    },
    insurance: {
      totalInsuredValue: insurance.reduce((s, r) => s + r.insuredValueNgn, 0),
      totalAnnualPremiums: insurance.reduce((s, r) => s + r.annualPremiumNgn, 0),
      policiesExpiringInYear: expiringThisYear,
      activeCount: insurance.filter((r) => r.status === "active").length,
    },
  };
}
