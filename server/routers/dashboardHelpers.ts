import { and, eq, gte, lte, sql } from "drizzle-orm";
import * as db from "../db";
import {
  assetTransfers,
  assets,
  commodityTrackingNumbers,
  requisitions,
  sites,
  stockCards,
  stockMovements,
  stockSettings,
} from "../../drizzle/schema";
import { withDashboardCache } from "../_core/cache";
import { withTimeout } from "../_core/withTimeout";
import { dashboardQueryQueue } from "../_core/dashboardQueryQueue";
import {
  DASHBOARD_QUERY_TIERS,
  sectionsForTier,
  tierForSection,
  type DashboardQueryTier,
  type DashboardSection,
} from "../_core/dashboardQueryPriority";
import {
  recordDashboardRequest,
  type DashboardRequestRecord,
  type TierLoadingState,
} from "../_core/dashboardRequestBuffer";
import type { TrpcContext } from "../_core/context";
import type { DashboardPeriod } from "../wms/dashboard";

/** Minimal caller surface used by tier/all orchestration (avoids circular typeof appRouter). */
export type DashboardAppCaller = {
  dashboard: {
    metrics: (input: { period: DashboardPeriod }) => Promise<DashboardMetricsPayload>;
    totalAssetValue: () => Promise<{ totalNgn: number; propertyNgn: number; movableNgn: number }>;
    stockMovement: (input: { weeks: number }) => Promise<StockMovementPoint[]>;
    facilityStatus: () => Promise<FacilityStatusRow[]>;
    recentActivity: (input: { limit: number }) => Promise<RecentActivityRow[]>;
    pendingRequisitions: (input: { limit: number }) => Promise<{
      total: number;
      urgent: number;
      oldestDaysAgo: number | null;
    }>;
    attentionItems: (input: { role: "Admin" | "Manager" | "Staff" | "Field" }) => Promise<
      DashboardAllOutput["attentionItems"]
    >;
    branchPerformance: () => Promise<DashboardAllOutput["branchPerformance"]>;
  };
};

export const DASHBOARD_EMPTY_METRICS = {
  lowStockItems: {
    value: 0,
    delta: undefined,
    direction: "flat" as const,
    goodWhen: "down" as const,
  },
  activeFacilities: { value: 0, total: 0, offline: 0, goodWhen: "up" as const },
  stockReadiness: {
    adequate: 0,
    total: 0,
    delta: 0,
    direction: "flat" as const,
    tone: "red" as const,
    goodWhen: "up" as const,
  },
  distributionVelocity: {
    value: 0,
    deltaPercent: 0,
    direction: "flat" as const,
    hasData: false,
    goodWhen: "up" as const,
  },
} as const;

export type DashboardMetricsPayload = {
  lowStockItems: {
    value: number;
    delta?: number;
    direction: "up" | "down" | "flat";
    goodWhen: "down";
  };
  activeFacilities: { value: number; total: number; offline: number; goodWhen: "up" };
  stockReadiness: {
    adequate: number;
    total: number;
    delta: number;
    direction: "up" | "down" | "flat";
    tone: "green" | "amber" | "red";
    goodWhen: "up";
  };
  distributionVelocity: {
    value: number;
    deltaPercent: number;
    direction: "up" | "down" | "flat";
    hasData: boolean;
    goodWhen: "up";
  };
};

export type DashboardAllOutput = {
  metrics: DashboardMetricsPayload;
  totalAssetValue: { totalNgn: number; propertyNgn: number; movableNgn: number };
  stockMovement: StockMovementPoint[];
  facilityStatus: FacilityStatusRow[];
  recentActivity: RecentActivityRow[];
  pendingRequisitions: { total: number; urgent: number; oldestDaysAgo: number | null };
  attentionItems: Array<{
    icon: string;
    tone: string;
    label: string;
    meta: string;
    href: string | null;
  }>;
  branchPerformance: Array<{
    id: number;
    name: string;
    code: string | null;
    isActive: boolean;
    stockScorePercent: number | null;
    adequateCards: number;
    totalCards: number;
  }>;
};

type DashboardDb = NonNullable<Awaited<ReturnType<typeof db.getDb>>>;

