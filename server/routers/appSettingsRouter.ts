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

export const appSettingsRouter = router({
    getOpenRegistration: adminProcedure.query(async () => ({
      openRegistration: await db.getOpenRegistration(),
    })),
    setOpenRegistration: adminProcedure
      .input(z.object({ openRegistration: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.setOpenRegistration(input.openRegistration);
        return { ok: true as const };
      }),

    getEmailNotificationSettings: adminProcedure.query(async () => ({
      newUserRequests: await db.getAppSettingBool("emailNotifyNewUserRequests", true),
      lowStockAlerts: await db.getAppSettingBool("emailNotifyLowStock", true),
      overdueMaintenance: await db.getAppSettingBool("emailNotifyOverdueMaintenance", true),
    })),

    setEmailNotificationSettings: adminProcedure
      .input(
        z.object({
          newUserRequests: z.boolean().optional(),
          lowStockAlerts: z.boolean().optional(),
          overdueMaintenance: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        if (input.newUserRequests !== undefined) {
          await db.setAppSettingValue("emailNotifyNewUserRequests", input.newUserRequests ? "true" : "false");
        }
        if (input.lowStockAlerts !== undefined) {
          await db.setAppSettingValue("emailNotifyLowStock", input.lowStockAlerts ? "true" : "false");
        }
        if (input.overdueMaintenance !== undefined) {
          await db.setAppSettingValue(
            "emailNotifyOverdueMaintenance",
            input.overdueMaintenance ? "true" : "false"
          );
        }
        return { ok: true as const };
      }),
  });
