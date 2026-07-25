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

export const emailNotificationsRouter = router({
    send: adminProcedure
      .input(z.object({
        subject: z.string().min(1),
        body: z.string().min(1),
        recipientType: z.enum(['all', 'individual', 'role']),
        recipientIds: z.array(z.number()).optional(),
        recipientRole: z.enum(['admin', 'manager', 'user']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Get recipient emails based on type
        let recipients: string[] = [];
        
        if (input.recipientType === 'all') {
          const allUsers = await db.getAllUsers();
          recipients = allUsers.filter(u => u.email).map(u => u.email!);
        } else if (input.recipientType === 'individual' && input.recipientIds) {
          const users = await Promise.all(
            input.recipientIds.map(id => db.getUserById(id))
          );
          recipients = users.filter(u => u && u.email).map(u => u!.email!);
        } else if (input.recipientType === 'role' && input.recipientRole) {
          const allUsers = await db.getAllUsers();
          recipients = allUsers
            .filter(u => u.role === input.recipientRole && u.email)
            .map(u => u.email!);
        }
        
        // Send emails
        const htmlBody = generateEmailTemplate(input.body, input.subject);
        const { sent, failed } = await sendBulkEmails(recipients, input.subject, htmlBody);
        
        // Save to history
        await db.createEmailNotification({
          subject: input.subject,
          body: input.body,
          recipientType: input.recipientType,
          recipientIds: input.recipientIds ? JSON.stringify(input.recipientIds) : null,
          recipientRole: input.recipientRole || null,
          sentBy: ctx.user.id,
          status: failed > 0 ? 'failed' : 'sent',
          recipientCount: sent,
        });
        
        return { sent, failed, total: recipients.length };
      }),
    
    history: adminProcedure.query(async () => {
      return await db.getEmailNotificationHistory(100);
    }),
    
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmailNotificationById(input.id);
      }),
  });
