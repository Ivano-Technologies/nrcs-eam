import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  assetCategories,
  assetTransfers,
  assets,
  requisitions,
  sites,
  stockCards,
  stockMovements,
  stockSettings,
  commodityTrackingNumbers,
} from "../../drizzle/schema";
import { getDb, getLowStockItems } from "../db";
import { buildStockReadiness } from "../wms/dashboard";

export type BranchSummaryReport = {
  branchName: string;
  reportDate: string;
  assetCount: number;
  assetsByCategory: { category: string; count: number; totalValue: number; depreciatedValue: number }[];
  stockReadiness: { percentage: number; adequateCount: number; totalFacilities: number };
  pendingRequisitions: { total: number; urgent: number; oldestDays: number };
  lowStockItems: { itemName: string; currentStock: number; reorderPoint: number }[];
  /** Rows not shown in `lowStockItems` (capped for one-page PDF). */
  lowStockMoreCount: number;
  recentActivity: { date: string; action: string; user: string }[];
};

export async function buildBranchSummaryReport(opts: {
  siteId: number;
  consolidated?: boolean;
  user?: { id: number; role: string };
}): Promise<BranchSummaryReport> {
  const database = await getDb();
  if (!database) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  }

  const [site] = await database.select().from(sites).where(eq(sites.id, opts.siteId)).limit(1);
  if (!site) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Facility not found" });
  }

  const consolidated = Boolean(opts.consolidated);
  if (consolidated && site.facilityType !== "national_headquarters") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Consolidated report is only available when the selected site is national headquarters.",
    });
  }

  let targetSiteIds: number[] = [opts.siteId];
  let branchName = site.name;
  if (consolidated) {
    const branches = await database
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.facilityType, "branch"));
    targetSiteIds = branches.map((b) => b.id);
    branchName = `${site.name} — All branches (consolidated)`;
  }

  if (targetSiteIds.length === 0) {
    const reportDate = new Date().toISOString().slice(0, 10);
    return {
      branchName,
      reportDate,
      assetCount: 0,
      assetsByCategory: [],
      stockReadiness: { percentage: 0, adequateCount: 0, totalFacilities: 0 },
      pendingRequisitions: { total: 0, urgent: 0, oldestDays: 0 },
      lowStockItems: [],
      lowStockMoreCount: 0,
      recentActivity: [],
    };
  }

  const reportDate = new Date().toISOString().slice(0, 10);

  const catRows = await database
    .select({
      category: sql<string>`coalesce(${assetCategories.name}, ${assets.itemCategory}, 'Uncategorised')`,
      count: sql<number>`count(*)::int`.mapWith(Number),
      totalValue: sql<string>`coalesce(sum(${assets.actualUnitValue}), 0)`,
      depValue: sql<string>`coalesce(sum(${assets.depreciatedValue}), 0)`,
    })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .where(inArray(assets.siteId, targetSiteIds))
    .groupBy(sql`coalesce(${assetCategories.name}, ${assets.itemCategory}, 'Uncategorised')`);

  const assetsByCategory = catRows.map((r) => ({
    category: r.category,
    count: Number(r.count ?? 0),
    totalValue: Math.round(Number(r.totalValue ?? 0) * 100) / 100,
    depreciatedValue: Math.round(Number(r.depValue ?? 0) * 100) / 100,
  }));

  const [assetCountRow] = await database
    .select({ c: sql<number>`count(*)::int`.mapWith(Number) })
    .from(assets)
    .where(inArray(assets.siteId, targetSiteIds));

  const movementTotals = database
    .select({
      stockCardId: stockMovements.stockCardId,
      netQuantity: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number).as("netQuantity"),
    })
    .from(stockMovements)
    .groupBy(stockMovements.stockCardId)
    .as("movement_totals_branch_summary");

  const scoreSite =
    targetSiteIds.length === 1 ? eq(stockCards.locationId, targetSiteIds[0]!) : inArray(stockCards.locationId, targetSiteIds);

  const [scoreAgg] = await database
    .select({
      total: sql<number>`count(distinct ${stockCards.id})`.mapWith(Number),
      adequate: sql<number>`count(distinct ${stockCards.id}) filter (where coalesce(${movementTotals.netQuantity}, 0) > coalesce(${stockSettings.minLevel}, 0))`.mapWith(Number),
    })
    .from(stockCards)
    .leftJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .leftJoin(
      stockSettings,
      and(
        eq(stockSettings.catalogueId, commodityTrackingNumbers.itemId),
        eq(stockSettings.warehouseId, stockCards.locationId)
      )
    )
    .leftJoin(movementTotals, eq(movementTotals.stockCardId, stockCards.id))
    .where(scoreSite);

  const adequate = Number(scoreAgg?.adequate ?? 0);
  const totalCards = Number(scoreAgg?.total ?? 0);
  const readiness = buildStockReadiness({
    adequate,
    total: Math.max(totalCards, 1),
    previousAdequate: adequate,
  });
  const percentage =
    totalCards > 0 ? Math.round((adequate / totalCards) * 100) : Math.round((readiness.adequate / Math.max(readiness.total, 1)) * 100);

  const siteReqFilter = inArray(requisitions.requestingFacility, targetSiteIds);
  const [pendRow] = await database
    .select({
      total: sql<number>`count(*)::int`.mapWith(Number),
      urgent: sql<number>`count(*) filter (where lower(${requisitions.priority}) = 'urgent')::int`.mapWith(Number),
      oldest: sql<Date | null>`min(${requisitions.createdAt})`,
    })
    .from(requisitions)
    .where(and(sql`${requisitions.status} in ('submitted', 'approved')`, siteReqFilter));

  const oldest = pendRow?.oldest ? new Date(pendRow.oldest) : null;
  const oldestDays =
    oldest === null ? 0 : Math.max(0, Math.floor((Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24)));

  const lowChunks = await Promise.all(targetSiteIds.map((sid) => getLowStockItems(sid)));
  const lowFlat = lowChunks.flat();
  const lowStockItems = lowFlat.slice(0, 10).map((row) => ({
    itemName: row.name ?? "Item",
    currentStock: Number(row.currentStock ?? 0),
    reorderPoint: Number(row.reorderPoint ?? row.minStockLevel ?? 0),
  }));
  const lowStockMoreCount = Math.max(0, lowFlat.length - lowStockItems.length);

  const siteMove = scoreSite;
  const recentMovementRows = await database
    .select({
      type: stockMovements.sourceType,
      description: stockMovements.documentRef,
      timestamp: stockMovements.createdAt,
      facilityName: sites.name,
    })
    .from(stockMovements)
    .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
    .innerJoin(sites, eq(stockCards.locationId, sites.id))
    .where(and(sql`${stockMovements.sourceType} in ('grn', 'waybill')`, siteMove))
    .orderBy(desc(stockMovements.createdAt))
    .limit(10);

  const recentRequisitionRows = await database
    .select({
      type: sql<string>`'requisition'`,
      description: sql<string>`case
        when ${requisitions.status} = 'approved' then concat('Requisition approved · ', ${requisitions.reqNumber})
        else concat('Requisition submitted · ', ${requisitions.reqNumber})
      end`,
      timestamp: sql<Date>`coalesce(${requisitions.approvedHqAt}, ${requisitions.approvedBranchAt}, ${requisitions.createdAt})`,
      facilityName: sites.name,
    })
    .from(requisitions)
    .innerJoin(sites, eq(requisitions.requestingFacility, sites.id))
    .where(and(sql`${requisitions.status} in ('submitted', 'approved')`, siteReqFilter))
    .orderBy(
      desc(sql`coalesce(${requisitions.approvedHqAt}, ${requisitions.approvedBranchAt}, ${requisitions.createdAt})`)
    )
    .limit(10);

  const siteAsset = inArray(assets.siteId, targetSiteIds);
  const recentAssetRows = await database
    .select({
      type: sql<string>`'asset'`,
      description: sql<string>`concat('Asset created · ', ${assets.assetTag})`,
      timestamp: assets.createdAt,
      facilityName: sites.name,
    })
    .from(assets)
    .innerJoin(sites, eq(assets.siteId, sites.id))
    .where(siteAsset)
    .orderBy(desc(assets.createdAt))
    .limit(10);

  const siteXfer = inArray(assetTransfers.toSiteId, targetSiteIds);
  const recentTransferRows = await database
    .select({
      type: sql<string>`'asset_transfer'`,
      description: sql<string>`concat('Asset transferred · ', ${assets.assetTag})`,
      timestamp: sql<Date>`coalesce(${assetTransfers.transferDate}, ${assetTransfers.createdAt})`,
      facilityName: sites.name,
    })
    .from(assetTransfers)
    .innerJoin(assets, eq(assetTransfers.assetId, assets.id))
    .innerJoin(sites, eq(assetTransfers.toSiteId, sites.id))
    .where(siteXfer)
    .orderBy(desc(sql`coalesce(${assetTransfers.transferDate}, ${assetTransfers.createdAt})`))
    .limit(10);

  const merged = [...recentMovementRows, ...recentRequisitionRows, ...recentAssetRows, ...recentTransferRows]
    .filter((row) => row.timestamp)
    .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
    .slice(0, 8)
    .map((row) => {
      const desc =
        row.description != null && String(row.description).trim() !== ""
          ? String(row.description)
          : row.type === "grn"
            ? "Goods received posted"
            : row.type === "waybill"
              ? "Waybill posted"
              : "Activity recorded";
      return {
        date: new Date(row.timestamp!).toISOString().slice(0, 10),
        action: desc,
        user: row.facilityName ?? "—",
      };
    });

  return {
    branchName,
    reportDate,
    assetCount: Number(assetCountRow?.c ?? 0),
    assetsByCategory,
    stockReadiness: {
      percentage,
      adequateCount: adequate,
      totalFacilities: totalCards,
    },
    pendingRequisitions: {
      total: Number(pendRow?.total ?? 0),
      urgent: Number(pendRow?.urgent ?? 0),
      oldestDays,
    },
    lowStockItems,
    lowStockMoreCount,
    recentActivity: merged,
  };
}
