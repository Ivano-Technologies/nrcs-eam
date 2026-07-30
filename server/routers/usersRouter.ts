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
const appUserRoleZod = z.enum(["admin", "manager", "staff", "field", "user"]);

function getFrontendOriginForUserEmails(): string {
  const fromEnv =
    process.env.FRONTEND_ORIGIN?.replace(/\/$/, "") ||
    process.env.VITE_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "FRONTEND_ORIGIN or VITE_APP_URL must be set in production",
    });
  }
  return "http://localhost:3000";
}

function escapeHtmlForEmail(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const usersRouter = router({
    list: adminProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            role: appUserRoleZod.optional(),
            facilityId: z.number().int().positive().optional(),
            status: z.enum(["active", "inactive", "pending"]).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const rows = await db.listAdminUsersWithFacilities({
          search: input?.search,
          role: input?.role,
          facilityId: input?.facilityId,
          status: input?.status,
        });
        return rows.map((row) => ({
          ...toPublicUser(row.user),
          facilityName: row.facilityName,
        }));
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.id);
        return user ? toPublicUser(user) : null;
      }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(200),
          email: z.string().email(),
          role: appUserRoleZod,
          facilityId: z.number().int().positive().nullable().optional(),
          sendWelcomeEmail: z.boolean().default(true),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        const existing = await db.getUserByEmailLowercase(email);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A user with this email already exists",
          });
        }

        const tempPassword = generateSupabaseCompliantTempPassword(12);
        const supabase = getSupabaseSecret();
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: input.name.trim() },
        });

        if (error || !data.user) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error?.message ??
              "Failed to create auth user. They may already exist in Supabase Auth.",
          });
        }

        let createdUserId: number;
        try {
          createdUserId = await db.insertAppUserLinkedToAuth({
            authUserId: data.user.id,
            email,
            name: input.name.trim(),
            role: input.role,
            siteId: input.facilityId ?? null,
            status: "active",
            mustChangePasswordOnLogin: true,
          });
        } catch (e) {
          try {
            await supabase.auth.admin.deleteUser(data.user.id);
          } catch {
            /* best-effort rollback */
          }
          console.error("[users.create] Failed to insert app user", e);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "User was created in Auth but saving the profile failed.",
          });
        }

        if (input.sendWelcomeEmail) {
          const origin = getFrontendOriginForUserEmails();
          const loginUrl = `${origin}/login`;
          const bodyHtml = `
    <p>Dear ${escapeHtmlForEmail(input.name.trim())},</p>
    <p>Your account has been created on the Nigerian Red Cross Society Enterprise Asset Management System.</p>
    <p><strong>Login URL:</strong> <a href="${loginUrl}">${escapeHtmlForEmail(loginUrl)}</a><br/>
    <strong>Email:</strong> ${escapeHtmlForEmail(email)}<br/>
    <strong>Temporary password:</strong> <code style="font-size:15px">${escapeHtmlForEmail(tempPassword)}</code></p>
    <p>Please log in and change your password immediately.</p>
    <p>If you have any issues, contact your system administrator.</p>
    <p>Nigerian Red Cross Society</p>`;
          const sent = await sendEmail({
            to: email,
            subject: "Welcome to NRCS EAM — Your account is ready",
            html: generateEmailTemplate(bodyHtml, "Welcome"),
          });
          if (!sent) {
            console.error("[users.create] Welcome email not sent (configure email delivery)");
          }
        }

        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.USER_CREATE,
          entityType: "user",
          entityId: createdUserId,
          changes: {
            email,
            role: input.role,
            facilityId: input.facilityId ?? null,
            name: input.name.trim(),
          },
          req: ctx.req,
        });

        return { success: true as const };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).max(200).optional(),
          role: appUserRoleZod.optional(),
          facilityId: z.number().int().positive().nullable().optional(),
          status: z.enum(["active", "inactive", "pending"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, name, role, facilityId, status } = input;
        if (id === ctx.user.id && status === "inactive") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot deactivate your own account",
          });
        }

        const target = await db.getUserById(id);
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        const patch: Partial<InsertUser> = { updatedAt: new Date() };
        if (name !== undefined) patch.name = name.trim();
        if (role !== undefined) patch.role = role;
        if (facilityId !== undefined) patch.siteId = facilityId;
        if (status !== undefined) patch.status = status;

        if (Object.keys(patch).length <= 1) {
          return { success: true as const };
        }

        await db.updateUser(id, patch);

        if (target.authUserId && (name !== undefined || role !== undefined)) {
          const admin = getSupabaseSecret();
          const nextName = name !== undefined ? name.trim() : (target.name ?? "");
          await admin.auth.admin.updateUserById(target.authUserId, {
            user_metadata: { full_name: nextName },
          });
        }

        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.USER_UPDATE,
          entityType: "user",
          entityId: id,
          changes: {
            before: {
              name: target.name,
              role: target.role,
              facilityId: target.siteId,
              status: target.status,
            },
            after: {
              name: patch.name ?? target.name,
              role: patch.role ?? target.role,
              facilityId: patch.siteId !== undefined ? patch.siteId : target.siteId,
              status: patch.status ?? target.status,
            },
          },
          req: ctx.req,
        });

        return { success: true as const };
      }),

    deactivate: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot deactivate your own account",
          });
        }
        const target = await db.getUserById(input.id);
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        await db.updateUser(input.id, { status: "inactive", updatedAt: new Date() });
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.USER_DEACTIVATE,
          entityType: "user",
          entityId: input.id,
          changes: { email: target.email, name: target.name },
          req: ctx.req,
        });
        return { success: true as const };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot delete your own account",
          });
        }
        const target = await db.getUserById(input.id);
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        const supabase = getSupabaseSecret();
        if (target.authUserId) {
          const { error } = await supabase.auth.admin.deleteUser(target.authUserId);
          if (error && !/not found|does not exist/i.test(error.message)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }
        }

        const still = await db.getUserById(input.id);
        if (still) {
          await db.deleteUser(input.id);
        }

        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.USER_DELETE,
          entityType: "user",
          entityId: input.id,
          changes: { email: target.email, name: target.name, role: target.role },
          req: ctx.req,
        });

        return { success: true as const };
      }),

    findOrphaned: adminProcedure.query(async () => db.findOrphanedAppUsers()),

    resetPassword: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        const target = await db.getUserByEmailLowercase(email);
        const supabase = getSupabaseSecret();
        const redirectTo = `${getFrontendOriginForUserEmails()}/reset-password`;
        const { data, error } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });
        if (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        const actionLink = data?.properties?.action_link;
        if (!actionLink) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate recovery link",
          });
        }
        const sent = await sendEmail({
          to: email,
          subject: "NRCS EAM — Password reset",
          html: generateEmailTemplate(
            `<p>A password reset was requested for your NRCS EAM account.</p>
            <p><a href="${actionLink}">Set a new password</a></p>
            <p>If you did not request this, contact your administrator.</p>`,
            "Password reset"
          ),
        });
        if (!sent) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Recovery link was generated but email could not be sent. Configure RESEND_API_KEY or SMTP.",
          });
        }
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.USER_RESET_PASSWORD,
          entityType: "user",
          entityId: target?.id,
          changes: { email },
          req: ctx.req,
        });
        return {
          success: true as const,
          message: `Password reset email sent to ${email}`,
        };
      }),

    completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      await db.updateUser(ctx.user.id, { hasCompletedOnboarding: true });
      return { success: true };
    }),
  });
