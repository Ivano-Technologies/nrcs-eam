import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import {
  assets,
  branchScorecardSnapshots,
  sites,
  verificationCampaigns,
  workOrders,
} from "../../drizzle/schema";
import { getDb, getLowStockItems } from "../db";
import { buildFleetHealthSummary } from "./fleetHealth";
import { getCampaignProgressInternal } from "../reports/verificationProgress";
import { buildExpiryHorizonBuckets } from "../wms/expiryHorizon";

/**
 * Composite branch score weights (must sum to 1.0).
 * verification: 25% — % assets verified in latest closed campaign
 * maintenance: 25% — inverse of overdue work order burden
 * stockAlerts: 20% — inverse of low-stock alert count
 * expiry: 15% — inverse of 30-day expiry exposure
 * assetHealth: 15% — inverse of end-of-life pipeline ratio
 */
export const BRANCH_SCORECARD_WEIGHTS = {
  verification: 0.25,
  maintenance: 0.25,
  stockAlerts: 0.2,
  expiry: 0.15,
  assetHealth: 0.15,
} as const;

export type BranchScorecardRow = {
  branchId: number;
  branchName: string;
  assetCount: number;
  bookValue: number;
  verificationPercent: number;
  openWorkOrders: number;
  overdueWorkOrders: number;
  stockAlerts: number;
  expiryExposure30Day: number;
  compositeScore: number;
  trendVsPriorMonth: number | null;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

export function computeCompositeScore(metrics: {
  verificationPercent: number;
  overdueWorkOrders: number;
  openWorkOrders: number;
  stockAlerts: number;
  expiryExposure30Day: number;
  endOfLifeCount: number;
  assetCount: number;
}): number {
  const w = BRANCH_SCORECARD_WEIGHTS;
  const verificationScore = metrics.verificationPercent;
  const maintenanceScore =
    metrics.openWorkOrders === 0
      ? 100
      : clampScore(100 - (metrics.overdueWorkOrders / Math.max(metrics.openWorkOrders, 1)) * 100);
  const stockScore = clampScore(100 - Math.min(metrics.stockAlerts * 5, 100));
  const expiryScore = clampScore(100 - Math.min(metrics.expiryExposure30Day / 10, 100));
  const eolRatio = metrics.assetCount > 0 ? metrics.endOfLifeCount / metrics.assetCount : 0;
  const assetHealthScore = clampScore(100 - eolRatio * 100);

  return clampScore(
    verificationScore * w.verification +
      maintenanceScore * w.maintenance +
      stockScore * w.stockAlerts +
      expiryScore * w.expiry +
      assetHealthScore * w.assetHealth
  );
}

export async function buildBranchScorecardList(): Promise<BranchScorecardRow[]> {
  const db = await getDb();
  if (!db) return [];

  const branches = await db
    .select({ id: sites.id, name: sites.name })
    .from(sites)
    .where(and(eq(sites.facilityType, "branch"), eq(sites.isActive, true)));

  const fleet = await buildFleetHealthSummary();
  const expiry = await buildExpiryHorizonBuckets();
  const expiry30ByWarehouse = new Map<number, number>();
  for (const b of expiry.buckets) {
    if (b.bucket === "30") {
      expiry30ByWarehouse.set(
        b.warehouseId,
        (expiry30ByWarehouse.get(b.warehouseId) ?? 0) + b.quantity
      );
    }
  }

  const [latestClosed] = await db
    .select()
    .from(verificationCampaigns)
    .where(eq(verificationCampaigns.status, "closed"))
    .orderBy(desc(verificationCampaigns.endsAt))
    .limit(1);

  let verificationBySite = new Map<number, number>();
  if (latestClosed) {
    const progress = await getCampaignProgressInternal(db, latestClosed.id);
    verificationBySite = new Map(progress.perSite.map((s) => [s.siteId, s.percent]));
  }

  const openWoRows = await db
    .select({
      siteId: workOrders.siteId,
      updatedAt: workOrders.updatedAt,
    })
    .from(workOrders)
    .where(notInArray(workOrders.status, ["completed", "cancelled"]));

  const woBySite = new Map<number, { open: number; overdue: number }>();
  for (const wo of openWoRows) {
    const entry = woBySite.get(wo.siteId) ?? { open: 0, overdue: 0 };
    entry.open += 1;
    const days = Math.floor((Date.now() - wo.updatedAt.getTime()) / 86400000);
    if (days > 14) entry.overdue += 1;
    woBySite.set(wo.siteId, entry);
  }

  const priorMonth = new Date();
  priorMonth.setUTCMonth(priorMonth.getUTCMonth() - 1);
  const priorKey = `${priorMonth.getUTCFullYear()}-${String(priorMonth.getUTCMonth() + 1).padStart(2, "0")}`;
  const priorSnapshots = await db
    .select()
    .from(branchScorecardSnapshots)
    .where(eq(branchScorecardSnapshots.month, priorKey));
  const priorByBranch = new Map(priorSnapshots.map((s) => [s.branchId, Number(s.compositeScore)]));

  const rows: BranchScorecardRow[] = [];
  for (const branch of branches) {
    const fleetRow = fleet.bySite.find((s) => s.siteId === branch.id);
    const assetCount = fleetRow?.operationalAssetCount ?? 0;
    const bookValue = fleetRow?.totalBookValue ?? 0;
    const endOfLife = fleetRow?.endOfLifeCount ?? 0;
    const wo = woBySite.get(branch.id) ?? { open: 0, overdue: 0 };
    const stockAlerts = (await getLowStockItems(branch.id)).length;
    const expiryExposure = expiry30ByWarehouse.get(branch.id) ?? 0;
    const verificationPercent = verificationBySite.get(branch.id) ?? 0;

    const compositeScore = computeCompositeScore({
      verificationPercent,
      overdueWorkOrders: wo.overdue,
      openWorkOrders: wo.open,
      stockAlerts,
      expiryExposure30Day: expiryExposure,
      endOfLifeCount: endOfLife,
      assetCount: Math.max(assetCount, 1),
    });

    const prior = priorByBranch.get(branch.id);
    rows.push({
      branchId: branch.id,
      branchName: branch.name,
      assetCount,
      bookValue,
      verificationPercent,
      openWorkOrders: wo.open,
      overdueWorkOrders: wo.overdue,
      stockAlerts,
      expiryExposure30Day: expiryExposure,
      compositeScore,
      trendVsPriorMonth: prior != null ? compositeScore - prior : null,
    });
  }

  return rows.sort((a, b) => b.compositeScore - a.compositeScore);
}

export async function writeBranchScorecardSnapshots(): Promise<{ written: number }> {
  const db = await getDb();
  if (!db) return { written: 0 };
  const list = await buildBranchScorecardList();
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  let written = 0;
  for (const row of list) {
    await db
      .insert(branchScorecardSnapshots)
      .values({
        branchId: row.branchId,
        month,
        metrics: row,
        compositeScore: String(row.compositeScore),
      })
      .onConflictDoUpdate({
        target: [branchScorecardSnapshots.branchId, branchScorecardSnapshots.month],
        set: {
          metrics: row,
          compositeScore: String(row.compositeScore),
        },
      });
    written += 1;
  }
  return { written };
}
