import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { toPublicUser } from "./_core/sanitizeUser";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import * as db from "./db";
import * as notificationHelper from "./notificationHelper";
import { generatePDFReport, generateExcelReport } from "./reportGenerator";
import { generateEmailTemplate, sendBulkEmails, sendEmail } from "./emailService";
import { authRouter } from "./routers/authRouter";
import {
  adminProcedure,
  managerOrAdminProcedure,
  staffOrAboveProcedure,
} from "./routers/roleProcedures";
import { inventoryV2Router } from "./routers/inventoryRouter";
import { wmsRouter } from "./routers/wmsRouter";
import { requireRole } from "./_core/trpc";
import { getSupabaseServiceRole } from "./_core/supabase";
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
} from "../drizzle/schema";
import { buildDistributionVelocity, buildStockReadiness, getPeriodWindow } from "./wms/dashboard";
import {
  legacyStatusFromRegister,
  registerStatusZodEnum,
} from "./assetRegister";
import { nanoid } from "nanoid";
import { generateSupabaseCompliantTempPassword } from "./tempPassword";
import { FACILITY_TYPE_VALUES, type FacilityType } from "../shared/facilities";
import type { InsertUser } from "../drizzle/schema";
import { validateFacilityHierarchy } from "./facilityHierarchy";

const facilityTypeZod = z.enum(FACILITY_TYPE_VALUES);
const facilityTypeNormalizingZod = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase().trim().replace(/\s+/g, "_") : value),
  facilityTypeZod
);

const appUserRoleZod = z.enum(["admin", "manager", "staff", "field", "user"]);
const assetItemTypeInputZod = z.enum(["Asset", "Inventory", "asset", "inventory"]);

function normalizeAssetItemType(
  value: z.infer<typeof assetItemTypeInputZod> | undefined
): "Asset" | "Inventory" {
  return value?.toLowerCase() === "inventory" ? "Inventory" : "Asset";
}

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

