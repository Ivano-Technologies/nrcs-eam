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

export const auditLogsRouter = router({
    list: protectedProcedure
      .input(z.object({
        entityType: z.string().optional(),
        entityId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        actionType: z.string().optional(),
        userQuery: z.string().optional(),
        facilityId: z.number().optional(),
        page: z.number().min(1).default(1).optional(),
        pageSize: z.number().min(1).max(100).default(25).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
        }

        const database = await db.getDb();
        if (!database) {
          return { rows: [], total: 0, page: 1, pageSize: 25, actionTypes: [], facilities: [] };
        }

        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 25;
        const offset = (page - 1) * pageSize;

        const conditions: any[] = [];
        if (input?.entityType) conditions.push(eq(auditLogs.entityType, input.entityType));
        if (input?.entityId) conditions.push(eq(auditLogs.entityId, input.entityId));
        if (input?.startDate) conditions.push(gte(auditLogs.timestamp, input.startDate));
        if (input?.endDate) conditions.push(lte(auditLogs.timestamp, input.endDate));
        if (input?.actionType) conditions.push(eq(auditLogs.action, input.actionType));
        if (input?.facilityId) conditions.push(eq(users.siteId, input.facilityId));
        if (input?.userQuery) {
          const q = `%${input.userQuery}%`;
          conditions.push(or(ilike(users.name, q), ilike(users.email, q)));
        }
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const [rows, totalRows, actionTypes, facilities] = await Promise.all([
          database
            .select({
              id: auditLogs.id,
              timestamp: auditLogs.timestamp,
              action: auditLogs.action,
              resource: sql<string>`coalesce(${auditLogs.entityType}, 'system') || case when ${auditLogs.entityId} is not null then ':' || ${auditLogs.entityId}::text else '' end`,
              details: auditLogs.changes,
              facilityName: sites.name,
              userLabel: sql<string>`coalesce(${users.name}, ${users.email}, 'User #' || ${auditLogs.userId}::text)`,
            })
            .from(auditLogs)
            .leftJoin(users, eq(auditLogs.userId, users.id))
            .leftJoin(sites, eq(users.siteId, sites.id))
            .where(whereClause)
            .orderBy(desc(auditLogs.timestamp))
            .limit(pageSize)
            .offset(offset),
          database
            .select({ total: sql<number>`count(*)`.mapWith(Number) })
            .from(auditLogs)
            .leftJoin(users, eq(auditLogs.userId, users.id))
            .where(whereClause),
          database
            .selectDistinct({ action: auditLogs.action })
            .from(auditLogs)
            .orderBy(auditLogs.action),
          database
            .select({ id: sites.id, name: sites.name })
            .from(sites)
            .orderBy(sites.name),
        ]);

        return {
          rows,
          total: Number(totalRows[0]?.total ?? 0),
          page,
          pageSize,
          actionTypes: actionTypes.map((x) => x.action).filter(Boolean),
          facilities,
        };
      }),
  });
