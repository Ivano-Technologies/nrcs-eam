import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  assets,
  assetCategories,
  inventoryItems,
  sites,
  workOrders,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  calculateDepreciation,
  estimateUsefulLife,
  type DepreciationResult,
} from "../depreciation";
import { calculateDepreciatedValue } from "../lib/depreciation";

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

const PIPELINE_CANDIDATE_LIMIT = 150;
const bookValueSql = sql`coalesce(${assets.depreciatedValue}::numeric, ${assets.actualUnitValue}::numeric, ${assets.acquisitionCost}::numeric, 0)`;

export async function buildFleetHealthSummary(opts?: {
  siteId?: number;
}): Promise<FleetHealthSummary> {
  const database = await getDb();
  if (!database) {
    throw new Error("Database unavailable");
  }

  const siteWhere = opts?.siteId != null ? eq(sites.id, opts.siteId) : eq(sites.isActive, true);
  const siteRows = await database
    .select({ id: sites.id, name: sites.name })
    .from(sites)
    .where(siteWhere);

  const siteNameById = new Map(siteRows.map((s) => [s.id, s.name]));
  const targetSiteIds = siteRows.map((s) => s.id);
  const siteMap = new Map<number, FleetHealthSiteRow>();
  for (const sid of targetSiteIds) {
    siteMap.set(sid, emptySiteRow(sid, siteNameById.get(sid) ?? `Site ${sid}`));
  }

  if (targetSiteIds.length === 0) {
    return {
      reportDate: new Date().toISOString().slice(0, 10),
      orgWide: emptySiteRow(0, "Organisation-wide"),
      bySite: [],
    };
  }

  const siteIdFilter = inArray(assets.siteId, targetSiteIds);

  const [aggRows, woRows, alertRows, pipelineAssets] = await Promise.all([
    database
      .select({
        siteId: assets.siteId,
        operationalAssetCount: sql<number>`count(*)`.mapWith(Number),
        totalBookValue: sql<number>`coalesce(sum(${bookValueSql}), 0)`.mapWith(Number),
      })
      .from(assets)
      .where(and(eq(assets.status, "operational"), siteIdFilter))
      .groupBy(assets.siteId),
    database
      .select({
        siteId: workOrders.siteId,
        days0to7: sql<number>`count(*) filter (where ${workOrders.updatedAt} >= now() - interval '7 days')`.mapWith(
          Number
        ),
        days8to14: sql<number>`count(*) filter (where ${workOrders.updatedAt} >= now() - interval '14 days' and ${workOrders.updatedAt} < now() - interval '7 days')`.mapWith(
          Number
        ),
        days15to30: sql<number>`count(*) filter (where ${workOrders.updatedAt} >= now() - interval '30 days' and ${workOrders.updatedAt} < now() - interval '14 days')`.mapWith(
          Number
        ),
        days30plus: sql<number>`count(*) filter (where ${workOrders.updatedAt} < now() - interval '30 days')`.mapWith(
          Number
        ),
      })
      .from(workOrders)
      .where(
        and(notInArray(workOrders.status, ["completed", "cancelled"]), inArray(workOrders.siteId, targetSiteIds))
      )
      .groupBy(workOrders.siteId),
    database
      .select({
        siteId: inventoryItems.siteId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(inventoryItems)
      .where(
        and(
          sql`${inventoryItems.currentStock} < ${inventoryItems.minStockLevel}`,
          inArray(inventoryItems.siteId, targetSiteIds)
        )
      )
      .groupBy(inventoryItems.siteId),
    database
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
          siteIdFilter,
          sql`(
            (${assets.usefulLifeYears} is not null and ${assets.depreciationStartDate} is not null)
            or ${assets.yearAcquiredRegister} is not null
          )`
        )
      )
      .limit(PIPELINE_CANDIDATE_LIMIT),
  ]);

  for (const agg of aggRows) {
    const row = siteMap.get(agg.siteId);
    if (!row) continue;
    row.operationalAssetCount = Number(agg.operationalAssetCount ?? 0);
    row.totalBookValue = Number(agg.totalBookValue ?? 0);
  }

  for (const wo of woRows) {
    const row = siteMap.get(wo.siteId);
    if (!row) continue;
    row.openWorkOrdersByAge = {
      days0to7: Number(wo.days0to7 ?? 0),
      days8to14: Number(wo.days8to14 ?? 0),
      days15to30: Number(wo.days15to30 ?? 0),
      days30plus: Number(wo.days30plus ?? 0),
    };
  }

  for (const alert of alertRows) {
    const row = siteMap.get(alert.siteId);
    if (row) row.activeInventoryAlerts = Number(alert.count ?? 0);
  }

  for (const asset of pipelineAssets) {
    const row = siteMap.get(asset.siteId);
    if (!row) continue;
    const computed = computeAssetBookValue(asset as AssetRow);
    if (!computed || computed.usefulLifeYears <= 0) continue;
    const lifePct = computed.yearsElapsed / computed.usefulLifeYears;
    if (lifePct < 0.8) continue;
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

  const bySite = Array.from(siteMap.values())
    .map((row) => ({
      ...row,
      totalBookValue: Math.round(row.totalBookValue * 100) / 100,
      replacementPipeline: row.replacementPipeline.sort((a, b) => b.lifePercentUsed - a.lifePercentUsed),
    }))
    .sort((a, b) => a.siteName.localeCompare(b.siteName));

  const orgWide = bySite.reduce<FleetHealthSiteRow>(
    (acc, row) => {
      acc.operationalAssetCount += row.operationalAssetCount;
      acc.totalBookValue += row.totalBookValue;
      acc.endOfLifeCount += row.endOfLifeCount;
      acc.replacementPipeline.push(...row.replacementPipeline);
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
