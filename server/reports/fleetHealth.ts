import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  assets,
  assetCategories,
  notifications,
  sites,
  workOrders,
} from "../../drizzle/schema";
import { getDb, getLowStockItems } from "../db";
import {
  calculateDepreciation,
  estimateUsefulLife,
  type DepreciationResult,
} from "../depreciation";
import { calculateDepreciatedValue } from "../lib/depreciation";
import { getHighPriorityPredictions } from "../predictiveMaintenance";

export type WorkOrderAgeBuckets = {
  days0to7: number;
  days8to14: number;
  days15to30: number;
  days30plus: number;
};

export type ReplacementPipelineItem = {
  assetId: number;
  assetTag: string;
  assetName: string;
  siteId: number;
  siteName: string;
  category: string;
  yearsElapsed: number;
  usefulLifeYears: number;
  lifePercentUsed: number;
  currentBookValue: number;
};

export type FleetHealthPrediction = {
  assetId: number;
  assetTag: string;
  assetName: string;
  siteId: number;
  priority: string;
  predictedFailureDate: string;
  reason: string;
  recommendedAction: string;
};

export type FleetHealthSiteRow = {
  siteId: number;
  siteName: string;
  operationalAssetCount: number;
  totalBookValue: number;
  endOfLifeCount: number;
  replacementPipeline: ReplacementPipelineItem[];
  highPriorityPredictions: FleetHealthPrediction[];
  openWorkOrdersByAge: WorkOrderAgeBuckets;
  activeInventoryAlerts: number;
};

export type FleetHealthSummary = {
  reportDate: string;
  orgWide: FleetHealthSiteRow;
  bySite: FleetHealthSiteRow[];
};

type AssetRow = {
  id: number;
  assetTag: string;
  name: string;
  siteId: number;
  categoryName: string;
  acquisitionCost: string | null;
  residualValue: string | null;
  usefulLifeYears: number | null;
  depreciationMethod: string | null;
  depreciationStartDate: Date | null;
  actualUnitValue: string | null;
  itemCategory: string | null;
  yearAcquiredRegister: number | null;
  depreciatedValue: string | null;
  depreciatedValueManualOverride: boolean;
};

function registerDepreciation(asset: AssetRow): DepreciationResult | null {
  if (
    asset.actualUnitValue == null ||
    String(asset.actualUnitValue).trim() === "" ||
    !asset.itemCategory?.trim()
  ) {
    return null;
  }
  const actual = Number(asset.actualUnitValue);
  const year = asset.yearAcquiredRegister ?? new Date().getFullYear();
  const category = asset.itemCategory.trim();
  const book =
    asset.depreciatedValueManualOverride && asset.depreciatedValue != null
      ? Number(asset.depreciatedValue)
      : calculateDepreciatedValue(actual, category, year);
  const accumulated = Math.max(0, Math.round((actual - book) * 100) / 100);
  const age = Math.max(0, new Date().getFullYear() - year);
  const pct = actual > 0 ? (accumulated / actual) * 100 : 0;
  const annual = age > 0 ? accumulated / age : accumulated;
  const today = new Date().toISOString().split("T")[0]!;
  return {
    method: "NRCS Register (category-based)",
    annualDepreciation: Math.round(annual * 100) / 100,
    accumulatedDepreciation: accumulated,
    currentBookValue: book,
    depreciationPercentage: Math.round(pct * 100) / 100,
    yearsElapsed: age,
    remainingYears: Math.max(0, estimateUsefulLife(category) - age),
    schedule: [
      {
        year: 1,
        date: today,
        beginningValue: Math.round(actual * 100) / 100,
        depreciationExpense: accumulated,
        accumulatedDepreciation: accumulated,
        endingValue: book,
      },
    ],
  };
}