/** Active sites with no under-threshold stock cards (net balance vs min level). */
export async function countAdequatelyStockedActiveSites(
  database: DashboardDb,
  opts: { siteId?: number; asOfDate?: string }
): Promise<number> {
  const activeSiteWhere =
    opts.siteId != null ? and(eq(sites.isActive, true), eq(sites.id, opts.siteId)) : eq(sites.isActive, true);

  const movementDateFilter = opts.asOfDate ? lte(stockMovements.date, opts.asOfDate) : undefined;
  const [anyMovement] = await database
    .select({ id: stockMovements.id })
    .from(stockMovements)
    .where(movementDateFilter)
    .limit(1);
  if (!anyMovement) {
    const [siteCount] = await database
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(sites)
      .where(activeSiteWhere);
    return Number(siteCount?.count ?? 0);
  }

  const siteIdSql = opts.siteId != null ? sql`AND s.id = ${opts.siteId}` : sql``;
  const { isStockCardBalancesMvAvailable } = await import("../_core/stockCardBalancesMv");
  const useMv = !opts.asOfDate && (await isStockCardBalancesMvAvailable(database));

  if (useMv) {
    const rows = await database.execute(sql`
      WITH understock_locations AS (
        SELECT DISTINCT sc.location_id
        FROM stock_cards sc
        INNER JOIN commodity_tracking_numbers ctn ON sc.ctn_id = ctn.id
        LEFT JOIN stock_card_balances scb ON scb.stock_card_id = sc.id
        LEFT JOIN stock_settings ss
          ON ss.catalogue_id = ctn.item_id
          AND ss.warehouse_id = sc.location_id
        WHERE COALESCE(ss.min_level, sc.stock_minimum, 0) > 0
          AND COALESCE(scb.net_quantity, 0) < COALESCE(ss.min_level, sc.stock_minimum, 0)
      )
      SELECT COUNT(*)::int AS adequate
      FROM sites s
      WHERE s.is_active = TRUE
        ${siteIdSql}
        AND s.id NOT IN (SELECT location_id FROM understock_locations)
    `);
    const row = (Array.isArray(rows) ? rows[0] : undefined) as { adequate?: number } | undefined;
    return Number(row?.adequate ?? 0);
  }

  const movementDateSql = opts.asOfDate ? sql`AND sm.date <= ${opts.asOfDate}` : sql``;

  const rows = await database.execute(sql`
    WITH movement_net AS (
      SELECT
        sm.stock_card_id,
        COALESCE(SUM(sm.quantity_in - sm.quantity_out), 0) AS net_quantity
      FROM stock_movements sm
      WHERE TRUE ${movementDateSql}
      GROUP BY sm.stock_card_id
    ),
    understock_locations AS (
      SELECT DISTINCT sc.location_id
      FROM stock_cards sc
      INNER JOIN commodity_tracking_numbers ctn ON sc.ctn_id = ctn.id
      LEFT JOIN movement_net mn ON mn.stock_card_id = sc.id
      LEFT JOIN stock_settings ss
        ON ss.catalogue_id = ctn.item_id
        AND ss.warehouse_id = sc.location_id
      WHERE COALESCE(ss.min_level, sc.stock_minimum, 0) > 0
        AND COALESCE(mn.net_quantity, 0) < COALESCE(ss.min_level, sc.stock_minimum, 0)
    )
    SELECT COUNT(*)::int AS adequate
    FROM sites s
    WHERE s.is_active = TRUE
      ${siteIdSql}
      AND s.id NOT IN (SELECT location_id FROM understock_locations)
  `);

  const row = (Array.isArray(rows) ? rows[0] : undefined) as { adequate?: number } | undefined;
  return Number(row?.adequate ?? 0);
}

export type DashboardDataScope =
  | { mode: "all" }
  | { mode: "site"; siteId: number }
  | { mode: "empty" };

/** Staff/Field see only their assigned facility; admin/manager see org-wide. */
export function dashboardDataScope(ctx: { user: { role: string; siteId: number | null } }): DashboardDataScope {
  const r = ctx.user.role;
  if (r === "admin" || r === "manager") return { mode: "all" };
  if ((r === "staff" || r === "field") && ctx.user.siteId != null) return { mode: "site", siteId: ctx.user.siteId };
  if (r === "staff" || r === "field") return { mode: "empty" };
  return { mode: "all" };
}

