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

export const inventoryRouter = router({
    list: protectedProcedure
      .input(z.object({ siteId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const scopedSiteId = enforceFacilityScope(ctx.user, input?.siteId);
        return await db.getAllInventoryItems(scopedSiteId);
      }),
    
    lowStock: protectedProcedure
      .input(z.object({ siteId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const scopedSiteId = enforceFacilityScope(ctx.user, input?.siteId);
        return await db.getLowStockItems(scopedSiteId);
      }),
    
    transactions: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInventoryTransactions(input.itemId);
      }),
    
    create: staffOrAboveProcedure
      .input(z.object({
        itemCode: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        siteId: z.number(),
        currentStock: z.number().default(0),
        minStockLevel: z.number().default(0),
        reorderPoint: z.number().default(0),
        maxStockLevel: z.number().optional(),
        unitOfMeasure: z.string().optional(),
        unitCost: z.string().optional(),
        location: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        assertFacilityAccess(ctx.user, input.siteId);
        return await db.createInventoryItem(input);
      }),
    
    update: staffOrAboveProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        currentStock: z.number().optional(),
        minStockLevel: z.number().optional(),
        reorderPoint: z.number().optional(),
        maxStockLevel: z.number().optional(),
        unitOfMeasure: z.string().optional(),
        unitCost: z.string().optional(),
        location: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const before = await db.getInventoryItemById(id);
        if (!before) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found" });
        }
        const updated = await db.updateInventoryItem(id, data);
        if (updated) {
          await notificationHelper.notifyManagersWhenInventoryBecomesLow(
            { currentStock: before.currentStock, minStockLevel: before.minStockLevel },
            updated
          );
        }
        return updated;
      }),

    movements: protectedProcedure
      .input(
        z
          .object({
            siteId: z.number().optional(),
            itemId: z.number().optional(),
            startDate: z.coerce.date().optional(),
            endDate: z.coerce.date().optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        const scopedSiteId = enforceFacilityScope(ctx.user, input?.siteId);
        return await db.getInventoryMovements({ ...(input ?? {}), siteId: scopedSiteId });
      }),

    submitStockCount: protectedProcedure
      .input(
        z.object({
          siteId: z.number(),
          lines: z.array(
            z.object({
              itemId: z.number(),
              countedQty: z.number().int().min(0),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        assertFacilityAccess(ctx.user, input.siteId);

        for (const line of input.lines) {
          const before = await db.getInventoryItemById(line.itemId);
          if (!before || before.siteId !== input.siteId) continue;
          if (line.countedQty < before.currentStock) {
            requireRole(ctx, ["manager", "admin"]);
            break;
          }
        }

        const discrepancies: Array<{
          itemId: number;
          itemCode: string;
          itemName: string;
          expected: number;
          counted: number;
          variance: number;
        }> = [];

        for (const line of input.lines) {
          const before = await db.getInventoryItemById(line.itemId);
          if (!before || before.siteId !== input.siteId) continue;

          const expected = before.currentStock;
          const counted = line.countedQty;
          const variance = counted - expected;
          if (variance === 0) continue;

          await db.createInventoryTransaction({
            itemId: line.itemId,
            type: "adjustment",
            quantity: counted,
            performedBy: ctx.user.id,
            notes: `Stock count: expected ${expected}, counted ${counted}, variance ${variance >= 0 ? "+" : ""}${variance}`,
          });

          const updated = await db.updateInventoryItem(line.itemId, { currentStock: counted });
          if (updated) {
            await notificationHelper.notifyManagersWhenInventoryBecomesLow(
              { currentStock: before.currentStock, minStockLevel: before.minStockLevel },
              updated
            );
          }

          discrepancies.push({
            itemId: before.id,
            itemCode: before.itemCode,
            itemName: before.name,
            expected,
            counted,
            variance,
          });
        }

        return { discrepancies, adjustedLines: discrepancies.length };
      }),
    
    addTransaction: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        type: z.enum(["in", "out", "adjustment", "transfer"]),
        quantity: z.number(),
        workOrderId: z.number().optional(),
        fromSiteId: z.number().optional(),
        toSiteId: z.number().optional(),
        unitCost: z.string().optional(),
        totalCost: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        if (input.fromSiteId) assertFacilityAccess(ctx.user, input.fromSiteId);
        if (input.toSiteId) assertFacilityAccess(ctx.user, input.toSiteId);

        const itemBefore = await db.getInventoryItemById(input.itemId);
        if (!itemBefore) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found" });
        }
        const previousStock = itemBefore.currentStock;

        let newStock = itemBefore.currentStock;
        if (input.type === "in") newStock += input.quantity;
        else if (input.type === "out") newStock -= input.quantity;
        else if (input.type === "adjustment") newStock = input.quantity;

        if (input.type === "adjustment" && input.quantity < previousStock) {
          requireRole(ctx, ["manager", "admin"]);
        }
        if (input.type === "out" && previousStock - input.quantity < 0) {
          requireRole(ctx, ["manager", "admin"]);
        }

        const transaction = await db.createInventoryTransaction({
          ...input,
          performedBy: ctx.user.id,
        });
        
        if (input.type !== "transfer") {
          const updated = await db.updateInventoryItem(input.itemId, { currentStock: newStock });
          if (updated) {
            await notificationHelper.notifyManagersWhenInventoryBecomesLow(
              { currentStock: previousStock, minStockLevel: itemBefore.minStockLevel },
              updated
            );
          }
        }
        
        return transaction;
      }),

    deleteTransaction: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const ok = await db.deleteInventoryTransaction(input.id);
        if (!ok) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
        }
        return { success: true as const };
      }),

    bulkDelete: managerOrAdminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        let deleted = 0;
        for (const id of input.ids) {
          try {
            await db.deleteInventoryItem(id);
            await db.createAuditLog({
              userId: ctx.user.id,
              action: "bulk_delete_inventory",
              entityType: "inventory",
              entityId: id,
            });
            deleted++;
          } catch (error) {
            console.error(`Failed to delete inventory item ${id}:`, error);
          }
        }
        return { deleted, total: input.ids.length };
      }),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getInventoryItemById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found" });
        }
        const ok = await db.deleteInventoryItem(input.id);
        if (!ok) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete inventory item" });
        }
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "delete_inventory",
          entityType: "inventory",
          entityId: input.id,
        });
        return { success: true as const };
      }),
  });