export function computeAssetBookValue(asset: AssetRow): {
  bookValue: number;
  yearsElapsed: number;
  usefulLifeYears: number;
} | null {
  const categoryLabel = asset.itemCategory?.trim() || asset.categoryName;
  const usefulLifeYears =
    asset.usefulLifeYears ?? estimateUsefulLife(categoryLabel);

  const legacyReady =
    asset.depreciationMethod &&
    asset.depreciationMethod !== "none" &&
    asset.acquisitionCost &&
    asset.depreciationStartDate;

  let result: DepreciationResult | null = null;
  if (legacyReady) {
    result = calculateDepreciation({
      acquisitionCost: Number(asset.acquisitionCost),
      residualValue: Number(asset.residualValue || 0),
      usefulLifeYears,
      depreciationStartDate: new Date(asset.depreciationStartDate!),
      method: asset.depreciationMethod as "straight-line" | "declining-balance",
      decliningBalanceRate: 2,
    });
  } else {
    result = registerDepreciation(asset);
  }

  if (!result) {
    const fallback =
      asset.depreciatedValue != null
        ? Number(asset.depreciatedValue)
        : asset.actualUnitValue != null
          ? Number(asset.actualUnitValue)
          : asset.acquisitionCost != null
            ? Number(asset.acquisitionCost)
            : null;
    if (fallback == null || Number.isNaN(fallback)) return null;
    return { bookValue: fallback, yearsElapsed: 0, usefulLifeYears };
  }

  return {
    bookValue: result.currentBookValue,
    yearsElapsed: result.yearsElapsed,
    usefulLifeYears,
  };
}

export function bucketWorkOrderAge(updatedAt: Date): keyof WorkOrderAgeBuckets {
  const days = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 7) return "days0to7";
  if (days <= 14) return "days8to14";
  if (days <= 30) return "days15to30";
  return "days30plus";
}

function emptyBuckets(): WorkOrderAgeBuckets {
  return { days0to7: 0, days8to14: 0, days15to30: 0, days30plus: 0 };
}

function emptySiteRow(siteId: number, siteName: string): FleetHealthSiteRow {
  return {
    siteId,
    siteName,
    operationalAssetCount: 0,
    totalBookValue: 0,
    endOfLifeCount: 0,
    replacementPipeline: [],
    highPriorityPredictions: [],
    openWorkOrdersByAge: emptyBuckets(),
    activeInventoryAlerts: 0,
  };
}

