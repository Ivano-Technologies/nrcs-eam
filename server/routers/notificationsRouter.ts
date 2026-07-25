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

export const notificationsRouter = router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getUserNotifications(ctx.user.id, input.limit);
      }),
    
    unreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUnreadNotificationCount(ctx.user.id);
      }),
    
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await db.markNotificationAsRead(input.id, ctx.user.id);
      }),
    
    markAllAsRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        return await db.markAllNotificationsAsRead(ctx.user.id);
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await db.deleteNotification(input.id, ctx.user.id);
      }),
    
    getPreferences: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserNotificationPreferences(ctx.user.id);
      }),
    
    updatePreferences: protectedProcedure
      .input(z.object({
        maintenanceDue: z.boolean().optional(),
        lowStock: z.boolean().optional(),
        workOrderAssigned: z.boolean().optional(),
        workOrderCompleted: z.boolean().optional(),
        assetStatusChange: z.boolean().optional(),
        complianceDue: z.boolean().optional(),
        systemAlert: z.boolean().optional(),
        expiryDigest: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.upsertNotificationPreferences(ctx.user.id, input);
      }),

    sendAssetCheckReminders: adminProcedure.mutation(async () => {
      const { assetCheckReminderEmail, assetsListLink } = await import("../notifications/emailTemplates");
      const { createEmailService } = await import("../_core/createEmailService");
      const database = await db.getDb();
      if (!database) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      const rows = await db.listAssetsForPhysicalCheckReminder();
      type PhysicalCheckRow = (typeof rows)[number];
      const bySite = new Map<number, PhysicalCheckRow[]>();
      for (const r of rows) {
        const arr = bySite.get(r.siteId) ?? [];
        arr.push(r);
        bySite.set(r.siteId, arr);
      }

      let sent = 0;
      let failed = 0;
      for (const [siteId, list] of Array.from(bySite.entries())) {
        const site = await db.getSiteById(siteId);
        if (!site) {
          failed++;
          continue;
        }

        const managers = await database
          .select()
          .from(users)
          .where(and(eq(users.role, "manager"), eq(users.siteId, siteId)));

        const managerEmails = managers.map((m) => m.email?.trim()).filter((e): e is string => Boolean(e));
        let recipients: string[] = managerEmails;
        if (recipients.length === 0) {
          const c = site.contactEmail?.trim();
          if (c) recipients = [c];
        }
        if (recipients.length === 0) {
          failed++;
          continue;
        }

        const assetRows = list.map((a: PhysicalCheckRow) => {
          const raw = a.lastPhysicalCheck;
          let lastCheck = "Never";
          if (raw != null) {
            lastCheck =
              typeof raw === "object" && "toISOString" in raw && typeof (raw as Date).toISOString === "function"
                ? (raw as Date).toISOString().slice(0, 10)
                : String(raw).slice(0, 10);
          }
          return {
            tag: a.assetTag ?? `ID ${a.id}`,
            name: a.name,
            lastCheck,
          };
        });

        const { subject, html } = assetCheckReminderEmail({
          facilityName: site.name,
          assets: assetRows,
          link: assetsListLink(),
        });

        for (const to of recipients) {
          const ok = await createEmailService().send({
            type: "asset_check_reminder",
            to,
            subject,
            html,
          });
          if (ok) sent++;
          else failed++;
        }
      }

      return { sent, failed, facilitiesProcessed: bySite.size };
    }),
  });
