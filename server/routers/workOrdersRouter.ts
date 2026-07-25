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

const WORK_ORDER_PHOTOS_BUCKET = "work-order-photos";
const WORK_ORDER_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_WORK_ORDER_PHOTOS = 10;

async function ensureWorkOrderPhotosBucket() {
  const supabase = getSupabaseSecret();
  const { data: existingBucket, error: getBucketError } = await supabase.storage.getBucket(
    WORK_ORDER_PHOTOS_BUCKET,
  );
  if (getBucketError && getBucketError.message && !/not found/i.test(getBucketError.message)) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to access work-order photos bucket: ${getBucketError.message}`,
    });
  }
  if (!existingBucket) {
    const { error: createBucketError } = await supabase.storage.createBucket(
      WORK_ORDER_PHOTOS_BUCKET,
      {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: [...WORK_ORDER_PHOTO_MIME_TYPES],
      },
    );
    if (createBucketError) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to create work-order photos bucket: ${createBucketError.message}`,
      });
    }
  }
  return supabase;
}

export const workOrdersRouter = router({
    list: protectedProcedure
      .input(z.object({
        siteId: z.number().optional(),
        status: z.string().optional(),
        assignedTo: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const scopedSiteId = enforceFacilityScope(ctx.user, input?.siteId);
        return await db.getAllWorkOrders({ ...(input ?? {}), siteId: scopedSiteId });
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const workOrder = await db.getWorkOrderById(input.id);
        assertRecordFacilityAccess(ctx.user, workOrder?.siteId);
        return workOrder;
      }),
    
    create: protectedProcedure
      .input(z.object({
        workOrderNumber: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        assetId: z.number(),
        siteId: z.number(),
        type: z.enum(["corrective", "preventive", "inspection", "emergency"]),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        assignedTo: z.number().optional(),
        scheduledStart: z.date().optional(),
        scheduledEnd: z.date().optional(),
        estimatedCost: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        assertFacilityAccess(ctx.user, input.siteId);
        const workOrder = await db.createWorkOrder({
          ...input,
          requestedBy: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "create_work_order",
          entityType: "work_order",
          entityId: workOrder?.id,
        });
        
        // Notify assigned user
        if (input.assignedTo && workOrder?.id) {
          await notificationHelper.notifyWorkOrderAssigned(
            input.assignedTo,
            workOrder.id,
            input.title
          );
        }
        
        return workOrder;
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["pending", "assigned", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        assignedTo: z.number().optional(),
        scheduledStart: z.date().optional(),
        scheduledEnd: z.date().optional(),
        actualStart: z.date().optional(),
        actualEnd: z.date().optional(),
        estimatedCost: z.string().optional(),
        actualCost: z.string().optional(),
        completionNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getWorkOrderById(input.id);
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Work order not found",
          });
        }
        assertRecordFacilityAccess(ctx.user, existing.siteId);

        const { id, ...data } = input;

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "update_work_order",
          entityType: "work_order",
          entityId: id,
          changes: JSON.stringify(data),
        });
        
        const result = await db.updateWorkOrder(id, data);
        
        // Notify on status change to completed
        if (data.status === "completed" && existing.status !== "completed") {
          if (existing.requestedBy) {
            await notificationHelper.notifyWorkOrderCompleted(
              existing.requestedBy,
              id,
              existing.title
            );
          }
        }
        
        // Notify newly assigned user
        if (data.assignedTo && data.assignedTo !== existing.assignedTo) {
          await notificationHelper.notifyWorkOrderAssigned(
            data.assignedTo,
            id,
            existing.title || "Work Order"
          );
        }
        
        return result;
      }),

    listPhotos: protectedProcedure
      .input(z.object({ workOrderId: z.number() }))
      .query(async ({ input, ctx }) => {
        const workOrder = await db.getWorkOrderById(input.workOrderId);
        if (!workOrder) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Work order not found" });
        }
        assertRecordFacilityAccess(ctx.user, workOrder.siteId);
        return await db.getWorkOrderPhotos(input.workOrderId);
      }),

    uploadUrl: protectedProcedure
      .input(
        z.object({
          workOrderId: z.number(),
          fileName: z.string().min(1),
          fileType: z.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const workOrder = await db.getWorkOrderById(input.workOrderId);
        if (!workOrder) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Work order not found" });
        }
        assertRecordFacilityAccess(ctx.user, workOrder.siteId);

        if (
          !(WORK_ORDER_PHOTO_MIME_TYPES as readonly string[]).includes(input.fileType)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only JPEG, PNG, and WebP images are allowed",
          });
        }

        const existing = await db.getWorkOrderPhotos(input.workOrderId);
        if (existing.length >= MAX_WORK_ORDER_PHOTOS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Maximum ${MAX_WORK_ORDER_PHOTOS} photos per work order`,
          });
        }

        const supabase = await ensureWorkOrderPhotosBucket();
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const photoKey = `work-orders/${input.workOrderId}/${Date.now()}-${safeName}`;
        const { data, error } = await supabase.storage
          .from(WORK_ORDER_PHOTOS_BUCKET)
          .createSignedUploadUrl(photoKey);
        if (error || !data?.signedUrl) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error?.message ?? "Failed to create upload URL",
          });
        }
        const { data: publicData } = supabase.storage
          .from(WORK_ORDER_PHOTOS_BUCKET)
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

    attachPhoto: protectedProcedure
      .input(
        z.object({
          workOrderId: z.number(),
          photoUrl: z.string().url(),
          photoKey: z.string().min(1),
          caption: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const workOrder = await db.getWorkOrderById(input.workOrderId);
        if (!workOrder) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Work order not found" });
        }
        assertRecordFacilityAccess(ctx.user, workOrder.siteId);

        const existing = await db.getWorkOrderPhotos(input.workOrderId);
        if (existing.length >= MAX_WORK_ORDER_PHOTOS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Maximum ${MAX_WORK_ORDER_PHOTOS} photos per work order`,
          });
        }

        const photoId = await db.createAssetPhoto({
          workOrderId: input.workOrderId,
          assetId: workOrder.assetId,
          photoUrl: input.photoUrl,
          photoKey: input.photoKey,
          caption: input.caption,
          uploadedBy: ctx.user.id,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "attach_work_order_photo",
          entityType: "work_order",
          entityId: input.workOrderId,
          changes: JSON.stringify({ photoId, photoKey: input.photoKey }),
        });

        return { id: photoId };
      }),
  });