export async function buildFleetHealthSummary(opts?: {
  siteId?: number;
}): Promise<FleetHealthSummary> {
  const database = await getDb();
  if (!database) {
    throw new Error("Database unavailable");
  }

  const siteRows = await database
    .select({ id: sites.id, name: sites.name })
    .from(sites)
    .where(eq(sites.isActive, true));

  const siteNameById = new Map(siteRows.map((s) => [s.id, s.name]));
  let targetSiteIds = siteRows.map((s) => s.id);
  if (opts?.siteId != null) {
    targetSiteIds = [opts.siteId];
  }

  const assetRows = await database
    .select({
      id: assets.id,
      assetTag: assets.assetTag,
      name: assets.name,
      siteId: assets.siteId,
      categoryName: sql<string>`coalesce(${assetCategories.name}, ${assets.itemCategory}, 'Uncategorised')`,
      acquisitionCost: assets.acquisitionCost,
      residualValue: assets.residualValue,
      usefulLifeYears: assets.usefulLifeYears,
      depreciationMethod: assets.depreciationMethod,
      depreciationStartDate: assets.depreciationStartDate,
      actualUnitValue: assets.actualUnitValue,
      itemCategory: assets.itemCategory,
      yearAcquiredRegister: assets.yearAcquiredRegister,
      depreciatedValue: assets.depreciatedValue,
      depreciatedValueManualOverride: assets.depreciatedValueManualOverride,
    })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .where(
      and(
        eq(assets.status, "operational"),
        inArray(assets.siteId, targetSiteIds)
      )
    );

  const openWoRows = await database
    .select({
      siteId: workOrders.siteId,
      updatedAt: workOrders.updatedAt,
    })
    .from(workOrders)
    .where(
      and(
        notInArray(workOrders.status, ["completed", "cancelled"]),
        inArray(workOrders.siteId, targetSiteIds)
      )
    );

  const alertRows = await database
    .select({
      userId: notifications.userId,
      type: notifications.type,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.isRead, false),
        inArray(notifications.type, [
          "low_stock",
          "critical_stock",
          "expiry_warning_30",
        ])
      )
    );

  const predictions = await getHighPriorityPredictions();
  const assetSiteById = new Map(assetRows.map((a) => [a.id, a.siteId]));

  const siteMap = new Map<number, FleetHealthSiteRow>();
  for (const sid of targetSiteIds) {
    siteMap.set(sid, emptySiteRow(sid, siteNameById.get(sid) ?? `Site ${sid}`));
  }

  for (const asset of assetRows) {
    const row = siteMap.get(asset.siteId);
    if (!row) continue;
    row.operationalAssetCount += 1;
    const computed = computeAssetBookValue(asset as AssetRow);
    if (!computed) continue;

    row.totalBookValue += computed.bookValue;
    const lifePct =
      computed.usefulLifeYears > 0
        ? computed.yearsElapsed / computed.usefulLifeYears
        : 0;
    if (lifePct >= 0.8) {
      row.endOfLifeCount += 1;
      row.replacementPipeline.push({
        assetId: asset.id,
        assetTag: asset.assetTag,
        assetName: asset.name,
        siteId: asset.siteId,
        siteName: siteNameById.get(asset.siteId) ?? "",
        category: asset.categoryName,
        yearsElapsed: Math.round(computed.yearsElapsed * 10) / 10,
        usefulLifeYears: computed.usefulLifeYears,
        lifePercentUsed: Math.round(lifePct * 1000) / 10,
        currentBookValue: computed.bookValue,
      });
    }
  }

  for (const wo of openWoRows) {
    const row = siteMap.get(wo.siteId);
    if (!row) continue;
    const bucket = bucketWorkOrderAge(wo.updatedAt);
    row.openWorkOrdersByAge[bucket] += 1;
  }

  for (const pred of predictions) {
    const sid = assetSiteById.get(pred.assetId);
    if (sid == null || !siteMap.has(sid)) continue;
    if (opts?.siteId != null && sid !== opts.siteId) continue;
    siteMap.get(sid)!.highPriorityPredictions.push({
      assetId: pred.assetId,
      assetTag: pred.assetTag,
      assetName: pred.assetName,
      siteId: sid,
      priority: pred.priority,
      predictedFailureDate: pred.predictedFailureDate.toISOString().slice(0, 10),
      reason: pred.reason,
      recommendedAction: pred.recommendedAction,
    });
  }

  const lowStockBySite = await Promise.all(
    targetSiteIds.map(async (sid) => ({
      sid,
      count: (await getLowStockItems(sid)).length,
    }))
  );
  for (const { sid, count } of lowStockBySite) {
    const row = siteMap.get(sid);
    if (row) row.activeInventoryAlerts += count;
  }

  void alertRows;

  const bySite = Array.from(siteMap.values())
    .map((row) => ({
      ...row,
      totalBookValue: Math.round(row.totalBookValue * 100) / 100,
      replacementPipeline: row.replacementPipeline.sort(
        (a, b) => b.lifePercentUsed - a.lifePercentUsed
      ),
    }))
    .sort((a, b) => a.siteName.localeCompare(b.siteName));

  const orgWide = bySite.reduce<FleetHealthSiteRow>(
    (acc, row) => {
      acc.operationalAssetCount += row.operationalAssetCount;
      acc.totalBookValue += row.totalBookValue;
      acc.endOfLifeCount += row.endOfLifeCount;
      acc.replacementPipeline.push(...row.replacementPipeline);
      acc.highPriorityPredictions.push(...row.highPriorityPredictions);
      acc.openWorkOrdersByAge.days0to7 += row.openWorkOrdersByAge.days0to7;
      acc.openWorkOrdersByAge.days8to14 += row.openWorkOrdersByAge.days8to14;
      acc.openWorkOrdersByAge.days15to30 += row.openWorkOrdersByAge.days15to30;
      acc.openWorkOrdersByAge.days30plus += row.openWorkOrdersByAge.days30plus;
      acc.activeInventoryAlerts += row.activeInventoryAlerts;
      return acc;
    },
    emptySiteRow(0, "Organisation-wide")
  );
  orgWide.totalBookValue = Math.round(orgWide.totalBookValue * 100) / 100;
  orgWide.replacementPipeline.sort((a, b) => b.lifePercentUsed - a.lifePercentUsed);

  return {
    reportDate: new Date().toISOString().slice(0, 10),
    orgWide,
    bySite,
  };
}
