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

export const workOrderTemplatesRouter = router({
    list: protectedProcedure
      .input(z.object({
        isActive: z.boolean().optional(),
        type: z.enum(['corrective', 'preventive', 'inspection', 'emergency']).optional(),
        categoryId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getWorkOrderTemplates(input || {});
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkOrderTemplateById(input.id);
      }),

    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        type: z.enum(['corrective', 'preventive', 'inspection', 'emergency']),
        priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
        estimatedDuration: z.number().optional(),
        checklistItems: z.string().optional(), // JSON string
        instructions: z.string().optional(),
        categoryId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createWorkOrderTemplate({
          ...input,
          createdBy: ctx.user.id,
          isActive: true,
        });
      }),

    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        type: z.enum(['corrective', 'preventive', 'inspection', 'emergency']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        estimatedDuration: z.number().optional(),
        checklistItems: z.string().optional(),
        instructions: z.string().optional(),
        categoryId: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateWorkOrderTemplate(id, data);
        return { success: true };
      }),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteWorkOrderTemplate(input.id);
        return { success: true };
      }),
  });
