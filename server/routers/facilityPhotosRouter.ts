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

export const facilityPhotosRouter = router({
    list: protectedProcedure
      .input(z.object({ siteId: z.number() }))
      .query(async ({ input, ctx }) => {
        assertFacilityAccess(ctx.user, input.siteId);
        return await db.getFacilityPhotos(input.siteId);
      }),

    upload: managerOrAdminProcedure
      .input(
        z.object({
          siteId: z.number(),
          photoUrl: z.string().url(),
          photoKey: z.string(),
          caption: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const site = await db.getSiteById(input.siteId);
        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Facility not found." });
        }
        const existing = await db.getFacilityPhotos(input.siteId);
        if (existing.length >= 10) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum 10 photos per facility",
          });
        }
        return await db.addFacilityPhoto({
          siteId: input.siteId,
          photoUrl: input.photoUrl,
          photoKey: input.photoKey,
          caption: input.caption,
          uploadedBy: ctx.user.id,
        });
      }),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const photo = await db.getFacilityPhotoById(input.id);
        if (!photo) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Photo not found." });
        }
        if (ctx.user.role === "admin") {
          await db.deleteFacilityPhotoById(input.id);
        } else {
          await db.deleteFacilityPhoto(input.id, ctx.user.id);
        }
        if (photo.photoKey) {
          try {
            const supabase = getSupabaseSecret();
            const { error } = await supabase.storage
              .from("facility-photos")
              .remove([photo.photoKey]);
            if (error) {
              console.warn(
                `Failed to remove facility photo from storage: ${photo.photoKey}`,
                error.message
              );
            }
          } catch (err) {
            console.warn(
              `Failed to remove facility photo from storage: ${photo.photoKey}`,
              err
            );
          }
        }
        return { success: true as const };
      }),

    uploadUrl: managerOrAdminProcedure
      .input(
        z.object({
          siteId: z.number(),
          fileName: z.string().min(1),
          fileType: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        const site = await db.getSiteById(input.siteId);
        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Facility not found." });
        }
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(input.fileType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only JPEG, PNG, and WebP images are allowed",
          });
        }
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const photoKey = `facilities/${input.siteId}/${Date.now()}-${safeName}`;
        const supabase = getSupabaseSecret();
        const { data, error } = await supabase.storage
          .from("facility-photos")
          .createSignedUploadUrl(photoKey);
        if (error || !data?.signedUrl) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error?.message ?? "Failed to create upload URL",
          });
        }
        const { data: publicData } = supabase.storage
          .from("facility-photos")
          .getPublicUrl(photoKey);
        if (!publicData?.publicUrl) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not resolve public photo URL",
          });
        }
        return {
          uploadUrl: data.signedUrl,
          photoKey,
          publicUrl: publicData.publicUrl,
        };
      }),
  });