export const appRouter = router({
  system: systemRouter,

  auth: authRouter,

  // ============= APP SETTINGS (admin) =============
  appSettings: router({
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
  }),

  // ============= SITES MANAGEMENT =============
  sites: router({
    list: protectedProcedure
      .input(z.object({ facilityType: facilityTypeZod.optional() }).optional())
      .query(async ({ input }) => {
        return await db.getSitesList(
          input?.facilityType != null ? { facilityType: input.facilityType } : undefined
        );
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
      .mutation(async ({ input }) => {
        const { facilityType, parentFacilityId, code, ...rest } = input;
        const parentResolved = await resolveFacilityParentForSave({ facilityType, parentFacilityId });
        return await db.createSite({
          ...(code ? { code } : {}),
          ...rest,
          facilityType,
          parentFacilityId: parentResolved,
        });
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
      .mutation(async ({ input }) => {
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

        return await db.updateSite(id, {
          ...data,
          ...(facilityType !== undefined ? { facilityType } : {}),
          parentFacilityId: nextParent,
        });
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
  }),

  nav: router({
    sidebarCounts: protectedProcedure.query(async () => await db.getNavSidebarCounts()),
  }),

  // ============= ASSET CATEGORIES =============
  assetCategories: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllAssetCategories();
    }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createAssetCategory(input.name, input.description);
      }),
  }),

  // ============= ASSETS MANAGEMENT =============
  assets: router({
    list: protectedProcedure
      .input(z.object({
        siteId: z.number().optional(),
        status: z.string().optional(),
        categoryId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllAssets(input);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetById(input.id);
      }),
    
    getByTag: protectedProcedure
      .input(z.object({ assetTag: z.string() }))
      .query(async ({ input }) => {
        return await db.getAssetByTag(input.assetTag);
      }),
    
    search: protectedProcedure
      .input(z.object({ searchTerm: z.string() }))
      .query(async ({ input }) => {
        return await db.searchAssets(input.searchTerm);
      }),

    registerList: protectedProcedure
      .input(
        z
          .object({
            siteId: z.number().optional(),
            categoryId: z.number().optional(),
            registerStatus: z.string().optional(),
            itemType: z.string().optional(),
            search: z.string().optional(),
            sortBy: z.string().optional(),
            sortDir: z.enum(["asc", "desc"]).optional(),
            limit: z.number().min(1).max(50_000).optional(),
            offset: z.number().min(0).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return await db.getAssetRegisterList(input ?? {});
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        assetTag: z.string().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        categoryId: z.number(),
        siteId: z.number(),
        status: z.enum(["operational", "maintenance", "repair", "retired", "disposed"]).optional(),
        registerStatus: registerStatusZodEnum.optional(),
        itemType: assetItemTypeInputZod.optional(),
        registerItemType: z.enum(["Asset", "Inventory"]).optional(),
        itemCategory: z.string().optional(),
        itemCategoryCode: z.string().length(2).optional(),
        subCategory: z.string().optional(),
        subItemCategory: z.string().optional(),
        itemDescription: z.string().optional(),
        branchCode: z.string().optional(),
        assetNum: z.number().optional(),
        assetCode: z.string().optional(),
        acquisitionMethod: z.string().optional(),
        acquisitionOtherDetail: z.string().optional(),
        projectRef: z.string().optional(),
        yearAcquiredRegister: z.number().min(1900).max(2100).optional(),
        acquiredNewOrUsed: z.enum(["New", "Used"]).optional(),
        currentStatus: z.enum(["In Use", "In Store", "Under Maintenance", "Disposed", "To be Disposed"]).optional(),
        assignedToText: z.string().optional(),
        currentLocation: z.string().optional(),
        conditionRegister: z.enum(["Good", "Fair", "Damaged", "Beyond Repair (For Disposal)", "Out of Order (To be repaired)"]).optional(),
        lastPhysicalCheck: z.date().optional(),
        checkConductedBy: z.string().optional(),
        remarksRegister: z.string().optional(),
        actualUnitValue: z.string().optional(),
        depreciatedValue: z.string().optional(),
        acquisitionCondition: z.enum(["New", "Used"]).optional(),
        department: z.string().optional(),
        lastCheckedAt: z.date().optional(),
        checkedBy: z.string().optional(),
        physicalCondition: z.enum(["Good", "Fair", "Damaged", "Beyond Repair"]).optional(),
        assignedToName: z.string().optional(),
        manufacturer: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        acquisitionDate: z.date().optional(),
        yearAcquired: z.number().min(1900).max(2100).optional(),
        acquisitionCost: z.string().optional(),
        currentValue: z.string().optional(),
        currentDepreciatedValue: z.number().optional(),
        depreciationRate: z.string().optional(),
        warrantyExpiry: z.date().optional(),
        location: z.string().optional(),
        assignedTo: z.number().optional(),
        imageUrl: z.string().optional(),
        notes: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const registerStatus = input.registerStatus ?? "in_use";
        const status = input.status ?? legacyStatusFromRegister(registerStatus);
        let acquisitionDate = input.acquisitionDate;
        if (input.yearAcquired && !acquisitionDate) {
          acquisitionDate = new Date(Date.UTC(input.yearAcquired, 5, 15));
        }
        const assetTag = (input.assetTag?.trim() || `NRCS-${nanoid(10)}`).toUpperCase();
        return await db.createAsset({
          assetTag,
          name: input.name,
          description: input.description,
          categoryId: input.categoryId,
          siteId: input.siteId,
          status,
          registerStatus,
          itemType: normalizeAssetItemType(input.itemType),
          registerItemType:
            input.registerItemType ?? normalizeAssetItemType(input.itemType),
          itemCategory: input.itemCategory,
          itemCategoryCode: input.itemCategoryCode,
          subCategory: input.subCategory,
          subItemCategory: input.subItemCategory,
          itemDescription: input.itemDescription ?? input.name,
          branchCode: input.branchCode,
          assetNum: input.assetNum,
          assetCode: input.assetCode,
          acquisitionMethod: input.acquisitionMethod,
          acquisitionOtherDetail: input.acquisitionOtherDetail,
          projectRef: input.projectRef,
          yearAcquiredRegister: input.yearAcquiredRegister ?? input.yearAcquired,
          acquiredNewOrUsed: input.acquiredNewOrUsed ?? input.acquisitionCondition,
          currentStatus: input.currentStatus,
          currentLocation: input.currentLocation ?? input.location,
          conditionRegister: input.conditionRegister,
          lastPhysicalCheck: input.lastPhysicalCheck
            ? input.lastPhysicalCheck.toISOString().slice(0, 10)
            : undefined,
          checkConductedBy: input.checkConductedBy ?? input.checkedBy,
          remarksRegister: input.remarksRegister ?? input.notes,
          actualUnitValue: input.actualUnitValue ?? input.acquisitionCost,
          depreciatedValue: input.depreciatedValue ?? input.currentDepreciatedValue?.toString(),
          acquisitionCondition: input.acquisitionCondition,
          department: input.department,
          lastCheckedAt: input.lastCheckedAt,
          checkedBy: input.checkedBy,
          physicalCondition: input.physicalCondition,
          assignedToName: input.assignedToName,
          manufacturer: input.manufacturer,
          model: input.model,
          serialNumber: input.serialNumber,
          acquisitionDate,
          acquisitionCost: input.acquisitionCost,
          currentValue: input.currentValue,
          currentDepreciatedValue: input.currentDepreciatedValue,
          depreciationRate: input.depreciationRate,
          warrantyExpiry: input.warrantyExpiry,
          location: input.location,
          assignedTo: input.assignedTo,
          imageUrl: input.imageUrl,
          notes: input.notes,
          latitude: input.latitude,
          longitude: input.longitude,
        });
      }),
    
    generateQRCode: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { generateAssetQRCode } = await import('./qrcode');
        const asset = await db.getAssetById(input.id);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        
        const qrCode = await generateAssetQRCode(asset.id, asset.assetTag);
        await db.updateAsset(asset.id, { qrCode });
        return { qrCode };
      }),

    generateBulkQRCodeLabels: protectedProcedure
      .input(z.object({
        assetIds: z.array(z.number()),
        labelSize: z.enum(['avery_5160', 'avery_5163', 'custom']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { generateBulkQRCodeLabels } = await import('./qrcode');
        
        // Get assets
        const assets = [];
        for (const id of input.assetIds) {
          const asset = await db.getAssetById(id);
          if (asset) {
            assets.push({
              id: asset.id,
              assetTag: asset.assetTag,
              name: asset.name,
            });
          }
        }
        
        if (assets.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No valid assets found' });
        }
        
        const pdfBuffer = await generateBulkQRCodeLabels(assets, input.labelSize);
        return {
          data: pdfBuffer.toString('base64'),
          filename: `qr-labels-${Date.now()}.pdf`,
          mimeType: 'application/pdf',
        };
      }),
    
    scanQRCode: protectedProcedure
      .input(z.object({ qrData: z.string() }))
      .query(async ({ input }) => {
        const { parseAssetQRCode } = await import('./qrcode');
        const parsed = parseAssetQRCode(input.qrData);
        if (!parsed) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid QR code' });
        
        const asset = await db.getAssetById(parsed.assetId);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        return asset;
      }),

    generateBarcode: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        format: z.enum(['CODE128', 'CODE39', 'EAN13']).default('CODE128'),
      }))
      .mutation(async ({ input }) => {
        const { generateBarcode, generateBarcodeValue } = await import('./barcode');
        const asset = await db.getAssetById(input.id);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        
        const barcodeValue = generateBarcodeValue(asset.assetTag, input.format);
        const barcodeImage = await generateBarcode(barcodeValue, input.format);
        
        await db.updateAsset(input.id, {
          barcode: barcodeValue,
          barcodeFormat: input.format,
        });
        
        return { barcode: barcodeValue, image: barcodeImage, format: input.format };
      }),

    scanBarcode: protectedProcedure
      .input(z.object({ barcode: z.string() }))
      .query(async ({ input }) => {
        const asset = await db.getAssetByBarcode(input.barcode);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        return asset;
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        assetTag: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        categoryId: z.number().optional(),
        siteId: z.number().optional(),
        status: z.enum(["operational", "maintenance", "repair", "retired", "disposed"]).optional(),
        registerStatus: registerStatusZodEnum.optional(),
        itemType: assetItemTypeInputZod.optional(),
        registerItemType: z.enum(["Asset", "Inventory"]).optional(),
        itemCategory: z.string().optional(),
        itemCategoryCode: z.string().length(2).optional(),
        subCategory: z.string().optional(),
        subItemCategory: z.string().optional(),
        itemDescription: z.string().optional(),
        branchCode: z.string().optional(),
        assetNum: z.number().optional(),
        assetCode: z.string().optional(),
        acquisitionMethod: z.string().optional(),
        acquisitionOtherDetail: z.string().optional(),
        projectRef: z.string().optional(),
        yearAcquiredRegister: z.number().min(1900).max(2100).optional(),
        acquiredNewOrUsed: z.enum(["New", "Used"]).optional(),
        currentStatus: z.enum(["In Use", "In Store", "Under Maintenance", "Disposed", "To be Disposed"]).optional(),
        currentLocation: z.string().optional(),
        conditionRegister: z.enum(["Good", "Fair", "Damaged", "Beyond Repair (For Disposal)", "Out of Order (To be repaired)"]).optional(),
        lastPhysicalCheck: z.date().optional(),
        checkConductedBy: z.string().optional(),
        remarksRegister: z.string().optional(),
        actualUnitValue: z.string().optional(),
        depreciatedValue: z.string().optional(),
        acquisitionCondition: z.enum(["New", "Used"]).optional(),
        department: z.string().optional(),
        lastCheckedAt: z.date().optional(),
        checkedBy: z.string().optional(),
        physicalCondition: z.enum(["Good", "Fair", "Damaged", "Beyond Repair"]).optional(),
        assignedToName: z.string().optional(),
        manufacturer: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        acquisitionDate: z.date().optional(),
        yearAcquired: z.number().min(1900).max(2100).optional(),
        acquisitionCost: z.string().optional(),
        currentValue: z.string().optional(),
        currentDepreciatedValue: z.number().optional(),
        depreciationRate: z.string().optional(),
        warrantyExpiry: z.date().optional(),
        location: z.string().optional(),
        assignedTo: z.number().optional(),
        imageUrl: z.string().optional(),
        notes: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, yearAcquired, registerStatus, status, ...rest } = input;
        const data: Record<string, unknown> = { ...rest };
        if (rest.itemType !== undefined) {
          data.itemType = normalizeAssetItemType(rest.itemType);
        }
        if (registerStatus !== undefined) {
          data.registerStatus = registerStatus;
          data.status = status ?? legacyStatusFromRegister(registerStatus);
        } else if (status !== undefined) {
          data.status = status;
        }
        if (yearAcquired !== undefined) {
          data.acquisitionDate = new Date(Date.UTC(yearAcquired, 5, 15));
        }
        await db.logAuditEntry({
          userId: ctx.user.id,
          action: 'update',
          entityType: 'asset',
          entityId: id,
          changes: JSON.stringify(data),
        });
        return await db.updateAsset(id, data as Parameters<typeof db.updateAsset>[1]);
      }),

    getExpiringWarranties: protectedProcedure
      .query(async () => {
        return await db.getExpiringWarranties();
      }),

    sendWarrantyAlert: managerOrAdminProcedure
      .input(z.object({ assetId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const asset = await db.getAssetById(input.assetId);
        if (!asset || !asset.warrantyExpiry) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Asset not found or no warranty expiry date' });
        }

        const daysUntilExpiry = Math.ceil((new Date(asset.warrantyExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        await notificationHelper.sendWarrantyExpirationAlert({
          assetId: asset.id,
          assetName: asset.name,
          assetTag: asset.assetTag,
          warrantyExpiry: asset.warrantyExpiry,
          daysUntilExpiry,
          manufacturer: asset.manufacturer || 'N/A',
          model: asset.model || 'N/A',
        });

        return { success: true };
      }),

    bulkDelete: managerOrAdminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        let deleted = 0;
        for (const id of input.ids) {
          try {
            await db.deleteAsset(id);
            await db.createAuditLog({
              userId: ctx.user.id,
              action: "bulk_delete_asset",
              entityType: "asset",
              entityId: id,
            });
            deleted++;
          } catch (error) {
            console.error(`Failed to delete asset ${id}:`, error);
          }
        }
        return { deleted, total: input.ids.length };
      }),

    bulkUpdateStatus: managerOrAdminProcedure
      .input(z.object({
        ids: z.array(z.number()),
        status: z.enum(["operational", "maintenance", "repair", "retired", "disposed"]),
      }))
      .mutation(async ({ input, ctx }) => {
        let updated = 0;
        for (const id of input.ids) {
          try {
            await db.updateAsset(id, { status: input.status });
            await db.createAuditLog({
              userId: ctx.user.id,
              action: "bulk_update_asset_status",
              entityType: "asset",
              entityId: id,
              changes: JSON.stringify({ status: input.status }),
            });
            updated++;
          } catch (error) {
            console.error(`Failed to update asset ${id}:`, error);
          }
        }
        return { updated, total: input.ids.length };
      }),
  }),

  // ============= WORK ORDERS =============
  workOrders: router({
    list: protectedProcedure
      .input(z.object({
        siteId: z.number().optional(),
        status: z.string().optional(),
        assignedTo: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllWorkOrders(input);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkOrderById(input.id);
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
        const { id, ...data } = input;
        
        // Get existing work order to check for changes
        const existingWorkOrder = await db.getWorkOrderById(id);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "update_work_order",
          entityType: "work_order",
          entityId: id,
          changes: JSON.stringify(data),
        });
        
        const result = await db.updateWorkOrder(id, data);
        
        // Notify on status change to completed
        if (data.status === "completed" && existingWorkOrder?.status !== "completed") {
          if (existingWorkOrder?.requestedBy) {
            await notificationHelper.notifyWorkOrderCompleted(
              existingWorkOrder.requestedBy,
              id,
              existingWorkOrder.title
            );
          }
        }
        
        // Notify newly assigned user
        if (data.assignedTo && data.assignedTo !== existingWorkOrder?.assignedTo) {
          await notificationHelper.notifyWorkOrderAssigned(
            data.assignedTo,
            id,
            existingWorkOrder?.title || "Work Order"
          );
        }
        
        return result;
      }),
  }),

  // ============= MAINTENANCE SCHEDULES =============
  maintenance: router({
    list: protectedProcedure
      .input(z.object({
        assetId: z.number().optional(),
        isActive: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllMaintenanceSchedules(input);
      }),
    
    upcoming: protectedProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ input }) => {
        return await db.getUpcomingMaintenance(input.days);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        assetId: z.number(),
        frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]),
        frequencyValue: z.number().default(1),
        nextDue: z.date(),
        assignedTo: z.number().optional(),
        taskTemplate: z.string().optional(),
        estimatedDuration: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const schedule = await db.createMaintenanceSchedule(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "create_maintenance_schedule",
          entityType: "maintenance_schedule",
          entityId: schedule?.id,
        });
        return schedule;
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]).optional(),
        frequencyValue: z.number().optional(),
        lastPerformed: z.date().optional(),
        nextDue: z.date().optional(),
        assignedTo: z.number().optional(),
        isActive: z.boolean().optional(),
        taskTemplate: z.string().optional(),
        estimatedDuration: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "update_maintenance_schedule",
          entityType: "maintenance_schedule",
          entityId: id,
          changes: JSON.stringify(data),
        });
        return await db.updateMaintenanceSchedule(id, data);
      }),

    // Predictive Maintenance AI
    getPredictions: protectedProcedure
      .query(async () => {
        const { getAllMaintenancePredictions } = await import('./predictiveMaintenance');
        return await getAllMaintenancePredictions();
      }),

    getHighPriorityPredictions: protectedProcedure
      .query(async () => {
        const { getHighPriorityPredictions } = await import('./predictiveMaintenance');
        return await getHighPriorityPredictions();
      }),

    getAssetPrediction: protectedProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        const { analyzeAssetMaintenancePattern } = await import('./predictiveMaintenance');
        return await analyzeAssetMaintenancePattern(input.assetId);
      }),

    autoCreateWorkOrders: managerOrAdminProcedure
      .mutation(async ({ ctx }) => {
        const { autoCreatePreventiveWorkOrders } = await import('./predictiveMaintenance');
        const workOrderIds = await autoCreatePreventiveWorkOrders(ctx.user.id);
        return { created: workOrderIds.length, workOrderIds };
      }),
  }),

  // ============= INVENTORY =============
  inventory: router({
    list: protectedProcedure
      .input(z.object({ siteId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllInventoryItems(input?.siteId);
      }),
    
    lowStock: protectedProcedure
      .input(z.object({ siteId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getLowStockItems(input?.siteId);
      }),
    
    transactions: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInventoryTransactions(input.itemId);
      }),
    
    create: staffOrAboveProcedure
      .input(z.object({
        itemCode: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        siteId: z.number(),
        currentStock: z.number().default(0),
        minStockLevel: z.number().default(0),
        reorderPoint: z.number().default(0),
        maxStockLevel: z.number().optional(),
        unitOfMeasure: z.string().optional(),
        unitCost: z.string().optional(),
        vendorId: z.number().optional(),
        location: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createInventoryItem(input);
      }),
    
    update: staffOrAboveProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        currentStock: z.number().optional(),
        minStockLevel: z.number().optional(),
        reorderPoint: z.number().optional(),
        maxStockLevel: z.number().optional(),
        unitOfMeasure: z.string().optional(),
        unitCost: z.string().optional(),
        vendorId: z.number().optional(),
        location: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const before = await db.getInventoryItemById(id);
        if (!before) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found" });
        }
        const updated = await db.updateInventoryItem(id, data);
        if (updated) {
          await notificationHelper.notifyManagersWhenInventoryBecomesLow(
            { currentStock: before.currentStock, minStockLevel: before.minStockLevel },
            updated
          );
        }
        return updated;
      }),

    movements: protectedProcedure
      .input(
        z
          .object({
            siteId: z.number().optional(),
            itemId: z.number().optional(),
            startDate: z.coerce.date().optional(),
            endDate: z.coerce.date().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return await db.getInventoryMovements(input ?? {});
      }),

    submitStockCount: protectedProcedure
      .input(
        z.object({
          siteId: z.number(),
          lines: z.array(
            z.object({
              itemId: z.number(),
              countedQty: z.number().int().min(0),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);

        for (const line of input.lines) {
          const before = await db.getInventoryItemById(line.itemId);
          if (!before || before.siteId !== input.siteId) continue;
          if (line.countedQty < before.currentStock) {
            requireRole(ctx, ["manager", "admin"]);
            break;
          }
        }

        const discrepancies: Array<{
          itemId: number;
          itemCode: string;
          itemName: string;
          expected: number;
          counted: number;
          variance: number;
        }> = [];

        for (const line of input.lines) {
          const before = await db.getInventoryItemById(line.itemId);
          if (!before || before.siteId !== input.siteId) continue;

          const expected = before.currentStock;
          const counted = line.countedQty;
          const variance = counted - expected;
          if (variance === 0) continue;

          await db.createInventoryTransaction({
            itemId: line.itemId,
            type: "adjustment",
            quantity: counted,
            performedBy: ctx.user.id,
            notes: `Stock count: expected ${expected}, counted ${counted}, variance ${variance >= 0 ? "+" : ""}${variance}`,
          });

          const updated = await db.updateInventoryItem(line.itemId, { currentStock: counted });
          if (updated) {
            await notificationHelper.notifyManagersWhenInventoryBecomesLow(
              { currentStock: before.currentStock, minStockLevel: before.minStockLevel },
              updated
            );
          }

          discrepancies.push({
            itemId: before.id,
            itemCode: before.itemCode,
            itemName: before.name,
            expected,
            counted,
            variance,
          });
        }

        return { discrepancies, adjustedLines: discrepancies.length };
      }),
    
    addTransaction: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        type: z.enum(["in", "out", "adjustment", "transfer"]),
        quantity: z.number(),
        workOrderId: z.number().optional(),
        fromSiteId: z.number().optional(),
        toSiteId: z.number().optional(),
        unitCost: z.string().optional(),
        totalCost: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);

        const itemBefore = await db.getInventoryItemById(input.itemId);
        if (!itemBefore) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found" });
        }
        const previousStock = itemBefore.currentStock;

        let newStock = itemBefore.currentStock;
        if (input.type === "in") newStock += input.quantity;
        else if (input.type === "out") newStock -= input.quantity;
        else if (input.type === "adjustment") newStock = input.quantity;

        if (input.type === "adjustment" && input.quantity < previousStock) {
          requireRole(ctx, ["manager", "admin"]);
        }
        if (input.type === "out" && previousStock - input.quantity < 0) {
          requireRole(ctx, ["manager", "admin"]);
        }

        const transaction = await db.createInventoryTransaction({
          ...input,
          performedBy: ctx.user.id,
        });
        
        if (input.type !== "transfer") {
          const updated = await db.updateInventoryItem(input.itemId, { currentStock: newStock });
          if (updated) {
            await notificationHelper.notifyManagersWhenInventoryBecomesLow(
              { currentStock: previousStock, minStockLevel: itemBefore.minStockLevel },
              updated
            );
          }
        }
        
        return transaction;
      }),

    deleteTransaction: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const ok = await db.deleteInventoryTransaction(input.id);
        if (!ok) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
        }
        return { success: true as const };
      }),

    bulkDelete: managerOrAdminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        let deleted = 0;
        for (const id of input.ids) {
          try {
            await db.deleteInventoryItem(id);
            await db.createAuditLog({
              userId: ctx.user.id,
              action: "bulk_delete_inventory",
              entityType: "inventory",
              entityId: id,
            });
            deleted++;
          } catch (error) {
            console.error(`Failed to delete inventory item ${id}:`, error);
          }
        }
        return { deleted, total: input.ids.length };
      }),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getInventoryItemById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found" });
        }
        const ok = await db.deleteInventoryItem(input.id);
        if (!ok) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete inventory item" });
        }
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "delete_inventory",
          entityType: "inventory",
          entityId: input.id,
        });
        return { success: true as const };
      }),
  }),
  inventoryV2: inventoryV2Router,
  wms: wmsRouter,

  // ============= VENDORS =============
  vendors: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllVendors();
    }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        vendorCode: z.string().optional(),
        contactPerson: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        website: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createVendor(input);
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        contactPerson: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        website: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateVendor(id, data);
      }),
  }),

  // ============= FINANCIAL TRANSACTIONS =============
  financial: router({
    list: protectedProcedure
      .input(z.object({
        assetId: z.number().optional(),
        workOrderId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getFinancialTransactions(input);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        transactionType: z.enum(["acquisition", "maintenance", "repair", "disposal", "depreciation", "revenue", "other"]),
        assetId: z.number().optional(),
        workOrderId: z.number().optional(),
        amount: z.string(),
        currency: z.string().default("NGN"),
        description: z.string().optional(),
        transactionDate: z.string(),
        vendorId: z.number().optional(),
        receiptNumber: z.string().optional(),
        approvedBy: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createFinancialTransaction({
          ...input,
          transactionDate: new Date(input.transactionDate),
          createdBy: ctx.user.id,
        });
      }),

    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        transactionType: z.enum(["acquisition", "maintenance", "repair", "disposal", "depreciation", "revenue", "other"]).optional(),
        amount: z.string().optional(),
        description: z.string().optional(),
        transactionDate: z.string().optional(),
        receiptNumber: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: any = { ...data };
        if (data.transactionDate) {
          updateData.transactionDate = new Date(data.transactionDate);
        }
        return await db.updateFinancialTransaction(id, updateData);
      }),

    // Lifecycle Cost Analysis
    getAssetLifecycleCost: protectedProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        const { calculateAssetLifecycleCost } = await import('./lifecycleCost');
        return await calculateAssetLifecycleCost(input.assetId);
      }),

    getCategoryCostSummary: protectedProcedure
      .query(async () => {
        const { getCategoryCostSummary } = await import('./lifecycleCost');
        return await getCategoryCostSummary();
      }),

    getCostOptimizationRecommendations: protectedProcedure
      .query(async () => {
        const { getCostOptimizationRecommendations } = await import('./lifecycleCost');
        return await getCostOptimizationRecommendations();
      }),

    getCostAnalytics: protectedProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ input }) => {
        return await db.getCostAnalytics(input.days);
      }),
  }),

  // ============= COMPLIANCE =============
  compliance: router({
    list: protectedProcedure
      .input(z.object({
        assetId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllComplianceRecords(input);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        assetId: z.number().optional(),
        title: z.string().min(1),
        regulatoryBody: z.string().optional(),
        requirementType: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["compliant", "non_compliant", "pending", "expired"]).default("pending"),
        dueDate: z.date().optional(),
        completionDate: z.date().optional(),
        nextReviewDate: z.date().optional(),
        assignedTo: z.number().optional(),
        documentUrl: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createComplianceRecord(input);
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        regulatoryBody: z.string().optional(),
        requirementType: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["compliant", "non_compliant", "pending", "expired"]).optional(),
        dueDate: z.date().optional(),
        completionDate: z.date().optional(),
        nextReviewDate: z.date().optional(),
        assignedTo: z.number().optional(),
        documentUrl: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateComplianceRecord(id, data);
      }),
  }),

  // ============= DASHBOARD =============
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return await db.getDashboardStats();
    }),
    weeklyInsights: protectedProcedure.query(async () => {
      return await db.getWeeklyInsights();
    }),
    smartInsights: protectedProcedure.query(async () => {
      const [stats, weekly, lowStock] = await Promise.all([
        db.getDashboardStats(),
        db.getWeeklyInsights(),
        db.getLowStockItems(),
      ]);
      const totalInventory = Math.max(1, Number((stats as any)?.totalInventory ?? 0));
      const lowStockCount = Number((stats as any)?.lowStockItems ?? lowStock.length);
      const stockAvailabilityPct = ((totalInventory - lowStockCount) / totalInventory) * 100;
      const successfulDistributions = Number((weekly as any)?.lowStockItems ?? 0) >= 0 ? Number((weekly as any)?.lowStockItems ?? 0) : 0;

      return {
        good: {
          stockAvailabilityPct,
          successfulDistributions,
        },
        attentionNeeded: {
          belowSafetyStock: lowStockCount,
          expiringWithin30Days: Number((weekly as any)?.warrantiesExpiringNext30Days ?? 0),
          emergencyRequisitionsPending: 0,
        },
        recommendations: {
          safetyStockAdjustments: lowStock.slice(0, 10).map((x: any) => ({
            itemCode: x.itemCode ?? x.assetTag ?? "N/A",
            warehouseName: x.siteName ?? "N/A",
            current: x.currentStock ?? 0,
            safety: x.minStockLevel ?? 0,
          })),
          overstockTransfers: [],
          deadStockReview: [],
        },
      };
    }),
    metrics: protectedProcedure
      .input(
        z.object({
          period: z.enum(["Today", "Week", "Month", "Quarter", "Year"]),
        })
      )
      .query(async ({ input }) => {
        const stats = await db.getDashboardStats();
        const database = await db.getDb();

        let stockReadiness: {
          adequate: number;
          total: number;
          delta: number;
          direction: "up" | "down" | "flat";
          tone: "green" | "amber" | "red";
          goodWhen: "up";
        } = {
          adequate: 0,
          total: 0,
          delta: 0,
          direction: "flat" as const,
          tone: "red" as const,
          goodWhen: "up" as const,
        };
        let distributionVelocity: {
          value: number;
          deltaPercent: number;
          direction: "up" | "down" | "flat";
          hasData: boolean;
          goodWhen: "up";
        } = {
          value: 0,
          deltaPercent: 0,
          direction: "flat" as const,
          hasData: false,
          goodWhen: "up" as const,
        };
        let activeFacilitiesKpi = { value: 0, total: 0, offline: 0, goodWhen: "up" as const };

        if (database) {
          const window = getPeriodWindow(input.period);
          const [
            activeFacilities,
            totalFacilities,
            inactiveFacilities,
            currentAdequateRows,
            previousAdequateRows,
            currentDist,
            previousDist,
            historicalDist,
          ] =
            await Promise.all([
              database
                .select({ id: sites.id })
                .from(sites)
                .where(eq(sites.isActive, true)),
              database.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(sites),
              database
                .select({ total: sql<number>`count(*)`.mapWith(Number) })
                .from(sites)
                .where(eq(sites.isActive, false)),
              database
                .selectDistinct({ locationId: stockCards.locationId })
                .from(stockMovements)
                .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
                .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
                .leftJoin(
                  stockSettings,
                  and(
                    eq(stockSettings.catalogueId, commodityTrackingNumbers.itemId),
                    eq(stockSettings.warehouseId, stockCards.locationId)
                  )
                )
                .innerJoin(sites, eq(stockCards.locationId, sites.id))
                .where(and(eq(sites.isActive, true), sql`(${stockMovements.quantityIn} - ${stockMovements.quantityOut}) > coalesce(${stockSettings.minLevel}, 0)`)),
              database
                .selectDistinct({ locationId: stockCards.locationId })
                .from(stockMovements)
                .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
                .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
                .leftJoin(
                  stockSettings,
                  and(eq(stockSettings.warehouseId, stockCards.locationId), eq(stockSettings.catalogueId, commodityTrackingNumbers.itemId))
                )
                .where(
                  and(
                    lte(stockMovements.date, window.previousEndIso),
                    sql`(${stockMovements.quantityIn} - ${stockMovements.quantityOut}) > coalesce(${stockSettings.minLevel}, 0)`
                  )
                ),
              database
                .select({ total: sql<number>`coalesce(sum(${stockMovements.quantityOut}),0)`.mapWith(Number) })
                .from(stockMovements)
                .innerJoin(waybills, eq(stockMovements.documentRef, waybills.wbNumber))
                .where(
                  and(
                    eq(stockMovements.sourceType, "waybill"),
                    eq(waybills.destinationType, "distribution_point"),
                    gte(stockMovements.date, window.currentStartIso),
                    lte(stockMovements.date, window.currentEndIso)
                  )
                ),
              database
                .select({ total: sql<number>`coalesce(sum(${stockMovements.quantityOut}),0)`.mapWith(Number) })
                .from(stockMovements)
                .innerJoin(waybills, eq(stockMovements.documentRef, waybills.wbNumber))
                .where(
                  and(
                    eq(stockMovements.sourceType, "waybill"),
                    eq(waybills.destinationType, "distribution_point"),
                    gte(stockMovements.date, window.previousStartIso),
                    lte(stockMovements.date, window.previousEndIso)
                  )
                ),
              database
                .select({ total: sql<number>`coalesce(sum(${stockMovements.quantityOut}),0)`.mapWith(Number) })
                .from(stockMovements)
                .innerJoin(waybills, eq(stockMovements.documentRef, waybills.wbNumber))
                .where(and(eq(stockMovements.sourceType, "waybill"), eq(waybills.destinationType, "distribution_point"))),
            ]);

          const adequate = currentAdequateRows.length;
          const previousAdequate = previousAdequateRows.length;
          const total = activeFacilities.length;
          stockReadiness = buildStockReadiness({ adequate, total, previousAdequate });

          const currentValue = Number(currentDist[0]?.total ?? 0);
          const previousValue = Number(previousDist[0]?.total ?? 0);
          const historicalValue = Number(historicalDist[0]?.total ?? 0);
          distributionVelocity = buildDistributionVelocity({
            current: currentValue,
            previous: previousValue,
            historicalTotal: historicalValue,
          });

          activeFacilitiesKpi = {
            value: activeFacilities.length,
            total: Number(totalFacilities[0]?.total ?? 0),
            offline: Number(inactiveFacilities[0]?.total ?? 0),
            goodWhen: "up" as const,
          };
        }
        return {
          lowStockItems: {
            value: Number(stats?.lowStockItems ?? 0),
            // Hide delta until there is a validated period-over-period low-stock query.
            delta: undefined,
            direction: "flat" as const,
            goodWhen: "down" as const,
          },
          activeFacilities: activeFacilitiesKpi,
          stockReadiness,
          distributionVelocity,
        };
      }),
    stockMovement: protectedProcedure
      .input(z.object({ weeks: z.number().min(4).max(26).default(12) }).optional())
      .query(async ({ input }) => {
        const weeks = input?.weeks ?? 12;
        const database = await db.getDb();
        if (!database) return [];

        const startDate = new Date();
        startDate.setUTCDate(startDate.getUTCDate() - (weeks * 7 - 1));
        const startDateIso = startDate.toISOString().slice(0, 10);

        const rows = await database
          .select({
            weekStart: sql<string>`to_char(date_trunc('week', ${stockMovements.date}::timestamp), 'YYYY-MM-DD')`,
            inbound: sql<number>`coalesce(sum(${stockMovements.quantityIn}), 0)`.mapWith(Number),
            outbound: sql<number>`coalesce(sum(${stockMovements.quantityOut}), 0)`.mapWith(Number),
          })
          .from(stockMovements)
          .where(gte(stockMovements.date, startDateIso))
          .groupBy(sql`date_trunc('week', ${stockMovements.date}::timestamp)`)
          .orderBy(sql`date_trunc('week', ${stockMovements.date}::timestamp) asc`);

        return rows.map((row) => ({
          w: row.weekStart,
          inbound: Number(row.inbound ?? 0),
          outbound: Number(row.outbound ?? 0),
        }));
      }),
    recentActivity: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(20).default(5) }).optional())
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) return [];

        const limit = input?.limit ?? 5;
        const recentMovementRows = await database
          .select({
            type: stockMovements.sourceType,
            description: stockMovements.documentRef,
            timestamp: stockMovements.createdAt,
            facilityName: sites.name,
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(sites, eq(stockCards.locationId, sites.id))
          .where(sql`${stockMovements.sourceType} in ('grn', 'waybill')`)
          .orderBy(sql`${stockMovements.createdAt} desc`)
          .limit(10);

        const recentRequisitionRows = await database
          .select({
            type: sql<string>`'requisition'`,
            description: sql<string>`case
              when ${requisitions.status} = 'approved' then concat('Requisition approved · ', ${requisitions.reqNumber})
              else concat('Requisition submitted · ', ${requisitions.reqNumber})
            end`,
            timestamp: sql<Date>`coalesce(${requisitions.approvedHqAt}, ${requisitions.approvedBranchAt}, ${requisitions.createdAt})`,
            facilityName: sites.name,
          })
          .from(requisitions)
          .innerJoin(sites, eq(requisitions.requestingFacility, sites.id))
          .where(sql`${requisitions.status} in ('submitted', 'approved')`)
          .orderBy(sql`coalesce(${requisitions.approvedHqAt}, ${requisitions.approvedBranchAt}, ${requisitions.createdAt}) desc`)
          .limit(10);

        const recentAssetRows = await database
          .select({
            type: sql<string>`'asset'`,
            description: sql<string>`concat('Asset created · ', ${assets.assetTag})`,
            timestamp: assets.createdAt,
            facilityName: sites.name,
          })
          .from(assets)
          .innerJoin(sites, eq(assets.siteId, sites.id))
          .orderBy(sql`${assets.createdAt} desc`)
          .limit(10);

        const recentTransferRows = await database
          .select({
            type: sql<string>`'asset_transfer'`,
            description: sql<string>`concat('Asset transferred · ', ${assets.assetTag})`,
            timestamp: sql<Date>`coalesce(${assetTransfers.transferDate}, ${assetTransfers.createdAt})`,
            facilityName: sites.name,
          })
          .from(assetTransfers)
          .innerJoin(assets, eq(assetTransfers.assetId, assets.id))
          .innerJoin(sites, eq(assetTransfers.toSiteId, sites.id))
          .orderBy(sql`coalesce(${assetTransfers.transferDate}, ${assetTransfers.createdAt}) desc`)
          .limit(10);

        return [...recentMovementRows, ...recentRequisitionRows, ...recentAssetRows, ...recentTransferRows]
          .filter((row) => row.timestamp)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limit)
          .map((row) => ({
            type: String(row.type),
            description: row.description
              ? String(row.description)
              : row.type === "grn"
                ? "Goods received posted"
                : row.type === "waybill"
                  ? "Waybill posted"
                  : "Activity recorded",
            timestamp: new Date(row.timestamp).toISOString(),
            facilityName: row.facilityName ?? "Unknown facility",
          }));
      }),
    facilityStatus: protectedProcedure.query(async () => {
      const database = await db.getDb();
      if (!database) return [];

      const movementTotals = database
        .select({
          stockCardId: stockMovements.stockCardId,
          netQuantity: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
        })
        .from(stockMovements)
        .groupBy(stockMovements.stockCardId)
        .as("movement_totals");

      const rows = await database
        .select({
          id: sites.id,
          name: sites.name,
          code: sites.code,
          type: sites.facilityType,
          isActive: sites.isActive,
        })
        .from(sites)
        .orderBy(sql`${sites.facilityType} asc, ${sites.name} asc`)
        .limit(10);

      const scoreRows = await database
        .select({
          locationId: stockCards.locationId,
          total: sql<number>`count(distinct ${stockCards.id})`.mapWith(Number),
          adequate: sql<number>`count(distinct ${stockCards.id}) filter (where coalesce(${movementTotals.netQuantity}, 0) > coalesce(${stockSettings.minLevel}, 0))`.mapWith(Number),
        })
        .from(stockCards)
        .leftJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
        .leftJoin(
          stockSettings,
          and(
            eq(stockSettings.catalogueId, commodityTrackingNumbers.itemId),
            eq(stockSettings.warehouseId, stockCards.locationId)
          )
        )
        .leftJoin(movementTotals, eq(movementTotals.stockCardId, stockCards.id))
        .groupBy(stockCards.locationId);

      const scoreByLocation = new Map<number, { total: number; adequate: number }>();
      for (const row of scoreRows) {
        scoreByLocation.set(row.locationId, {
          total: Number(row.total ?? 0),
          adequate: Number(row.adequate ?? 0),
        });
      }

      return rows
        .map((row) => {
          const score = scoreByLocation.get(row.id);
          const stockScore = score && score.total > 0 ? Math.round((score.adequate / score.total) * 100) : null;
          return {
            id: row.id,
            name: row.name,
            code: row.code,
            type: row.type,
            status: row.isActive ? ("active" as const) : ("offline" as const),
            stockScore,
          };
        })
        .sort((a, b) => {
          if (a.stockScore === null && b.stockScore === null) return 0;
          if (a.stockScore === null) return 1;
          if (b.stockScore === null) return -1;
          return a.stockScore - b.stockScore;
        });
    }),
    pendingRequisitions: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(12).default(4) }).optional())
      .query(async () => {
        const database = await db.getDb();
        if (!database) return { total: 0, urgent: 0, oldestDaysAgo: null as number | null };

        const rows = await database
          .select({
            total: sql<number>`count(*)`.mapWith(Number),
            urgent: sql<number>`count(*) filter (where lower(${requisitions.priority}) = 'urgent')`.mapWith(Number),
            oldest: sql<Date | null>`min(${requisitions.createdAt})`,
          })
          .from(requisitions)
          .where(sql`${requisitions.status} in ('submitted', 'approved')`);

        const summary = rows[0];
        const total = Number(summary?.total ?? 0);
        const urgent = Number(summary?.urgent ?? 0);
        const oldest = summary?.oldest ? new Date(summary.oldest) : null;
        const oldestDaysAgo =
          oldest === null ? null : Math.max(0, Math.floor((Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24)));

        return { total, urgent, oldestDaysAgo };
      }),
    attentionItems: protectedProcedure
      .input(z.object({ role: z.enum(["Admin", "Manager", "Staff", "Field"]) }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        const allClear = { icon: "CheckCircle2", tone: "green", label: "No action items right now", meta: "All clear" };
        if (!database) return [allClear];

        const safe = async <T>(label: string, query: () => Promise<T>): Promise<T | null> => {
          try {
            return await query();
          } catch (error) {
            console.error(`[dashboard.attentionItems] ${label} query failed`, error);
            return null;
          }
        };

        const requisitionSummary = () =>
          safe("requisitionSummary", async () => {
            const rows = await database
              .select({
                total: sql<number>`count(*)`.mapWith(Number),
                urgent: sql<number>`count(*) filter (where lower(${requisitions.priority}) = 'urgent')`.mapWith(Number),
              })
              .from(requisitions)
              .where(eq(requisitions.status, "submitted"));
            return {
              total: Number(rows[0]?.total ?? 0),
              urgent: Number(rows[0]?.urgent ?? 0),
            };
          });

        const lowStockItems = () =>
          safe("lowStockItems", async () => {
            const stats = await db.getDashboardStats();
            return Number(stats?.lowStockItems ?? 0);
          });

        const lowStockFacilities = () =>
          safe("lowStockFacilities", async () => {
            const movementTotals = database
              .select({
                stockCardId: stockMovements.stockCardId,
                netQuantity: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
              })
              .from(stockMovements)
              .groupBy(stockMovements.stockCardId)
              .as("movement_totals_attention");

            const rows = await database
              .select({
                count: sql<number>`count(distinct ${stockCards.locationId}) filter (where coalesce(${movementTotals.netQuantity}, 0) < coalesce(${stockSettings.minLevel}, 0) and coalesce(${stockSettings.minLevel}, 0) > 0)`.mapWith(Number),
              })
              .from(stockCards)
              .leftJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
              .leftJoin(
                stockSettings,
                and(
                  eq(stockSettings.warehouseId, stockCards.locationId),
                  eq(stockSettings.catalogueId, commodityTrackingNumbers.itemId)
                )
              )
              .leftJoin(movementTotals, eq(movementTotals.stockCardId, stockCards.id));

            return Number(rows[0]?.count ?? 0);
          });

        if (input.role === "Admin") {
          const [pendingUserCount, failedLoginsCount, reqSummary, inactiveFacilities, grnDrafts] = await Promise.all([
            safe("pendingUsers", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(pendingUsers)
                .where(eq(pendingUsers.status, "pending"));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("failedLogins24h", async () => {
              const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(auditLogs)
                .where(and(ilike(auditLogs.action, "%fail%"), gte(auditLogs.timestamp, since)));
              return Number(rows[0]?.count ?? 0);
            }),
            requisitionSummary(),
            safe("inactiveFacilities", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(sites)
                .where(eq(sites.isActive, false));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("grnDrafts", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(goodsReceivedNotes)
                .where(eq(goodsReceivedNotes.status, "draft"));
              return Number(rows[0]?.count ?? 0);
            }),
          ]);

          const items: Array<{ icon: string; tone: string; label: string; meta: string }> = [];
          if ((pendingUserCount ?? 0) > 0) {
            items.push({
              icon: "Users",
              tone: "amber",
              label: `${pendingUserCount} user ${pendingUserCount === 1 ? "registration" : "registrations"} pending`,
              meta: "Access",
            });
          }
          if ((failedLoginsCount ?? 0) > 0) {
            items.push({
              icon: "AlertTriangle",
              tone: "red",
              label: `${failedLoginsCount} failed login attempt${failedLoginsCount === 1 ? "" : "s"} in last 24h`,
              meta: "Security",
            });
          }
          if (reqSummary) {
            items.push({
              icon: "ClipboardList",
              tone: reqSummary.total > 0 ? "red" : "green",
              label:
                reqSummary.total > 0
                  ? `${reqSummary.total} requisition${reqSummary.total === 1 ? "" : "s"} awaiting approval`
                  : "No pending requisitions",
              meta: reqSummary.urgent > 0 ? `${reqSummary.urgent} urgent` : "Up to date",
            });
          }
          if ((inactiveFacilities ?? 0) > 0) {
            items.push({
              icon: "MapPin",
              tone: "amber",
              label: `${inactiveFacilities} facilit${inactiveFacilities === 1 ? "y" : "ies"} marked offline`,
              meta: "Facilities",
            });
          }
          if ((grnDrafts ?? 0) > 0) {
            items.push({
              icon: "FileText",
              tone: "blue",
              label: `${grnDrafts} GRN draft${grnDrafts === 1 ? "" : "s"} not finalised`,
              meta: "Inventory",
            });
          }
          return (items.length > 0 ? items : [allClear]).slice(0, 4);
        }

        if (input.role === "Manager") {
          const [reqSummary, lowStockCount, overdueMaintenanceCount, waybillDrafts, grnDrafts] = await Promise.all([
            requisitionSummary(),
            lowStockItems(),
            safe("overdueMaintenance", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(maintenanceSchedules)
                .where(and(eq(maintenanceSchedules.isActive, true), sql`${maintenanceSchedules.nextDue} < now()`));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("waybillDrafts", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(waybills)
                .where(eq(waybills.status, "draft"));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("grnDrafts", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(goodsReceivedNotes)
                .where(eq(goodsReceivedNotes.status, "draft"));
              return Number(rows[0]?.count ?? 0);
            }),
          ]);

          const items: Array<{ icon: string; tone: string; label: string; meta: string }> = [];
          if (reqSummary) {
            items.push({
              icon: "ClipboardList",
              tone: reqSummary.total > 0 ? "red" : "green",
              label:
                reqSummary.total > 0
                  ? `${reqSummary.total} requisition${reqSummary.total === 1 ? "" : "s"} awaiting approval`
                  : "No pending requisitions",
              meta: reqSummary.urgent > 0 ? `${reqSummary.urgent} urgent` : "Up to date",
            });
          }
          if ((lowStockCount ?? 0) > 0) {
            items.push({
              icon: "Package",
              tone: "amber",
              label: `${lowStockCount} item${lowStockCount === 1 ? "" : "s"} below reorder level`,
              meta: "Low stock",
            });
          }
          if ((overdueMaintenanceCount ?? 0) > 0) {
            items.push({
              icon: "Wrench",
              tone: "orange",
              label: `${overdueMaintenanceCount} maintenance task${overdueMaintenanceCount === 1 ? "" : "s"} overdue`,
              meta: "Maintenance",
            });
          }
          if ((waybillDrafts ?? 0) > 0) {
            items.push({
              icon: "Truck",
              tone: "blue",
              label: `${waybillDrafts} waybill${waybillDrafts === 1 ? "" : "s"} not yet dispatched`,
              meta: "Outgoing",
            });
          }
          if ((grnDrafts ?? 0) > 0) {
            items.push({
              icon: "FileText",
              tone: "blue",
              label: `${grnDrafts} GRN draft${grnDrafts === 1 ? "" : "s"} not finalised`,
              meta: "Inventory",
            });
          }
          return (items.length > 0 ? items : [allClear]).slice(0, 4);
        }

        if (input.role === "Staff") {
          const [grnDrafts, waybillDrafts, stockCountsInProgress, pendingReqCount] = await Promise.all([
            safe("grnDrafts", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(goodsReceivedNotes)
                .where(eq(goodsReceivedNotes.status, "draft"));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("waybillDrafts", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(waybills)
                .where(eq(waybills.status, "draft"));
              return Number(rows[0]?.count ?? 0);
            }),
            safe("stockCountsInProgress", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(inventoryCounts)
                .where(sql`${inventoryCounts.status} in ('pending', 'in_progress')`);
              return Number(rows[0]?.count ?? 0);
            }),
            safe("submittedReqs", async () => {
              const rows = await database
                .select({ count: sql<number>`count(*)`.mapWith(Number) })
                .from(requisitions)
                .where(eq(requisitions.status, "submitted"));
              return Number(rows[0]?.count ?? 0);
            }),
          ]);

          const items: Array<{ icon: string; tone: string; label: string; meta: string }> = [];
          if ((grnDrafts ?? 0) > 0) {
            items.push({
              icon: "FileText",
              tone: "red",
              label: `${grnDrafts} GRN draft${grnDrafts === 1 ? "" : "s"} awaiting finalisation`,
              meta: "Receiving",
            });
          }
          if ((waybillDrafts ?? 0) > 0) {
            items.push({
              icon: "Truck",
              tone: "amber",
              label: `${waybillDrafts} waybill${waybillDrafts === 1 ? "" : "s"} ready to dispatch`,
              meta: "Outgoing",
            });
          }
          if ((stockCountsInProgress ?? 0) > 0) {
            items.push({
              icon: "ClipboardList",
              tone: "blue",
              label: `${stockCountsInProgress} stock count${stockCountsInProgress === 1 ? "" : "s"} in progress`,
              meta: "Stock takes",
            });
          }
          if ((pendingReqCount ?? 0) > 0) {
            items.push({
              icon: "Package",
              tone: "blue",
              label: `${pendingReqCount} requisition${pendingReqCount === 1 ? "" : "s"} submitted, awaiting approval`,
              meta: "Requisitions",
            });
          }
          return (items.length > 0 ? items : [allClear]).slice(0, 4);
        }

        const [activeWaybills, pendingReqCount, lowStockFacilityCount] = await Promise.all([
          safe("activeWaybills", async () => {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const rows = await database
              .select({ count: sql<number>`count(*)`.mapWith(Number) })
              .from(waybills)
              .where(and(eq(waybills.status, "dispatched"), gte(waybills.createdAt, since)));
            return Number(rows[0]?.count ?? 0);
          }),
          safe("fieldPendingReqs", async () => {
            const rows = await database
              .select({ count: sql<number>`count(*)`.mapWith(Number) })
              .from(requisitions)
              .where(sql`${requisitions.status} in ('submitted', 'draft')`);
            return Number(rows[0]?.count ?? 0);
          }),
          lowStockFacilities(),
        ]);

        const items: Array<{ icon: string; tone: string; label: string; meta: string }> = [];
        if ((activeWaybills ?? 0) > 0) {
          items.push({
            icon: "Truck",
            tone: "red",
            label: `${activeWaybills} active distribution${activeWaybills === 1 ? "" : "s"} this week`,
            meta: "In progress",
          });
        }
        if ((pendingReqCount ?? 0) > 0) {
          items.push({
            icon: "ClipboardList",
            tone: "amber",
            label: `${pendingReqCount} requisition${pendingReqCount === 1 ? "" : "s"} pending`,
            meta: "Submitted",
          });
        }
        if ((lowStockFacilityCount ?? 0) > 0) {
          items.push({
            icon: "AlertTriangle",
            tone: "amber",
            label: `${lowStockFacilityCount} facilit${lowStockFacilityCount === 1 ? "y" : "ies"} have low stock`,
            meta: "Low stock",
          });
        }
        items.push({ icon: "CheckCircle2", tone: "green", label: "System operational", meta: "NRCS EAM" });
        return items.slice(0, 4);
      }),
  }),

  search: router({
    global: protectedProcedure
      .input(z.object({ query: z.string().min(2).max(100) }))
      .query(async ({ input, ctx }) => {
        const raw = input.query.trim();
        const [assets, workOrders, inventory, sites] = await Promise.all([
          db.searchAssetsGlobal(raw),
          db.searchWorkOrdersGlobal(raw),
          db.searchInventoryGlobal(raw),
          db.searchSitesGlobal(raw),
        ]);
        const users = ctx.user.role === "admin" ? await db.searchUsersGlobal(raw) : [];
        return { assets, workOrders, inventory, sites, users };
      }),
  }),

  // ============= USERS MANAGEMENT =============
  users: router({
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
      .mutation(async ({ input }) => {
        const email = input.email.trim().toLowerCase();
        const existing = await db.getUserByEmailLowercase(email);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A user with this email already exists",
          });
        }

        const tempPassword = generateSupabaseCompliantTempPassword(12);
        const supabase = getSupabaseServiceRole();
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

        try {
          await db.insertAppUserLinkedToAuth({
            authUserId: data.user.id,
            email,
            name: input.name.trim(),
            role: input.role,
            siteId: input.facilityId ?? null,
            status: "active",
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
          const admin = getSupabaseServiceRole();
          const nextName = name !== undefined ? name.trim() : (target.name ?? "");
          await admin.auth.admin.updateUserById(target.authUserId, {
            user_metadata: { full_name: nextName },
          });
        }

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
        return { success: true as const };
      }),

    resetPassword: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const email = input.email.trim().toLowerCase();
        const supabase = getSupabaseServiceRole();
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
        return {
          success: true as const,
          message: `Password reset email sent to ${email}`,
        };
      }),

    completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      await db.updateUser(ctx.user.id, { hasCompletedOnboarding: true });
      return { success: true };
    }),
  }),

  // ============= NOTIFICATIONS =============
  notifications: router({
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
      .mutation(async ({ input }) => {
        return await db.markNotificationAsRead(input.id);
      }),
    
    markAllAsRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        return await db.markAllNotificationsAsRead(ctx.user.id);
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteNotification(input.id);
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
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.upsertNotificationPreferences(ctx.user.id, input);
      }),
  }),

  // Reports
  reports: router({
    // Asset Reports
    assetInventory: protectedProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        categoryId: z.number().optional(),
        status: z.enum(['operational', 'maintenance', 'retired', 'disposed']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const assets = await db.getAllAssets();

        const columns = [
          { header: 'Asset Tag', key: 'assetTag', width: 15 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Category', key: 'categoryName', width: 15 },
          { header: "Facility", key: "siteName", width: 20 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Condition', key: 'condition', width: 12 },
          { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
        ];

        const title = 'Asset Inventory Report';
        const subtitle = `Generated for ${input.siteId ? "Facility " + input.siteId : "All facilities"}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, assets, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `asset-inventory-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, assets, columns, { sheetName: 'Assets' });
          return {
            data: buffer.toString('base64'),
            filename: `asset-inventory-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Maintenance Reports
    maintenanceSchedule: protectedProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const schedules = await db.getAllMaintenanceSchedules();

        const columns = [
          { header: 'Schedule Name', key: 'scheduleName', width: 25 },
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Type', key: 'maintenanceType', width: 15 },
          { header: 'Frequency', key: 'frequency', width: 12 },
          { header: 'Last Performed', key: 'lastPerformed', width: 15 },
          { header: 'Next Due', key: 'nextDue', width: 15 },
          { header: 'Status', key: 'status', width: 12 },
        ];

        const title = 'Maintenance Schedule Report';
        const subtitle = `Period: ${input.startDate || 'All'} to ${input.endDate || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, schedules, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `maintenance-schedule-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, schedules, columns, { sheetName: 'Maintenance' });
          return {
            data: buffer.toString('base64'),
            filename: `maintenance-schedule-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Work Order Reports
    workOrders: protectedProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const workOrders = await db.getAllWorkOrders();

        const columns = [
          { header: 'WO Number', key: 'workOrderNumber', width: 15 },
          { header: 'Title', key: 'title', width: 25 },
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Type', key: 'type', width: 12 },
          { header: 'Priority', key: 'priority', width: 10 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Created', key: 'createdAt', width: 15 },
          { header: 'Completed', key: 'completedAt', width: 15 },
        ];

        const title = 'Work Orders Report';
        const subtitle = `Status: ${input.status || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, workOrders, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `work-orders-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, workOrders, columns, { sheetName: 'Work Orders' });
          return {
            data: buffer.toString('base64'),
            filename: `work-orders-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Financial Reports
    financial: protectedProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const transactions = await db.getFinancialTransactions();

        const columns = [
          { header: 'Date', key: 'transactionDate', width: 15 },
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Type', key: 'transactionType', width: 15 },
          { header: 'Category', key: 'category', width: 15 },
          { header: 'Amount', key: 'amount', width: 12 },
          { header: 'Description', key: 'description', width: 30 },
        ];

        const title = 'Financial Summary Report';
        const subtitle = `Period: ${input.startDate || 'All'} to ${input.endDate || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, transactions, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `financial-report-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, transactions, columns, { sheetName: 'Financial' });
          return {
            data: buffer.toString('base64'),
            filename: `financial-report-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Compliance Reports
    compliance: protectedProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        status: z.enum(['compliant', 'non_compliant', 'pending']).optional(),
      }))
      .mutation(async ({ input }) => {
        const records = await db.getAllComplianceRecords();

        const columns = [
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Requirement', key: 'requirementName', width: 25 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Last Inspection', key: 'lastInspectionDate', width: 15 },
          { header: 'Next Due', key: 'nextDueDate', width: 15 },
          { header: 'Inspector', key: 'inspectorName', width: 15 },
        ];

        const title = 'Compliance Audit Report';
        const subtitle = `Status: ${input.status || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, records, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `compliance-report-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, records, columns, { sheetName: 'Compliance' });
          return {
            data: buffer.toString('base64'),
            filename: `compliance-report-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),
  }),

  // Asset Photos Management
  photos: router({
    create: protectedProcedure
      .input(z.object({
        assetId: z.number().optional(),
        workOrderId: z.number().optional(),
        photoUrl: z.string(),
        photoKey: z.string(),
        caption: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const photoId = await db.createAssetPhoto({
          ...input,
          uploadedBy: ctx.user.id,
        });
        return { id: photoId };
      }),

    listByAsset: protectedProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetPhotos(input.assetId);
      }),

    listByWorkOrder: protectedProcedure
      .input(z.object({ workOrderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkOrderPhotos(input.workOrderId);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAssetPhoto(input.id);
        return { success: true };
      }),
  }),

  // Scheduled Reports Management
  scheduledReports: router({
    list: protectedProcedure.query(async () => {
      return await db.getScheduledReports();
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        reportType: z.enum(['assetInventory', 'maintenanceSchedule', 'workOrders', 'financial', 'compliance']),
        format: z.enum(['pdf', 'excel']),
        schedule: z.enum(['daily', 'weekly', 'monthly']),
        dayOfWeek: z.number().optional(),
        dayOfMonth: z.number().optional(),
        time: z.string(),
        recipients: z.string(),
        filters: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const reportId = await db.createScheduledReport({
          ...input,
          createdBy: ctx.user.id,
        });
        return { id: reportId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        reportType: z.enum(['assetInventory', 'maintenanceSchedule', 'workOrders', 'financial', 'compliance']).optional(),
        format: z.enum(['pdf', 'excel']).optional(),
        schedule: z.enum(['daily', 'weekly', 'monthly']).optional(),
        dayOfWeek: z.number().optional(),
        dayOfMonth: z.number().optional(),
        time: z.string().optional(),
        recipients: z.string().optional(),
        filters: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateScheduledReport(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteScheduledReport(input.id);
        return { success: true };
       }),
  }),

  // ============= BULK IMPORT/EXPORT =============
  bulkOperations: router({
    exportAssets: protectedProcedure
      .query(async () => {
        const { exportAssets } = await import('./bulkImportExport');
        const buffer = await exportAssets();
        return {
          data: buffer.toString('base64'),
          filename: `assets_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    exportWorkOrders: protectedProcedure
      .query(async () => {
        const { exportWorkOrders } = await import('./bulkImportExport');
        const buffer = await exportWorkOrders();
        return {
          data: buffer.toString('base64'),
          filename: `work_orders_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    exportInventory: protectedProcedure
      .query(async () => {
        const { exportInventory } = await import('./bulkImportExport');
        const buffer = await exportInventory();
        return {
          data: buffer.toString('base64'),
          filename: `inventory_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    exportAllDataZip: adminProcedure.query(async () => {
      const JSZip = (await import("jszip")).default;
      const { exportAssets, exportWorkOrders, exportInventory, exportSites } = await import(
        "./bulkImportExport"
      );
      const zip = new JSZip();
      const [a, w, i, s] = await Promise.all([
        exportAssets(),
        exportWorkOrders(),
        exportInventory(),
        exportSites(),
      ]);
      zip.file("assets.xlsx", a);
      zip.file("work_orders.xlsx", w);
      zip.file("inventory.xlsx", i);
      zip.file("facilities.xlsx", s);
      const out = await zip.generateAsync({ type: "nodebuffer" });
      return {
        data: out.toString("base64"),
        filename: `nrcs_export_${Date.now()}.zip`,
        mimeType: "application/zip",
      };
    }),

    getImportTemplate: protectedProcedure
      .input(z.object({ entity: z.enum(['assets', 'workOrders', 'inventory']) }))
      .query(async ({ input }) => {
        const { generateImportTemplate } = await import('./bulkImportExport');
        const buffer = await generateImportTemplate(input.entity);
        return {
          data: buffer.toString('base64'),
          filename: `${input.entity}_import_template.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    importAssets: managerOrAdminProcedure
      .input(z.object({ fileData: z.string() })) // base64 encoded
      .mutation(async ({ input, ctx }) => {
        const { importAssets } = await import('./bulkImportExport');
        const buffer = Buffer.from(input.fileData, 'base64');
        return await importAssets(buffer, ctx.user.id);
      }),

    exportAssetRegister: protectedProcedure
      .input(
        z
          .object({
            siteId: z.number().optional(),
            categoryId: z.number().optional(),
            registerStatus: z.string().optional(),
            itemType: z.string().optional(),
            search: z.string().optional(),
            siteLabel: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const { buildNRCSAssetRegisterWorkbook } = await import("./nrcsAssetExcel");
        const { buffer, filename } = await buildNRCSAssetRegisterWorkbook({
          siteId: input?.siteId,
          categoryId: input?.categoryId,
          registerStatus: input?.registerStatus,
          itemType: input?.itemType,
          search: input?.search,
          siteLabel: input?.siteLabel,
        });
        return {
          data: buffer.toString("base64"),
          filename,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }),

    previewAssetRegisterImport: managerOrAdminProcedure
      .input(z.object({ fileData: z.string() }))
      .mutation(async ({ input }) => {
        const { previewNRCSAssetImport } = await import("./nrcsAssetExcel");
        return await previewNRCSAssetImport(Buffer.from(input.fileData, "base64"));
      }),

    confirmAssetRegisterImport: managerOrAdminProcedure
      .input(
        z.object({
          rows: z.array(
            z.object({
              assetTag: z.string(),
              name: z.string(),
              description: z.string().optional(),
              categoryId: z.number(),
              siteId: z.number(),
              itemType: assetItemTypeInputZod,
              subCategory: z.string().optional(),
              serialNumber: z.string().optional(),
              acquisitionCost: z.string().optional(),
              currentDepreciatedValue: z.number().optional(),
              currentValue: z.string().optional(),
              acquisitionMethod: z.string().optional(),
              projectRef: z.string().optional(),
              acquisitionDate: z.date().optional(),
              acquisitionCondition: z.enum(["New", "Used"]).optional(),
              registerStatus: registerStatusZodEnum,
              assignedToName: z.string().optional(),
              department: z.string().optional(),
              location: z.string().optional(),
              physicalCondition: z
                .enum(["Good", "Fair", "Damaged", "Beyond Repair"])
                .optional(),
              lastCheckedAt: z.date().optional(),
              notes: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const { confirmNRCSAssetImport } = await import("./nrcsAssetExcel");
        return await confirmNRCSAssetImport(
          input.rows.map((row) => ({
            ...row,
            itemType: normalizeAssetItemType(row.itemType),
          }))
        );
      }),

    exportSites: protectedProcedure
      .query(async () => {
        const { exportSites } = await import('./bulkImportExport');
        const buffer = await exportSites();
        return {
          data: buffer.toString('base64'),
          filename: `facilities_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    importSites: managerOrAdminProcedure
      .input(z.object({ fileData: z.string() })) // base64 encoded
      .mutation(async ({ input }) => {
        const { importSites } = await import('./bulkImportExport');
        const buffer = Buffer.from(input.fileData, 'base64');
        return await importSites(buffer);
      }),

    downloadSiteTemplate: publicProcedure
      .query(async () => {
        const { generateSiteTemplate } = await import('./bulkImportExport');
        const buffer = await generateSiteTemplate();
        return {
          data: buffer.toString('base64'),
          filename: "NRCS_Facilities_Import_Template.xlsx",
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),
  }),

  // ============= ASSET TRANSFERS =============
  transfers: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        assetId: z.number().optional(),
        siteId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllAssetTransfers(input);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetTransferById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        assetId: z.number(),
        fromSiteId: z.number(),
        toSiteId: z.number(),
        reason: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createAssetTransfer({
          ...input,
          requestedBy: ctx.user.id,
        });
      }),

    approve: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await db.updateAssetTransfer(input.id, {
          status: 'approved',
          approvedBy: ctx.user.id,
          approvalDate: new Date(),
        });
      }),

    reject: managerOrAdminProcedure
      .input(z.object({ id: z.number(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        return await db.updateAssetTransfer(input.id, {
          status: 'rejected',
          approvedBy: ctx.user.id,
          approvalDate: new Date(),
          notes: input.notes,
        });
      }),

    startTransfer: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.updateAssetTransfer(input.id, {
          status: 'in_transit',
          transferDate: new Date(),
        });
      }),

    complete: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        handoverChecklist: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const transfer = await db.getAssetTransferById(input.id);
        if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
        
        // Update asset location
        await db.updateAsset(transfer.assetId, {
          siteId: transfer.toSiteId,
        });
        
        return await db.updateAssetTransfer(input.id, {
          status: 'completed',
          completionDate: new Date(),
          handoverChecklist: input.handoverChecklist,
        });
      }),

    getPending: managerOrAdminProcedure
      .query(async () => {
        return await db.getPendingTransferRequests();
      }),
  }),

  // ============= QUICKBOOKS INTEGRATION =============
  quickbooks: router({
    getConfig: protectedProcedure.query(async () => {
      return await db.getQuickBooksConfig();
    }),
    
    saveConfig: protectedProcedure
      .input(z.object({
        clientId: z.string(),
        clientSecret: z.string(),
        redirectUri: z.string(),
        realmId: z.string(),
      }))
      .mutation(async ({ input }) => {
        return await db.saveQuickBooksConfig({
          ...input,
          isActive: 1,
          autoSync: 1,
        });
      }),
    
    getAuthUrl: protectedProcedure
      .input(z.object({
        clientId: z.string(),
        redirectUri: z.string(),
      }))
      .query(({ input }) => {
        const { getQuickBooksAuthUrl } = require('./quickbooksIntegration');
        return { url: getQuickBooksAuthUrl(input) };
      }),
    
    exchangeCode: protectedProcedure
      .input(z.object({
        code: z.string(),
        realmId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const config = await db.getQuickBooksConfig();
        if (!config) throw new Error('QuickBooks not configured');
        
        const { exchangeCodeForToken } = require('./quickbooksIntegration');
        const tokens = await exchangeCodeForToken(input.code, {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
        });
        
        // Update config with tokens
        const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
        await db.updateQuickBooksTokens(config.id, tokens.accessToken, tokens.refreshToken, expiresAt);
        
        // Update realm ID if provided
        if (input.realmId) {
          await db.saveQuickBooksConfig({
            ...config,
            realmId: input.realmId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenExpiresAt: expiresAt,
          });
        }
        
        return { success: true };
      }),
    
    syncTransactions: protectedProcedure.mutation(async () => {
      const config = await db.getQuickBooksConfig();
      if (!config || !config.accessToken) {
        throw new Error('QuickBooks not authenticated');
      }
      
      const { syncAllTransactions } = require('./quickbooksIntegration');
      const result = await syncAllTransactions({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        realmId: config.realmId,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken || undefined,
      });
      
      await db.updateQuickBooksLastSync(config.id);
      
      return result;
    }),
    
    testConnection: protectedProcedure.query(async () => {
      const config = await db.getQuickBooksConfig();
      if (!config || !config.accessToken) {
        return { connected: false, error: 'Not authenticated' };
      }
      
      const { testConnection } = require('./quickbooksIntegration');
      const connected = await testConnection({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        realmId: config.realmId,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken || undefined,
      });
      
      return { connected };
    }),
  }),

  // ============= USER PREFERENCES =============
  userPreferences: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserPreferences(ctx.user.id);
    }),
    
    update: protectedProcedure
      .input(z.object({
        sidebarWidth: z.number().optional(),
        sidebarCollapsed: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.upsertUserPreferences({
          userId: ctx.user.id,
          ...input,
        });
      }),

    updateDashboardWidgets: protectedProcedure
      .input(z.object({
        widgets: z.record(z.string(), z.boolean()),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.upsertUserPreferences({
          userId: ctx.user.id,
          dashboardWidgets: JSON.stringify(input.widgets),
        });
      }),
  }),

  // ============= EMAIL NOTIFICATIONS =============
  emailNotifications: router({
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
  }),

  // ============= DEPRECIATION =============
  depreciation: router({
    calculate: protectedProcedure
      .input(z.object({
        assetId: z.number(),
      }))
      .query(async ({ input }) => {
        const { calculateDepreciation } = require('./depreciation');
        const asset = await db.getAssetById(input.assetId);
        
        if (!asset || !asset.depreciationMethod || asset.depreciationMethod === 'none') {
          return null;
        }
        
        if (!asset.acquisitionCost || !asset.depreciationStartDate) {
          return null;
        }
        
        return calculateDepreciation({
          acquisitionCost: Number(asset.acquisitionCost),
          residualValue: Number(asset.residualValue || 0),
          usefulLifeYears: asset.usefulLifeYears || 5,
          depreciationStartDate: new Date(asset.depreciationStartDate),
          method: asset.depreciationMethod as 'straight-line' | 'declining-balance',
          decliningBalanceRate: 2, // Double-declining balance
        });
      }),
    
    summary: protectedProcedure.query(async () => {
      const { calculateDepreciation } = require('./depreciation');
      const assets = await db.getAllAssets();
      
      let totalAcquisitionCost = 0;
      let totalCurrentValue = 0;
      let totalAccumulatedDepreciation = 0;
      let assetsWithDepreciation = 0;
      
      for (const asset of assets) {
        if (asset.acquisitionCost) {
          totalAcquisitionCost += Number(asset.acquisitionCost);
        }
        
        if (asset.depreciationMethod && asset.depreciationMethod !== 'none' && asset.depreciationStartDate && asset.acquisitionCost) {
          assetsWithDepreciation++;
          const result = calculateDepreciation({
            acquisitionCost: Number(asset.acquisitionCost),
            residualValue: Number(asset.residualValue || 0),
            usefulLifeYears: asset.usefulLifeYears || 5,
            depreciationStartDate: new Date(asset.depreciationStartDate),
            method: asset.depreciationMethod as 'straight-line' | 'declining-balance',
            decliningBalanceRate: 2,
          });
          
          if (result) {
            totalCurrentValue += result.currentBookValue;
            totalAccumulatedDepreciation += result.accumulatedDepreciation;
          }
        } else if (asset.currentValue) {
          totalCurrentValue += Number(asset.currentValue);
        } else if (asset.acquisitionCost) {
          totalCurrentValue += Number(asset.acquisitionCost);
        }
      }
      
      return {
        totalAcquisitionCost: Math.round(totalAcquisitionCost * 100) / 100,
        totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
        totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation * 100) / 100,
        totalDepreciationPercentage: totalAcquisitionCost > 0 
          ? Math.round((totalAccumulatedDepreciation / totalAcquisitionCost) * 10000) / 100 
          : 0,
        assetsWithDepreciation,
        totalAssets: assets.length,
      };
    }),
  }),

  // ============= PENDING USERS (Admin Approval) =============
  pendingUsers: router({
    list: adminProcedure.query(async () => {
      const database = await db.getDb();
      if (!database) return [];
      const { pendingUsers } = await import("../drizzle/schema");
      return await database.select().from(pendingUsers);
    }),
    
    approve: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { approvePendingUser } = await import("./pendingUsersService");
        return await approvePendingUser(input.id, ctx.user.id);
      }),
    
    reject: adminProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { rejectPendingUser } = await import("./pendingUsersService");
        return await rejectPendingUser(input.id, ctx.user.id, input.reason);
      }),
  }),

  // ============= WORK ORDER TEMPLATES =============
  workOrderTemplates: router({
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
  }),

  // ============= AUDIT LOGS =============
  auditLogs: router({
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
  }),
});

export type AppRouter = typeof appRouter;
