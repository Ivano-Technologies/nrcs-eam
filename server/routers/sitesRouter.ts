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
const facilityTypeZod = z.enum(FACILITY_TYPE_VALUES);
const facilityTypeNormalizingZod = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase().trim().replace(/\s+/g, "_") : value),
  facilityTypeZod
);

async function resolveFacilityParentForSave(params: {
  facilityType: FacilityType;
  parentFacilityId: number | null | undefined;
  /** Set when updating an existing facility (for cycle checks). */
  siteId?: number;
}): Promise<number | null> {
  const parentId = params.parentFacilityId ?? null;
  await validateFacilityHierarchy(params.facilityType, parentId, params.siteId);
  return parentId;
}

export const sitesRouter = router({
    list: protectedProcedure
      .input(z.object({ facilityType: facilityTypeZod.optional() }).optional())
      .query(async ({ input }) => {
        return await db.getSitesList(
          input?.facilityType != null ? { facilityType: input.facilityType } : undefined
        );
      }),

    mapData: protectedProcedure.query(async () => {
      return await db.getSitesMapData();
    }),

    mapNetworkData: protectedProcedure.query(async () => {
      const cacheKey = "sites:mapNetworkData:v1";
      const cached = await cacheGetJson<Awaited<ReturnType<typeof db.getSitesMapNetworkData>>>(cacheKey);
      if (cached) return cached;
      const rows = await db.getSitesMapNetworkData();
      await cacheSetJson(cacheKey, rows, 1800);
      return rows;
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getSiteByIdEnriched(input.id);
      }),

    create: managerOrAdminProcedure
      .input(
        z.object({
          code: z.string().trim().min(1).max(64).optional(),
          name: z.string().min(1),
          facilityType: facilityTypeNormalizingZod.optional().default("branch"),
          parentFacilityId: z.number().nullable().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          postalCode: z.string().max(32).optional(),
          country: z.string().default("Nigeria"),
          contactPerson: z.string().optional(),
          contactPhone: z.string().optional(),
          contactEmail: z.string().email().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { facilityType, parentFacilityId, code, ...rest } = input;
        const parentResolved = await resolveFacilityParentForSave({ facilityType, parentFacilityId });
        const site = await db.createSite({
          ...(code ? { code } : {}),
          ...rest,
          facilityType,
          parentFacilityId: parentResolved,
        });
        if (site) {
          await logAuditEvent({
            userId: ctx.user.id,
            action: AUDIT_ACTIONS.FACILITY_CREATE,
            entityType: "site",
            entityId: site.id,
            changes: {
              name: site.name,
              code: site.code,
              facilityType: site.facilityType,
              isActive: site.isActive,
            },
            req: ctx.req,
          });
        }
        return site;
      }),

    update: managerOrAdminProcedure
      .input(
        z.object({
          id: z.number(),
          code: z.string().trim().min(1).max(64).optional(),
          name: z.string().min(1).optional(),
          facilityType: facilityTypeNormalizingZod.optional(),
          parentFacilityId: z.number().nullable().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          postalCode: z.string().max(32).optional(),
          contactPerson: z.string().optional(),
          contactPhone: z.string().optional(),
          contactEmail: z.string().email().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, facilityType, parentFacilityId, ...data } = input;
        const existing = await db.getSiteById(id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Facility not found." });
        }
        const nextType = facilityType ?? existing.facilityType;
        let nextParentRaw: number | null | undefined;
        if (nextType === "national_headquarters") {
          nextParentRaw = null;
        } else if (parentFacilityId !== undefined) {
          nextParentRaw = parentFacilityId;
        } else {
          nextParentRaw = existing.parentFacilityId;
        }

        const nextParent = await resolveFacilityParentForSave({
          facilityType: nextType,
          parentFacilityId: nextParentRaw,
          siteId: id,
        });

        const updated = await db.updateSite(id, {
          ...data,
          ...(facilityType !== undefined ? { facilityType } : {}),
          parentFacilityId: nextParent,
        });
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.FACILITY_UPDATE,
          entityType: "site",
          entityId: id,
          changes: {
            before: {
              name: existing.name,
              code: existing.code,
              facilityType: existing.facilityType,
              isActive: existing.isActive,
              parentFacilityId: existing.parentFacilityId,
            },
            after: {
              name: updated?.name ?? data.name ?? existing.name,
              code: updated?.code ?? data.code ?? existing.code,
              facilityType: updated?.facilityType ?? nextType,
              isActive: updated?.isActive ?? data.isActive ?? existing.isActive,
              parentFacilityId: nextParent,
            },
          },
          req: ctx.req,
        });
        return updated;
      }),

    bulkDelete: managerOrAdminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        let deleted = 0;
        for (const id of input.ids) {
          try {
            await db.deleteSite(id);
            await db.createAuditLog({
              userId: ctx.user.id,
              action: "bulk_delete_site",
              entityType: "site",
              entityId: id,
            });
            deleted++;
          } catch (error) {
            console.error(`Failed to delete facility ${id}:`, error);
          }
        }
        return { deleted, total: input.ids.length };
      }),
  });