export function dashboardCacheScopeKey(scope: DashboardDataScope): string {
  return scope.mode === "site" ? `${scope.mode}:${scope.siteId}` : `${scope.mode}:all`;
}

export type FacilityStatusRow = {
  id: number;
  name: string;
  code: string | null;
  type: string;
  status: "active" | "offline";
  stockScore: number | null;
};

export async function queryFacilityStatus(ctx: { user: { role: string; siteId: number | null } }): Promise<FacilityStatusRow[]> {
  const scope = dashboardDataScope(ctx);
  if (scope.mode === "empty") return [];
  return withDashboardCache(
    `dashboard:facilityStatus:${dashboardCacheScopeKey(scope)}`,
    300,
    async () => {
  const siteId = scope.mode === "site" ? scope.siteId : undefined;
  const database = await db.getDb();
  if (!database) return [];

  const rows = await database
    .select({
      id: sites.id,
      name: sites.name,
      code: sites.code,
      type: sites.facilityType,
      isActive: sites.isActive,
    })
    .from(sites)
    .where(siteId != null ? eq(sites.id, siteId) : sql`true`)
    .orderBy(sql`${sites.facilityType} asc, ${sites.name} asc`)
    .limit(siteId != null ? 1 : 10);

  const sortFacilities = (items: FacilityStatusRow[]) =>
    items.sort((a, b) => {
      if (a.stockScore === null && b.stockScore === null) return 0;
      if (a.stockScore === null) return 1;
      if (b.stockScore === null) return -1;
      return a.stockScore - b.stockScore;
    });

  const [anyMovement] = await database.select({ id: stockMovements.id }).from(stockMovements).limit(1);
  if (!anyMovement) {
    return sortFacilities(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        type: row.type,
        status: row.isActive ? ("active" as const) : ("offline" as const),
        stockScore: null,
      }))
    );
  }

  const movementTotals = database
    .select({
      stockCardId: stockMovements.stockCardId,
      netQuantity: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number).as("netQuantity"),
    })
    .from(stockMovements)
    .groupBy(stockMovements.stockCardId)
    .as("movement_totals");

  const scoreSite = siteId != null ? eq(stockCards.locationId, siteId) : sql`true`;
  const scoreRows = await database
    .select({
      locationId: stockCards.locationId,
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
    .where(scoreSite)
    .groupBy(stockCards.locationId);

  const scoreByLocation = new Map<number, { total: number; adequate: number }>();
  for (const row of scoreRows) {
    scoreByLocation.set(row.locationId, {
      total: Number(row.total ?? 0),
      adequate: Number(row.adequate ?? 0),
    });
  }

  return sortFacilities(
    rows.map((row) => {
      const score = scoreByLocation.get(row.id);
      const stockScore = score && score.total > 0 ? Math.round((score.adequate / score.total) * 100) : null;
      return {
        id: row.id,
        name: row.name,
        code: row.code,
        type: row.type,
        status: row.isActive ? ("active" as const) : ("offline" as const),
        stockScore,
      };
    })
  );
    }
  );
}

export type StockMovementPoint = { w: string; inbound: number; outbound: number };

export async function queryStockMovement(
  ctx: { user: { role: string; siteId: number | null } },
  weeks: number
): Promise<StockMovementPoint[]> {
  const scope = dashboardDataScope(ctx);
  if (scope.mode === "empty") return [];
  return withDashboardCache(
    `dashboard:stockMovement:${dashboardCacheScopeKey(scope)}:${weeks}`,
    600,
    async () => {
  const siteId = scope.mode === "site" ? scope.siteId : undefined;
  const database = await db.getDb();
  if (!database) return [];

  const [anyMovement] = await database.select({ id: stockMovements.id }).from(stockMovements).limit(1);
  if (!anyMovement) return [];

  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - (weeks * 7 - 1));
  const startDateIso = startDate.toISOString().slice(0, 10);

  const siteCard = siteId != null ? eq(stockCards.locationId, siteId) : sql`true`;
  const rows = await database
    .select({
      weekStart: sql<string>`to_char(date_trunc('week', ${stockMovements.date}::timestamp), 'YYYY-MM-DD')`,
      inbound: sql<number>`coalesce(sum(${stockMovements.quantityIn}), 0)`.mapWith(Number),
      outbound: sql<number>`coalesce(sum(${stockMovements.quantityOut}), 0)`.mapWith(Number),
    })
    .from(stockMovements)
    .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
    .where(and(gte(stockMovements.date, startDateIso), siteCard))
    .groupBy(sql`date_trunc('week', ${stockMovements.date}::timestamp)`)
    .orderBy(sql`date_trunc('week', ${stockMovements.date}::timestamp) asc`);

  return rows.map((row) => ({
    w: row.weekStart,
    inbound: Number(row.inbound ?? 0),
    outbound: Number(row.outbound ?? 0),
  }));
    }
  );
}

