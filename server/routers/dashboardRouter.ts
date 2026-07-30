import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, exists, gte, ilike, inArray, lte, not, or, sql } from "drizzle-orm";
import { toPublicUser } from "../_core/sanitizeUser";
import { router, protectedProcedure, requireRole } from "../_core/trpc";
import {
  enforceFacilityScope,
  assertFacilityAccess,
  assertRecordFacilityAccess,
} from "../_core/facilityAccess";
import * as db from "../db";
import * as notificationHelper from "../notificationHelper";
import { generatePDFReport, generateExcelReport } from "../reportGenerator";
import { generateEmailTemplate, sendBulkEmails, sendEmail } from "../emailService";
import { AUDIT_ACTIONS, logAuditEvent } from "../_core/auditHelper";
import {
  adminProcedure,
  managerOrAdminProcedure,
  staffOrAboveProcedure,
} from "./roleProcedures";
import { observabilityRouter } from "./observabilityRouter";
import {
  countDonorReportsDueSoon,
  countGeneratorsOverdue,
  countVehiclesExpiringSoon,
} from "../complianceTrackingDb";
import { countInsuranceExpiringSoon } from "../financeModulesDb";
import { getSupabaseSecret } from "../_core/supabase";
import {
  assetTransfers,
  assets,
  auditLogs,
  commodityTrackingNumbers,
  goodsReceivedNotes,
  inventoryCounts,
  maintenanceSchedules,
  pendingUsers,
  requisitions,
  sites,
  stockCards,
  stockMovements,
  stockSettings,
  users,
  waybills,
} from "../../drizzle/schema";
import { buildDistributionVelocity, buildStockReadiness, getPeriodWindow } from "../wms/dashboard";
import { queryDistributionVelocityTotals } from "../wms/distributionVelocity";
import { cacheGetJson, cacheSetJson, withDashboardCache } from "../_core/cache";
import { withTimeout } from "../_core/withTimeout";
import { dashboardQueryQueue } from "../_core/dashboardQueryQueue";
import {
  DASHBOARD_QUERY_TIERS,
  priorityForMetricsSubquery,
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
import {
  legacyStatusFromRegister,
  registerStatusZodEnum,
} from "../assetRegister";
import { nanoid } from "nanoid";
import { generateSupabaseCompliantTempPassword } from "../tempPassword";
import { DASHBOARD_NAV } from "../../shared/dashboardNav";
import { FACILITY_TYPE_VALUES, type FacilityType } from "../../shared/facilities";
import type { InsertUser } from "../../drizzle/schema";
import { validateFacilityHierarchy } from "../facilityHierarchy";
import { calculateDepreciatedValue } from "../lib/depreciation";
import type { DepreciationResult } from "../depreciation";
import {
  DASHBOARD_EMPTY_METRICS,
  dashboardDataScope,
  dashboardCacheScopeKey,
  countAdequatelyStockedActiveSites,
  queryFacilityStatus,
  queryStockMovement,
  queryRecentActivity,
  queryPendingRequisitions,
  loadDashboardAll,
  loadDashboardTier,
  buildDashboardRequestRecord,
  type DashboardAllOutput,
} from "./dashboardHelpers";

export const dashboardRouter = router({
    /** @deprecated Not used in UI. Use dashboard.metrics instead. */
    stats: protectedProcedure.query(async ({ ctx }) => {
      const scope = dashboardDataScope(ctx);
      if (scope.mode === "empty") {
        return {
          totalAssets: 0,
          operationalAssets: 0,
          maintenanceAssets: 0,
          pendingWorkOrders: 0,
          inProgressWorkOrders: 0,
          lowStockItems: 0,
        };
      }
      const siteId = scope.mode === "site" ? scope.siteId : undefined;
      return await db.getDashboardStats(siteId ? { siteId } : undefined);
    }),
    /** @deprecated Not used in UI. Use dashboard.metrics instead. */
    weeklyInsights: protectedProcedure.query(async ({ ctx }) => {
      const scope = dashboardDataScope(ctx);
      if (scope.mode === "empty") {
        return {
          maintenanceDueNext30Days: 0,
          warrantiesExpiringNext30Days: 0,
          lowStockItems: 0,
          overdueWorkOrders: 0,
          pendingUserRequests: 0,
        };
      }
      const siteId = scope.mode === "site" ? scope.siteId : undefined;
      return await db.getWeeklyInsights(siteId ? { siteId } : undefined);
    }),
    /** @deprecated Not used in UI. Use dashboard.metrics instead. */
    smartInsights: protectedProcedure.query(async ({ ctx }) => {
      const scope = dashboardDataScope(ctx);
      if (scope.mode === "empty") {
        return {
          good: { stockAvailabilityPct: 0, successfulDistributions: 0 },
          attentionNeeded: {
            belowSafetyStock: 0,
            expiringWithin30Days: 0,
            emergencyRequisitionsPending: 0,
          },
          recommendations: {
            safetyStockAdjustments: [],
            overstockTransfers: [],
            deadStockReview: [],
          },
        };
      }
      const siteId = scope.mode === "site" ? scope.siteId : undefined;
      const opts = siteId ? { siteId } : undefined;
      const [stats, weekly, lowStock] = await Promise.all([
        db.getDashboardStats(opts),
        db.getWeeklyInsights(opts),
        db.getLowStockItems(siteId),
      ]);
      const totalInventory = Math.max(1, Number((stats as any)?.totalInventory ?? 0));
      const lowStockCount = Number((stats as any)?.lowStockItems ?? lowStock.length);
      const stockAvailabilityPct = ((totalInventory - lowStockCount) / totalInventory) * 100;
      const successfulDistributions = Number((weekly as any)?.lowStockItems ?? 0) >= 0 ? Number((weekly as any)?.lowStockItems ?? 0) : 0;

      return {
        good: {
          stockAvailabilityPct,
          successfulDistributions,
        },
        attentionNeeded: {
          belowSafetyStock: lowStockCount,
          expiringWithin30Days: Number((weekly as any)?.warrantiesExpiringNext30Days ?? 0),
          emergencyRequisitionsPending: 0,
        },
        recommendations: {
          safetyStockAdjustments: lowStock.slice(0, 10).map((x: any) => ({
            itemCode: x.itemCode ?? x.assetTag ?? "N/A",
            warehouseName: x.siteName ?? "N/A",
            current: x.currentStock ?? 0,
            safety: x.minStockLevel ?? 0,
          })),
          overstockTransfers: [],
          deadStockReview: [],
        },
      };
    }),
    metrics: protectedProcedure
      .input(
        z.object({
          period: z.enum(["Today", "Week", "Month", "Quarter", "Year"]),
        })
      )
      .query(async ({ input, ctx }) => {
        const scope = dashboardDataScope(ctx);
        if (scope.mode === "empty") {
          return {
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
          };
        }
        const siteId = scope.mode === "site" ? scope.siteId : undefined;
        const metricsCacheKey = `dashboard:metrics:${scope.mode}:${siteId ?? "all"}:${input.period}`;
        const cachedMetrics = await cacheGetJson<{
          lowStockItems: { value: number; delta?: number; direction: "up" | "down" | "flat"; goodWhen: "down" };
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
        }>(metricsCacheKey);
        if (cachedMetrics) return cachedMetrics;
        const stats = await db.getDashboardStats(siteId != null ? { siteId } : undefined);
        const database = await db.getDb();

        let stockReadiness: {
          adequate: number;
          total: number;
          delta: number;
          direction: "up" | "down" | "flat";
          tone: "green" | "amber" | "red";
          goodWhen: "up";
        } = {
          adequate: 0,
          total: 0,
          delta: 0,
          direction: "flat" as const,
          tone: "red" as const,
          goodWhen: "up" as const,
        };
        let distributionVelocity: {
          value: number;
          deltaPercent: number;
          direction: "up" | "down" | "flat";
          hasData: boolean;
          goodWhen: "up";
        } = {
          value: 0,
          deltaPercent: 0,
          direction: "flat" as const,
          hasData: false,
          goodWhen: "up" as const,
        };
        let activeFacilitiesKpi = { value: 0, total: 0, offline: 0, goodWhen: "up" as const };
        let metricsTimedOut = false;

        if (database) {
          const window = getPeriodWindow(input.period);
          const activeSiteWhere =
            siteId != null ? and(eq(sites.isActive, true), eq(sites.id, siteId)) : eq(sites.isActive, true);
          const totalSiteWhere = siteId != null ? eq(sites.id, siteId) : undefined;
          const inactiveSiteWhere =
            siteId != null ? and(eq(sites.isActive, false), eq(sites.id, siteId)) : eq(sites.isActive, false);
          const METRICS_TIMEOUT = 6_000;
          type MetricsBatch = [
            { id: number }[],
            { total: number }[],
            { total: number }[],
            number,
            number,
            { current: number; previous: number; historical: number },
          ];
          let metricsBatch: MetricsBatch;
          try {
            const q = dashboardQueryQueue;
            metricsBatch = await Promise.race([
              Promise.all([
                q.enqueue(priorityForMetricsSubquery("activeFacilities"), () =>
                  database.select({ id: sites.id }).from(sites).where(activeSiteWhere)
                ),
                q.enqueue(priorityForMetricsSubquery("totalFacilities"), () =>
                  siteId != null
                    ? database
                        .select({ total: sql<number>`count(*)`.mapWith(Number) })
                        .from(sites)
                        .where(eq(sites.id, siteId))
                    : database.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(sites)
                ),
                q.enqueue(priorityForMetricsSubquery("inactiveFacilities"), () =>
                  database
                    .select({ total: sql<number>`count(*)`.mapWith(Number) })
                    .from(sites)
                    .where(inactiveSiteWhere)
                ),
                q.enqueue(priorityForMetricsSubquery("adequateSites"), () =>
                  countAdequatelyStockedActiveSites(database, { siteId })
                ),
                q.enqueue(priorityForMetricsSubquery("previousAdequateSites"), () =>
                  countAdequatelyStockedActiveSites(database, { siteId, asOfDate: window.previousEndIso })
                ),
                q.enqueue(priorityForMetricsSubquery("distributionVelocity"), () =>
                  queryDistributionVelocityTotals(database, {
                    siteId,
                    currentStartIso: window.currentStartIso,
                    currentEndIso: window.currentEndIso,
                    previousStartIso: window.previousStartIso,
                    previousEndIso: window.previousEndIso,
                  })
                ),
              ]),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("metrics_timeout")), METRICS_TIMEOUT)
              ),
            ]);
          } catch (err) {
            metricsTimedOut = true;
            console.warn("[dashboard.metrics] metrics_timeout", {
              event: "metrics_timeout",
              siteId: siteId ?? null,
              period: input.period,
              err: err instanceof Error ? err.message : String(err),
            });
            metricsBatch = [[], [{ total: 0 }], [{ total: 0 }], 0, 0, { current: 0, previous: 0, historical: 0 }];
          }

          const [activeFacilities, totalFacilities, inactiveFacilities, adequate, previousAdequate, distTotals] =
            metricsBatch;

          const total = activeFacilities.length;
          stockReadiness = buildStockReadiness({ adequate, total, previousAdequate });

          const currentValue = distTotals.current;
          const previousValue = distTotals.previous;
          const historicalValue = distTotals.historical;
          distributionVelocity =
            siteId != null && currentValue === 0 && previousValue === 0 && historicalValue === 0
              ? {
                  value: 0,
                  deltaPercent: 0,
                  direction: "flat" as const,
                  hasData: false,
                  goodWhen: "up" as const,
                }
              : buildDistributionVelocity({
                  current: currentValue,
                  previous: previousValue,
                  historicalTotal: historicalValue,
                });

          activeFacilitiesKpi = {
            value: activeFacilities.length,
            total: Number(totalFacilities[0]?.total ?? 0),
            offline: Number(inactiveFacilities[0]?.total ?? 0),
            goodWhen: "up" as const,
          };
        }
        const metricsPayload = {
          lowStockItems: {
            value: Number(stats?.lowStockItems ?? 0),
            // Hide delta until there is a validated period-over-period low-stock query.
            delta: undefined,
            direction: "flat" as const,
            goodWhen: "down" as const,
          },
          activeFacilities: activeFacilitiesKpi,
          stockReadiness,
          distributionVelocity,
        };
        await cacheSetJson(metricsCacheKey, metricsPayload, metricsTimedOut ? 60 : 900);
        return metricsPayload;
      }),
    /** Single round-trip for dashboard page — one pool, sequential sections. */
    all: protectedProcedure
      .input(
        z.object({
          period: z.enum(["Today", "Week", "Month", "Quarter", "Year"]),
          role: z.enum(["Admin", "Manager", "Staff", "Field"]),
          stockMovementWeeks: z.number().min(4).max(26).default(12),
        })
      )
      .query(async ({ input, ctx }): Promise<DashboardAllOutput> => loadDashboardAll(ctx, input)),
    /** Progressive tier load — returns partial bundle for one tier (1=critical KPIs first). */
    byTier: protectedProcedure
      .input(
        z.object({
          period: z.enum(["Today", "Week", "Month", "Quarter", "Year"]),
          role: z.enum(["Admin", "Manager", "Staff", "Field"]),
          stockMovementWeeks: z.number().min(4).max(26).default(12),
          tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        })
      )
      .query(async ({ input, ctx }) => {
        const result = await loadDashboardTier(ctx, {
          period: input.period,
          role: input.role,
          stockMovementWeeks: input.stockMovementWeeks,
          tier: input.tier,
        });
        if (ctx.user) {
          void recordDashboardRequest(
            buildDashboardRequestRecord({
              source: "byTier",
              wallClockMs: result.durationMs,
              tier1: input.tier === 1 ? result : null,
              tier2: input.tier === 2 ? result : null,
              tier3: input.tier === 3 ? result : null,
              userId: ctx.user.id,
            })
          );
        }
        return { tier: input.tier, data: result.data };
      }),
    stockMovement: protectedProcedure
      .input(z.object({ weeks: z.number().min(4).max(26).default(12) }).optional())
      .query(async ({ input, ctx }) => {
        try {
          return await withTimeout(queryStockMovement(ctx, input?.weeks ?? 12), 8000, "stockMovement");
        } catch {
          return [];
        }
      }),
    recentActivity: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(20).default(5) }).optional())
      .query(async ({ input, ctx }) => {
        try {
          return await withTimeout(queryRecentActivity(ctx, input?.limit ?? 5), 8000, "recentActivity");
        } catch {
          return [];
        }
      }),
    facilityStatus: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await withTimeout(queryFacilityStatus(ctx), 5000, "facilityStatus");
      } catch (err) {
        console.warn(
          JSON.stringify({
            event: "dashboard_facility_status_failed",
            err: err instanceof Error ? err.message : String(err),
          })
        );
        return [];
      }
    }),
    pendingRequisitions: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(12).default(4) }).optional())
      .query(async ({ ctx }) => {
        try {
          return await withTimeout(queryPendingRequisitions(ctx), 8000, "pendingRequisitions");
        } catch {
          return { total: 0, urgent: 0, oldestDaysAgo: null as number | null };
        }
      }),

    /** Sum of register `actual_unit_value` for assets the user can see (org-wide for admin/manager; home site for staff/field). */
    totalAssetValue: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await withTimeout(
          (async () => {
            const scope = dashboardDataScope(ctx);
            if (scope.mode === "empty") return { totalNgn: 0, propertyNgn: 0, movableNgn: 0 };
            const cacheKey = `dashboard:totalAssetValue:${scope.mode}:${scope.mode === "site" ? scope.siteId : "all"}`;
            const cached = await cacheGetJson<{
              totalNgn: number;
              propertyNgn: number;
              movableNgn: number;
            }>(cacheKey);
            if (cached) return cached;
            const database = await db.getDb();
            if (!database) return { totalNgn: 0, propertyNgn: 0, movableNgn: 0 };
            const result =
              scope.mode === "all"
                ? await db.getDashboardTotalAssetValue({ mode: "all" })
                : await db.getDashboardTotalAssetValue({ mode: "site", siteId: scope.siteId });
            await cacheSetJson(cacheKey, result, 1800);
            return result;
          })(),
          8000,
          "totalAssetValue"
        );
      } catch {
        return { totalNgn: 0, propertyNgn: 0, movableNgn: 0 };
      }
    }),

    /** Per-branch stock readiness for Manager/Admin dashboards. */
    branchPerformance: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx, ["admin", "manager"]);
      const cacheKey = "dashboard:branchPerformance:all";
      type BranchPerformanceRow = {
        id: number;
        name: string;
        code: string | null;
        isActive: boolean;
        stockScorePercent: number | null;
        adequateCards: number;
        totalCards: number;
      };
      const cached = await cacheGetJson<BranchPerformanceRow[]>(cacheKey);
      if (cached) return cached;

      const database = await db.getDb();
      if (!database) return [];

      const branches = await database
        .select({ id: sites.id, name: sites.name, code: sites.code, isActive: sites.isActive })
        .from(sites)
        .where(eq(sites.facilityType, "branch"))
        .orderBy(asc(sites.name));

      const [anyMovement] = await database.select({ id: stockMovements.id }).from(stockMovements).limit(1);
      if (!anyMovement) {
        const emptyScores = branches.map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          isActive: b.isActive,
          stockScorePercent: null,
          adequateCards: 0,
          totalCards: 0,
        }));
        await cacheSetJson(cacheKey, emptyScores, 1800);
        return emptyScores;
      }

      const { isStockCardBalancesMvAvailable } = await import("../_core/stockCardBalancesMv");
      const useMv = await isStockCardBalancesMvAvailable(database);

      let scoreRows: { locationId: number; total: number; adequate: number }[];

      if (useMv) {
        scoreRows = await database
          .select({
            locationId: stockCards.locationId,
            total: sql<number>`count(distinct ${stockCards.id})`.mapWith(Number),
            adequate: sql<number>`count(distinct ${stockCards.id}) filter (where coalesce(scb.net_quantity, 0) > coalesce(${stockSettings.minLevel}, 0))`.mapWith(Number),
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
          .leftJoin(sql`stock_card_balances scb`, sql`scb.stock_card_id = ${stockCards.id}`)
          .groupBy(stockCards.locationId);
      } else {
        const movementTotals = database
          .select({
            stockCardId: stockMovements.stockCardId,
            netQuantity: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number).as("netQuantity"),
          })
          .from(stockMovements)
          .groupBy(stockMovements.stockCardId)
          .as("movement_totals_bp");

        scoreRows = await database
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
          .groupBy(stockCards.locationId);
      }

      const scoreByLocation = new Map<number, { total: number; adequate: number }>();
      for (const row of scoreRows) {
        scoreByLocation.set(row.locationId, {
          total: Number(row.total ?? 0),
          adequate: Number(row.adequate ?? 0),
        });
      }

      const result = branches.map((b) => {
        const score = scoreByLocation.get(b.id);
        const pct = score && score.total > 0 ? Math.round((score.adequate / score.total) * 100) : null;
        return {
          id: b.id,
          name: b.name,
          code: b.code,
          isActive: b.isActive,
          stockScorePercent: pct,
          adequateCards: score?.adequate ?? 0,
          totalCards: score?.total ?? 0,
        };
      });
      await cacheSetJson(cacheKey, result, 1800);
      return result;
    }),

    attentionItems: protectedProcedure
      .input(z.object({ role: z.enum(["Admin", "Manager", "Staff", "Field"]) }))
      .query(async ({ input, ctx }) => {
        const allClear = {
          icon: "CheckCircle2",
          tone: "green",
          label: "No action items right now",
          meta: "All clear",
          href: null as string | null,
        };
        type AttentionItem = { icon: string; tone: string; label: string; meta: string; href: string | null };
        const scope = dashboardDataScope(ctx);
        if (scope.mode === "empty") return [allClear];

        return withDashboardCache(
          `dashboard:attentionItems:${dashboardCacheScopeKey(scope)}:${input.role}`,
          300,
          async () => {
        const siteId = scope.mode === "site" ? scope.siteId : undefined;
        const database = await db.getDb();
        if (!database) return [allClear];

        const safe = async <T>(label: string, query: () => Promise<T>): Promise<T | null> => {
          try {
            return await query();
          } catch (error) {
            console.error(`[dashboard.attentionItems] ${label} query failed`, error);
            return null;
          }
        };

        const requisitionSummary = () =>
          safe("requisitionSummary", async () => {
            const siteReq = siteId != null ? eq(requisitions.requestingFacility, siteId) : sql`true`;
            const rows = await database
              .select({
                total: sql<number>`count(*)`.mapWith(Number),
                urgent: sql<number>`count(*) filter (where lower(${requisitions.priority}) = 'urgent')`.mapWith(Number),
              })
              .from(requisitions)
              .where(and(eq(requisitions.status, "submitted"), siteReq));
            return {
              total: Number(rows[0]?.total ?? 0),
              urgent: Number(rows[0]?.urgent ?? 0),
            };
          });

        const lowStockItems = () =>
          safe("lowStockItems", async () => {
            const stats = await db.getDashboardStats(siteId != null ? { siteId } : undefined);
            return Number(stats?.lowStockItems ?? 0);
          });

        const lowStockFacilities = () =>
          safe("lowStockFacilities", async () => {
            const movementTotals = database
              .select({
                stockCardId: stockMovements.stockCardId,
                netQuantity: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number).as("netQuantity"),
              })
              .from(stockMovements)
              .groupBy(stockMovements.stockCardId)
              .as("movement_totals_attention");

            const siteCard = siteId != null ? eq(stockCards.locationId, siteId) : sql`true`;
            const rows = await database
              .select({
                count: sql<number>`count(distinct ${stockCards.locationId}) filter (where coalesce(${movementTotals.netQuantity}, 0) < coalesce(${stockSettings.minLevel}, 0) and coalesce(${stockSettings.minLevel}, 0) > 0)`.mapWith(Number),
              })
              .from(stockCards)
              .leftJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
              .leftJoin(
                stockSettings,
                and(
                  eq(stockSettings.warehouseId, stockCards.locationId),
                  eq(stockSettings.catalogueId, commodityTrackingNumbers.itemId)
                )
              )
              .leftJoin(movementTotals, eq(movementTotals.stockCardId, stockCards.id))
              .where(siteCard);

            return Number(rows[0]?.count ?? 0);
          });

        if (input.role === "Admin") {
          const [
            pendingUserCount,
            failedLoginsCount,
            reqSummary,
            inactiveFacilities,
            grnDrafts,
            insuranceExpiring,
            vehiclesExpiring,
            generatorsOverdue,
            donorReportsDueSoon,
          ] = await Promise.all([
            safe("pendingUsers", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(pendingUsers)
                .where(eq(pendingUsers.status, "pending"));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("failedLogins24h", async () => {
              const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(auditLogs)
                .where(and(ilike(auditLogs.action, "%fail%"), gte(auditLogs.timestamp, since)));
              return Number(rows[0]?.count ?? 0);
            }),
            requisitionSummary(),
            safe("inactiveFacilities", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(sites)
                .where(eq(sites.isActive, false));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("grnDrafts", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(goodsReceivedNotes)
                .where(eq(goodsReceivedNotes.status, "draft"));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("insuranceExpiring", () => countInsuranceExpiringSoon()),
            safe("vehiclesExpiring", () => countVehiclesExpiringSoon()),
            safe("generatorsOverdue", () => countGeneratorsOverdue()),
            safe("donorReportsDueSoon", () => countDonorReportsDueSoon()),
          ]);

          const items: AttentionItem[] = [];
          if ((pendingUserCount ?? 0) > 0) {
            items.push({
              icon: "Users",
              tone: "amber",
              label: `${pendingUserCount} user ${pendingUserCount === 1 ? "registration" : "registrations"} pending`,
              meta: "Access",
              href: DASHBOARD_NAV.pendingUsers,
            });
          }
          if ((failedLoginsCount ?? 0) > 0) {
            items.push({
              icon: "AlertTriangle",
              tone: "red",
              label: `${failedLoginsCount} failed login attempt${failedLoginsCount === 1 ? "" : "s"} in last 24h`,
              meta: "Security",
              href: DASHBOARD_NAV.auditTrail,
            });
          }
          if (reqSummary) {
            items.push({
              icon: "ClipboardList",
              tone: reqSummary.total > 0 ? "red" : "green",
              label:
                reqSummary.total > 0
                  ? `${reqSummary.total} requisition${reqSummary.total === 1 ? "" : "s"} awaiting approval`
                  : "No pending requisitions",
              meta: reqSummary.urgent > 0 ? `${reqSummary.urgent} urgent` : "Up to date",
              href: reqSummary.total > 0 ? DASHBOARD_NAV.requisitionsSubmitted : DASHBOARD_NAV.requisitionsAll,
            });
          }
          if ((inactiveFacilities ?? 0) > 0) {
            items.push({
              icon: "MapPin",
              tone: "amber",
              label: `${inactiveFacilities} facilit${inactiveFacilities === 1 ? "y" : "ies"} marked offline`,
              meta: "Facilities",
              href: DASHBOARD_NAV.facilitiesInactive,
            });
          }
          if ((grnDrafts ?? 0) > 0) {
            items.push({
              icon: "FileText",
              tone: "blue",
              label: `${grnDrafts} GRN draft${grnDrafts === 1 ? "" : "s"} not finalised`,
              meta: "Inventory",
              href: DASHBOARD_NAV.receiptsDraft,
            });
          }
          if ((insuranceExpiring ?? 0) > 0) {
            items.push({
              icon: "Shield",
              tone: "amber",
              label: `${insuranceExpiring} insurance polic${insuranceExpiring === 1 ? "y" : "ies"} expiring soon`,
              meta: "Compliance",
              href: DASHBOARD_NAV.insuranceExpiring,
            });
          }
          if ((vehiclesExpiring ?? 0) > 0) {
            items.push({
              icon: "Car",
              tone: "amber",
              label: `${vehiclesExpiring} vehicle${vehiclesExpiring === 1 ? "" : "s"} with documents expiring soon`,
              meta: "Compliance",
              href: DASHBOARD_NAV.vehiclesExpiring,
            });
          }
          if ((generatorsOverdue ?? 0) > 0) {
            items.push({
              icon: "Zap",
              tone: "red",
              label: `${generatorsOverdue} generator${generatorsOverdue === 1 ? "" : "s"} overdue for service`,
              meta: "Compliance",
              href: DASHBOARD_NAV.generatorsOverdue,
            });
          }
          if ((donorReportsDueSoon ?? 0) > 0) {
            items.push({
              icon: "FileCheck",
              tone: "amber",
              label: `${donorReportsDueSoon} donor report${donorReportsDueSoon === 1 ? "" : "s"} due within 14 days`,
              meta: "Compliance",
              href: DASHBOARD_NAV.donorReportsDueSoon,
            });
          }
          return (items.length > 0 ? items : [allClear]).slice(0, 4);
        }

        if (input.role === "Manager") {
          const [
            reqSummary,
            lowStockCount,
            overdueMaintenanceCount,
            waybillDrafts,
            grnDrafts,
            insuranceExpiring,
            vehiclesExpiring,
            generatorsOverdue,
            donorReportsDueSoon,
          ] = await Promise.all([
            requisitionSummary(),
            lowStockItems(),
            safe("overdueMaintenance", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(maintenanceSchedules)
                .where(and(eq(maintenanceSchedules.isActive, true), sql`${maintenanceSchedules.nextDue} < now()`));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("waybillDrafts", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(waybills)
                .where(eq(waybills.status, "draft"));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("grnDrafts", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(goodsReceivedNotes)
                .where(eq(goodsReceivedNotes.status, "draft"));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("insuranceExpiring", () => countInsuranceExpiringSoon()),
            safe("vehiclesExpiring", () => countVehiclesExpiringSoon()),
            safe("generatorsOverdue", () => countGeneratorsOverdue()),
            safe("donorReportsDueSoon", () => countDonorReportsDueSoon()),
          ]);

          const items: AttentionItem[] = [];
          if (reqSummary) {
            items.push({
              icon: "ClipboardList",
              tone: reqSummary.total > 0 ? "red" : "green",
              label:
                reqSummary.total > 0
                  ? `${reqSummary.total} requisition${reqSummary.total === 1 ? "" : "s"} awaiting approval`
                  : "No pending requisitions",
              meta: reqSummary.urgent > 0 ? `${reqSummary.urgent} urgent` : "Up to date",
              href: reqSummary.total > 0 ? DASHBOARD_NAV.requisitionsSubmitted : DASHBOARD_NAV.requisitionsAll,
            });
          }
          if ((insuranceExpiring ?? 0) > 0) {
            items.push({
              icon: "Shield",
              tone: "amber",
              label: `${insuranceExpiring} insurance polic${insuranceExpiring === 1 ? "y" : "ies"} expiring soon`,
              meta: "Compliance",
              href: DASHBOARD_NAV.insuranceExpiring,
            });
          }
          if ((vehiclesExpiring ?? 0) > 0) {
            items.push({
              icon: "Car",
              tone: "amber",
              label: `${vehiclesExpiring} vehicle${vehiclesExpiring === 1 ? "" : "s"} with documents expiring soon`,
              meta: "Compliance",
              href: DASHBOARD_NAV.vehiclesExpiring,
            });
          }
          if ((generatorsOverdue ?? 0) > 0) {
            items.push({
              icon: "Zap",
              tone: "red",
              label: `${generatorsOverdue} generator${generatorsOverdue === 1 ? "" : "s"} overdue for service`,
              meta: "Compliance",
              href: DASHBOARD_NAV.generatorsOverdue,
            });
          }
          if ((donorReportsDueSoon ?? 0) > 0) {
            items.push({
              icon: "FileCheck",
              tone: "amber",
              label: `${donorReportsDueSoon} donor report${donorReportsDueSoon === 1 ? "" : "s"} due within 14 days`,
              meta: "Compliance",
              href: DASHBOARD_NAV.donorReportsDueSoon,
            });
          }
          if ((lowStockCount ?? 0) > 0) {
            items.push({
              icon: "Package",
              tone: "amber",
              label: `${lowStockCount} item${lowStockCount === 1 ? "" : "s"} below reorder level`,
              meta: "Low stock",
              href: DASHBOARD_NAV.inventoryStockLow,
            });
          }
          if ((overdueMaintenanceCount ?? 0) > 0) {
            items.push({
              icon: "Wrench",
              tone: "orange",
              label: `${overdueMaintenanceCount} maintenance task${overdueMaintenanceCount === 1 ? "" : "s"} overdue`,
              meta: "Maintenance",
              href: DASHBOARD_NAV.maintenance,
            });
          }
          if ((waybillDrafts ?? 0) > 0) {
            items.push({
              icon: "Truck",
              tone: "blue",
              label: `${waybillDrafts} waybill${waybillDrafts === 1 ? "" : "s"} not yet dispatched`,
              meta: "Outgoing",
              href: DASHBOARD_NAV.waybillsDraft,
            });
          }
          if ((grnDrafts ?? 0) > 0) {
            items.push({
              icon: "FileText",
              tone: "blue",
              label: `${grnDrafts} GRN draft${grnDrafts === 1 ? "" : "s"} not finalised`,
              meta: "Inventory",
              href: DASHBOARD_NAV.receiptsDraft,
            });
          }
          return (items.length > 0 ? items : [allClear]).slice(0, 4);
        }

        if (input.role === "Staff") {
          const [grnDrafts, waybillDrafts, stockCountsInProgress, pendingReqCount] = await Promise.all([
            safe("grnDrafts", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(goodsReceivedNotes)
                .where(eq(goodsReceivedNotes.status, "draft"));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("waybillDrafts", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(waybills)
                .where(eq(waybills.status, "draft"));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("stockCountsInProgress", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(inventoryCounts)
                .where(sql`${inventoryCounts.status} in ('pending', 'in_progress')`);
              return Number(rows[0]?.count ?? 0);
            }),
            safe("submittedReqs", async () => {
              const siteReq = siteId != null ? eq(requisitions.requestingFacility, siteId) : sql`true`;
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(requisitions)
                .where(and(eq(requisitions.status, "submitted"), siteReq));
              return Number(rows[0]?.count ?? 0);
            }),
          ]);

          const items: AttentionItem[] = [];
          if ((grnDrafts ?? 0) > 0) {
            items.push({
              icon: "FileText",
              tone: "red",
              label: `${grnDrafts} GRN draft${grnDrafts === 1 ? "" : "s"} awaiting finalisation`,
              meta: "Receiving",
              href: DASHBOARD_NAV.receiptsDraft,
            });
          }
          if ((waybillDrafts ?? 0) > 0) {
            items.push({
              icon: "Truck",
              tone: "amber",
              label: `${waybillDrafts} waybill${waybillDrafts === 1 ? "" : "s"} ready to dispatch`,
              meta: "Outgoing",
              href: DASHBOARD_NAV.waybillsDraft,
            });
          }
          if ((stockCountsInProgress ?? 0) > 0) {
            items.push({
              icon: "ClipboardList",
              tone: "blue",
              label: `${stockCountsInProgress} stock count${stockCountsInProgress === 1 ? "" : "s"} in progress`,
              meta: "Stock takes",
              href: DASHBOARD_NAV.stockCountsInProgress,
            });
          }
          if ((pendingReqCount ?? 0) > 0) {
            items.push({
              icon: "Package",
              tone: "blue",
              label: `${pendingReqCount} requisition${pendingReqCount === 1 ? "" : "s"} submitted, awaiting approval`,
              meta: "Requisitions",
              href: DASHBOARD_NAV.requisitionsSubmitted,
            });
          }
          return (items.length > 0 ? items : [allClear]).slice(0, 4);
        }

        const [activeWaybills, pendingReqCount, lowStockFacilityCount] = await Promise.all([
          safe("activeWaybills", async () => {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const rows = await database
              .select({ count: sql<number>`count(*)`.mapWith(Number) })
              .from(waybills)
              .where(and(eq(waybills.status, "dispatched"), gte(waybills.createdAt, since)));
            return Number(rows[0]?.count ?? 0);
          }),
          safe("fieldPendingReqs", async () => {
            const siteReq = siteId != null ? eq(requisitions.requestingFacility, siteId) : sql`true`;
            const rows = await database
              .select({ count: sql<number>`count(*)`.mapWith(Number) })
              .from(requisitions)
              .where(and(sql`${requisitions.status} in ('submitted', 'draft')`, siteReq));
            return Number(rows[0]?.count ?? 0);
          }),
          lowStockFacilities(),
        ]);

        const items: AttentionItem[] = [];
        if ((activeWaybills ?? 0) > 0) {
          items.push({
            icon: "Truck",
            tone: "red",
            label: `${activeWaybills} active distribution${activeWaybills === 1 ? "" : "s"} this week`,
            meta: "In progress",
            href: DASHBOARD_NAV.waybillsDispatched,
          });
        }
        if ((pendingReqCount ?? 0) > 0) {
          items.push({
            icon: "ClipboardList",
            tone: "amber",
            label: `${pendingReqCount} requisition${pendingReqCount === 1 ? "" : "s"} pending`,
            meta: "Submitted",
            href: DASHBOARD_NAV.requisitionsSubmitted,
          });
        }
        if ((lowStockFacilityCount ?? 0) > 0) {
          items.push({
            icon: "AlertTriangle",
            tone: "amber",
            label: `${lowStockFacilityCount} facilit${lowStockFacilityCount === 1 ? "y" : "ies"} have low stock`,
            meta: "Low stock",
            href: DASHBOARD_NAV.inventoryStockLow,
          });
        }
        items.push({
          icon: "CheckCircle2",
          tone: "green",
          label: "System operational",
          meta: "NRCS EAM",
          href: null,
        });
        return items.slice(0, 4);
          }
        );
      }),
  });
