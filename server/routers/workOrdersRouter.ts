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
const MAX_WORK_ORDER_PHOTO_BYTES = 8 * 1024 * 1024;

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function decodeBase64Image(data: string): Buffer {
  const trimmed = data.trim();
  const comma = trimmed.indexOf(",");
  const payload =
    trimmed.startsWith("data:") && comma !== -1 ? trimmed.slice(comma + 1) : trimmed;
  return Buffer.from(payload, "base64");
}

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
        fileSizeLimit: MAX_WORK_ORDER_PHOTO_BYTES,
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

    photos: router({
      list: protectedProcedure
        .input(z.object({ workOrderId: z.number() }))
        .query(async ({ input, ctx }) => {
          const workOrder = await db.getWorkOrderById(input.workOrderId);
          if (!workOrder) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Work order not found" });
          }
          assertRecordFacilityAccess(ctx.user, workOrder.siteId);
          return await db.listWorkOrderFieldPhotos(input.workOrderId);
        }),

      upload: protectedProcedure
        .input(
          z.object({
            workOrderId: z.number(),
            data: z.string().min(1),
            mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
            caption: z.string().optional(),
          }),
        )
        .mutation(async ({ input, ctx }) => {
          const workOrder = await db.getWorkOrderById(input.workOrderId);
          if (!workOrder) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Work order not found" });
          }
          assertRecordFacilityAccess(ctx.user, workOrder.siteId);

          const existing = await db.listWorkOrderFieldPhotos(input.workOrderId);
          if (existing.length >= MAX_WORK_ORDER_PHOTOS) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Maximum ${MAX_WORK_ORDER_PHOTOS} photos per work order`,
            });
          }

          let bytes: Buffer;
          try {
            bytes = decodeBase64Image(input.data);
          } catch {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid image data",
            });
          }
          if (!bytes.length) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Image data is empty",
            });
          }
          if (bytes.length > MAX_WORK_ORDER_PHOTO_BYTES) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Image must be 8MB or smaller",
            });
          }

          const supabase = await ensureWorkOrderPhotosBucket();
          const storageKey = `work-orders/${input.workOrderId}/${nanoid()}.${extensionForMime(input.mimeType)}`;
          const { error: uploadError } = await supabase.storage
            .from(WORK_ORDER_PHOTOS_BUCKET)
            .upload(storageKey, bytes, {
              contentType: input.mimeType,
              upsert: false,
            });
          if (uploadError) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Photo upload failed: ${uploadError.message}`,
            });
          }

          const { data: publicData } = supabase.storage
            .from(WORK_ORDER_PHOTOS_BUCKET)
            .getPublicUrl(storageKey);
          if (!publicData?.publicUrl) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Could not resolve public photo URL",
            });
          }

          const photo = await db.addWorkOrderFieldPhoto({
            workOrderId: input.workOrderId,
            storageKey,
            publicUrl: publicData.publicUrl,
            caption: input.caption,
            uploadedByUserId: ctx.user.id,
          });

          await db.createAuditLog({
            userId: ctx.user.id,
            action: "upload_work_order_photo",
            entityType: "work_order",
            entityId: input.workOrderId,
            changes: JSON.stringify({ photoId: photo.id, storageKey }),
          });

          return photo;
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input, ctx }) => {
          const photo = await db.getWorkOrderFieldPhotoById(input.id);
          if (!photo) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Photo not found" });
          }
          const workOrder = await db.getWorkOrderById(photo.workOrderId);
          if (!workOrder) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Work order not found" });
          }
          assertRecordFacilityAccess(ctx.user, workOrder.siteId);

          const isElevated =
            ctx.user.role === "admin" || ctx.user.role === "manager";
          const isUploader = photo.uploadedByUserId === ctx.user.id;
          if (!isElevated && !isUploader) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You can only delete photos you uploaded",
            });
          }

          if (isElevated) {
            await db.deleteWorkOrderFieldPhotoById(input.id);
          } else {
            const removed = await db.deleteWorkOrderFieldPhotoByUploader(
              input.id,
              ctx.user.id,
            );
            if (!removed) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "You can only delete photos you uploaded",
              });
            }
          }

          try {
            const supabase = getSupabaseSecret();
            const { error } = await supabase.storage
              .from(WORK_ORDER_PHOTOS_BUCKET)
              .remove([photo.storageKey]);
            if (error) {
              console.warn(
                `Failed to remove work-order photo from storage: ${photo.storageKey}`,
                error.message,
              );
            }
          } catch (err) {
            console.warn(
              `Failed to remove work-order photo from storage: ${photo.storageKey}`,
              err,
            );
          }

          await db.createAuditLog({
            userId: ctx.user.id,
            action: "delete_work_order_photo",
            entityType: "work_order",
            entityId: photo.workOrderId,
            changes: JSON.stringify({ photoId: photo.id, storageKey: photo.storageKey }),
          });

          return { success: true as const };
        }),
    }),
  });