export type RecentActivityRow = {
  type: string;
  description: string;
  timestamp: string;
  facilityName: string;
};

export async function queryRecentActivity(
  ctx: { user: { role: string; siteId: number | null } },
  limit: number
): Promise<RecentActivityRow[]> {
  const scope = dashboardDataScope(ctx);
  if (scope.mode === "empty") return [];
  return withDashboardCache(
    `dashboard:recentActivity:${dashboardCacheScopeKey(scope)}:${limit}`,
    120,
    async () => {
  const siteId = scope.mode === "site" ? scope.siteId : undefined;
  const database = await db.getDb();
  if (!database) return [];

  const siteMove = siteId != null ? eq(stockCards.locationId, siteId) : sql`true`;
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
    .orderBy(sql`${stockMovements.createdAt} desc`)
    .limit(10);

  const siteReq = siteId != null ? eq(requisitions.requestingFacility, siteId) : sql`true`;
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
    .where(and(sql`${requisitions.status} in ('submitted', 'approved')`, siteReq))
    .orderBy(sql`coalesce(${requisitions.approvedHqAt}, ${requisitions.approvedBranchAt}, ${requisitions.createdAt}) desc`)
    .limit(10);

  const siteAsset = siteId != null ? eq(assets.siteId, siteId) : sql`true`;
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
    .orderBy(sql`${assets.createdAt} desc`)
    .limit(10);

  const siteXfer = siteId != null ? eq(assetTransfers.toSiteId, siteId) : sql`true`;
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
    .orderBy(sql`coalesce(${assetTransfers.transferDate}, ${assetTransfers.createdAt}) desc`)
    .limit(10);

  return [...recentMovementRows, ...recentRequisitionRows, ...recentAssetRows, ...recentTransferRows]
    .filter((row) => row.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
    .map((row) => ({
      type: String(row.type),
      description: row.description
        ? String(row.description)
        : row.type === "grn"
          ? "Goods received posted"
          : row.type === "waybill"
            ? "Waybill posted"
            : "Activity recorded",
      timestamp: new Date(row.timestamp).toISOString(),
      facilityName: row.facilityName ?? "Unknown facility",
    }));
    }
  );
}

export async function queryPendingRequisitions(ctx: { user: { role: string; siteId: number | null } }) {
  const scope = dashboardDataScope(ctx);
  if (scope.mode === "empty") return { total: 0, urgent: 0, oldestDaysAgo: null as number | null };
  return withDashboardCache(
    `dashboard:pendingRequisitions:${dashboardCacheScopeKey(scope)}`,
    120,
    async () => {
  const siteId = scope.mode === "site" ? scope.siteId : undefined;
  const database = await db.getDb();
  if (!database) return { total: 0, urgent: 0, oldestDaysAgo: null as number | null };

  const siteReq = siteId != null ? eq(requisitions.requestingFacility, siteId) : sql`true`;
  const rows = await database
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      urgent: sql<number>`count(*) filter (where lower(${requisitions.priority}) = 'urgent')`.mapWith(Number),
      oldest: sql<Date | null>`min(${requisitions.createdAt})`,
    })
    .from(requisitions)
    .where(
      and(
        sql`${requisitions.status} in ('submitted', 'branch_approved', 'hq_approved')`,
        siteReq
      )
    );

  const summary = rows[0];
  const total = Number(summary?.total ?? 0);
  const urgent = Number(summary?.urgent ?? 0);
  const oldest = summary?.oldest ? new Date(summary.oldest) : null;
  const oldestDaysAgo =
    oldest === null ? null : Math.max(0, Math.floor((Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24)));

  return { total, urgent, oldestDaysAgo };
    }
  );
}

const DASHBOARD_ALL_CLEAR_ATTENTION = [
  {
    icon: "CheckCircle2",
    tone: "green",
    label: "No action items right now",
    meta: "All clear",
    href: null as string | null,
  },
] as const;

type DashboardAllInput = {
  period: DashboardPeriod;
  role: "Admin" | "Manager" | "Staff" | "Field";
  stockMovementWeeks: number;
};

function emptyDashboardAllOutput(includeBranch: boolean): DashboardAllOutput {
  return {
    metrics: { ...DASHBOARD_EMPTY_METRICS },
    totalAssetValue: { totalNgn: 0, propertyNgn: 0, movableNgn: 0 },
    stockMovement: [],
    facilityStatus: [],
    recentActivity: [],
    pendingRequisitions: { total: 0, urgent: 0, oldestDaysAgo: null },
    attentionItems: [...DASHBOARD_ALL_CLEAR_ATTENTION],
    branchPerformance: includeBranch ? [] : [],
  };
}

type SectionFailureTracker = {
  timedOutSections: string[];
  failedSections: string[];
};

async function runQueuedDashboardSection(
  caller: DashboardAppCaller,
  input: DashboardAllInput,
  section: DashboardSection,
  includeBranch: boolean,
  failures?: SectionFailureTracker
): Promise<Partial<DashboardAllOutput>> {
  if (section === "branchPerformance" && !includeBranch) {
    return { branchPerformance: [] };
  }

  const priority = tierForSection(section);
  const enqueuedAt = Date.now();

  let sectionFailed = false;
  let sectionTimedOut = false;

  const sectionResult = await dashboardQueryQueue.enqueue(
    priority,
    async () => {
      try {
        switch (section) {
          case "metrics":
            return await withTimeout(caller.dashboard.metrics({ period: input.period }), 8000, "metrics");
          case "totalAssetValue":
            return await withTimeout(caller.dashboard.totalAssetValue(), 8000, "totalAssetValue");
          case "stockMovement":
            return await withTimeout(
              caller.dashboard.stockMovement({ weeks: input.stockMovementWeeks }),
              8000,
              "stockMovement"
            );
          case "facilityStatus":
            return await withTimeout(caller.dashboard.facilityStatus(), 8000, "facilityStatus");
          case "recentActivity":
            return await withTimeout(caller.dashboard.recentActivity({ limit: 5 }), 8000, "recentActivity");
          case "pendingRequisitions":
            return await withTimeout(caller.dashboard.pendingRequisitions({ limit: 4 }), 8000, "pendingRequisitions");
          case "attentionItems":
            return await withTimeout(caller.dashboard.attentionItems({ role: input.role }), 8000, "attentionItems");
          case "branchPerformance":
            return await withTimeout(caller.dashboard.branchPerformance(), 8000, "branchPerformance");
          default:
            throw new Error(`Unknown dashboard section: ${section satisfies never}`);
        }
      } catch (err) {
        sectionFailed = true;
        const msg = err instanceof Error ? err.message : String(err);
        sectionTimedOut = msg.startsWith("timeout:") || msg === "metrics_timeout";
        console.warn(
          JSON.stringify({
            event: "dashboard_all_section_failed",
            section,
            err: msg,
            timedOut: sectionTimedOut,
          })
        );
        const empty = emptyDashboardAllOutput(includeBranch);
        return empty[section];
      }
    },
    section
  );

  if (sectionFailed && failures) {
    if (sectionTimedOut) failures.timedOutSections.push(section);
    else failures.failedSections.push(section);
  }

  const waitMs = Date.now() - enqueuedAt;
  if (waitMs > 50) {
    console.log(
      JSON.stringify({
        event: "dashboard_section_dequeued",
        section,
        waitMs,
        priority,
        queue: dashboardQueryQueue.getStats(),
      })
    );
  }

  return { [section]: sectionResult } as Partial<DashboardAllOutput>;
}

type TierLoadResult = {
  data: Partial<DashboardAllOutput>;
  durationMs: number;
  timedOutSections: string[];
  failedSections: string[];
};

function tierLoadingState(
  tier: DashboardQueryTier,
  timedOut: string[],
  failed: string[]
): TierLoadingState {
  const sections = sectionsForTier(tier);
  const hasTimeout = sections.some((s) => timedOut.includes(s));
  const hasFailed = sections.some((s) => failed.includes(s));
  if (hasTimeout) return "timeout";
  if (hasFailed) return "failed";
  return "complete";
}

export async function loadDashboardTier(
  ctx: TrpcContext,
  input: DashboardAllInput & { tier: DashboardQueryTier }
): Promise<TierLoadResult> {
  const { appRouter } = await import("../routers");
  const caller = appRouter.createCaller(ctx);
  const includeBranch = ctx.user?.role === "admin" || ctx.user?.role === "manager";
  const tierStarted = Date.now();
  const sections = sectionsForTier(input.tier);
  const failures: SectionFailureTracker = { timedOutSections: [], failedSections: [] };
  const parts = await Promise.all(
    sections.map((section) =>
      runQueuedDashboardSection(caller, input, section, includeBranch, failures)
    )
  );
  const merged = Object.assign({}, ...parts) as Partial<DashboardAllOutput>;
  const durationMs = Date.now() - tierStarted;
  console.log(
    JSON.stringify({
      event: "dashboard_tier_complete",
      tier: input.tier,
      durationMs,
      sections,
      queue: dashboardQueryQueue.getStats(),
      timedOutSections: failures.timedOutSections,
    })
  );
  return {
    data: merged,
    durationMs,
    timedOutSections: failures.timedOutSections,
    failedSections: failures.failedSections,
  };
}

export function buildDashboardRequestRecord(params: {
  source: DashboardRequestRecord["source"];
  wallClockMs: number;
  tier1: TierLoadResult | null;
  tier2: TierLoadResult | null;
  tier3: TierLoadResult | null;
  userId: number;
}): DashboardRequestRecord {
  const allTimedOut = [
    ...(params.tier1?.timedOutSections ?? []),
    ...(params.tier2?.timedOutSections ?? []),
    ...(params.tier3?.timedOutSections ?? []),
  ];
  return {
    source: params.source,
    wallClockMs: params.wallClockMs,
    tier1Ms: params.tier1?.durationMs ?? null,
    tier2Ms: params.tier2?.durationMs ?? null,
    tier3Ms: params.tier3?.durationMs ?? null,
    timedOutSections: allTimedOut,
    userId: String(params.userId),
    timestamp: new Date().toISOString(),
    loadingState: {
      tier1: params.tier1
        ? tierLoadingState(DASHBOARD_QUERY_TIERS.TIER_1, params.tier1.timedOutSections, params.tier1.failedSections)
        : "complete",
      tier2: params.tier2
        ? tierLoadingState(DASHBOARD_QUERY_TIERS.TIER_2, params.tier2.timedOutSections, params.tier2.failedSections)
        : "complete",
      tier3: params.tier3
        ? tierLoadingState(DASHBOARD_QUERY_TIERS.TIER_3, params.tier3.timedOutSections, params.tier3.failedSections)
        : "complete",
    },
  };
}

/** Runs after `appRouter` is defined — avoids circular type inference from createCaller inside the router. */
export async function loadDashboardAll(
  ctx: TrpcContext,
  input: DashboardAllInput
): Promise<DashboardAllOutput> {
  const includeBranch = ctx.user?.role === "admin" || ctx.user?.role === "manager";
  const empty = emptyDashboardAllOutput(includeBranch);
  const allStarted = Date.now();

  const tier1Result = await loadDashboardTier(ctx, { ...input, tier: DASHBOARD_QUERY_TIERS.TIER_1 });
  const tier2Result = await loadDashboardTier(ctx, { ...input, tier: DASHBOARD_QUERY_TIERS.TIER_2 });
  const tier3Result = await loadDashboardTier(ctx, { ...input, tier: DASHBOARD_QUERY_TIERS.TIER_3 });

  const wallClockMs = Date.now() - allStarted;
  console.log(
    JSON.stringify({
      event: "dashboard_all_complete",
      durationMs: wallClockMs,
      queue: dashboardQueryQueue.getStats(),
    })
  );

  if (ctx.user) {
    void recordDashboardRequest(
      buildDashboardRequestRecord({
        source: "all",
        wallClockMs,
        tier1: tier1Result,
        tier2: tier2Result,
        tier3: tier3Result,
        userId: ctx.user.id,
      })
    );
  }

  return {
    ...empty,
    ...tier1Result.data,
    ...tier2Result.data,
    ...tier3Result.data,
  };
}

