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
import { assetItemTypeInputZod, normalizeAssetItemType } from "./_helpers";

function parseMoneyString(v: string | undefined | null): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Register-based auto depreciation vs manual override for asset create. */
function buildRegisterDepreciationForCreate(input: {
  depreciatedValueManualOverride?: boolean;
  depreciatedValue?: string;
  currentDepreciatedValue?: number;
  actualUnitValue?: string;
  acquisitionCost?: string;
  itemCategory?: string;
  yearAcquiredRegister?: number;
  yearAcquired?: number;
}): {
  depreciatedValue?: string;
  currentDepreciatedValue?: number;
  depreciatedValueManualOverride: boolean;
} {
  if (input.depreciatedValueManualOverride === true) {
    const raw = input.depreciatedValue ?? (input.currentDepreciatedValue != null ? String(input.currentDepreciatedValue) : "");
    const trimmed = String(raw).trim();
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (Number.isFinite(n)) {
        return {
          depreciatedValue: String(n),
          currentDepreciatedValue: n,
          depreciatedValueManualOverride: true,
        };
      }
    }
    return { depreciatedValueManualOverride: true };
  }
  const actual =
    parseMoneyString(input.actualUnitValue) ?? parseMoneyString(input.acquisitionCost);
  const year = input.yearAcquiredRegister ?? input.yearAcquired;
  const category = (input.itemCategory ?? "").trim();
  if (actual != null && category && year != null && year >= 1900) {
    const dv = calculateDepreciatedValue(actual, category, year);
    return {
      depreciatedValue: String(dv),
      currentDepreciatedValue: dv,
      depreciatedValueManualOverride: false,
    };
  }
  const fallback = input.depreciatedValue ?? (input.currentDepreciatedValue != null ? String(input.currentDepreciatedValue) : "");
  if (String(fallback).trim() !== "") {
    const n = Number(String(fallback).replace(/,/g, ""));
    if (Number.isFinite(n)) {
      return {
        depreciatedValue: String(n),
        currentDepreciatedValue: n,
        depreciatedValueManualOverride: false,
      };
    }
  }
  return { depreciatedValueManualOverride: false };
}

export const assetsRouter = router({
    list: protectedProcedure
      .input(z.object({
        siteId: z.number().optional(),
        status: z.string().optional(),
        categoryId: z.number().optional(),
        categoryIds: z.array(z.number().int().positive()).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const scopedSiteId = enforceFacilityScope(ctx.user, input?.siteId);
        return await db.getAllAssets({ ...(input ?? {}), siteId: scopedSiteId });
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const asset = await db.getAssetById(input.id);
        assertRecordFacilityAccess(ctx.user, asset?.siteId);
        return asset;
      }),
    
    getByTag: protectedProcedure
      .input(z.object({ assetTag: z.string() }))
      .query(async ({ input, ctx }) => {
        const asset = await db.getAssetByTag(input.assetTag);
        if (asset) assertRecordFacilityAccess(ctx.user, asset.siteId);
        return asset;
      }),
    
    search: protectedProcedure
      .input(z.object({ searchTerm: z.string() }))
      .query(async ({ input, ctx }) => {
        const scopedSiteId = enforceFacilityScope(ctx.user);
        if (scopedSiteId === -1) return [];
        const results = await db.searchAssets(input.searchTerm);
        if (scopedSiteId != null && scopedSiteId > 0) {
          return results.filter((a) => a.siteId === scopedSiteId);
        }
        return results;
      }),

    registerList: protectedProcedure
      .input(
        z
          .object({
            siteId: z.number().optional(),
            categoryId: z.number().optional(),
            categoryIds: z.array(z.number().int().positive()).optional(),
            registerStatus: z.string().optional(),
            itemType: z.string().optional(),
            search: z.string().optional(),
            sortBy: z.string().optional(),
            sortDir: z.enum(["asc", "desc"]).optional(),
            limit: z.number().min(1).max(db.ASSET_REGISTER_MAX_LIMIT).optional(),
            offset: z.number().min(0).optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        const scopedSiteId = enforceFacilityScope(ctx.user, input?.siteId);
        return await db.getAssetRegisterList({ ...(input ?? {}), siteId: scopedSiteId });
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
        depreciatedValueManualOverride: z.boolean().optional(),
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
        const dep = buildRegisterDepreciationForCreate({
          depreciatedValueManualOverride: input.depreciatedValueManualOverride,
          depreciatedValue: input.depreciatedValue,
          currentDepreciatedValue: input.currentDepreciatedValue,
          actualUnitValue: input.actualUnitValue,
          acquisitionCost: input.acquisitionCost,
          itemCategory: input.itemCategory,
          yearAcquiredRegister: input.yearAcquiredRegister ?? input.yearAcquired,
          yearAcquired: input.yearAcquired,
        });
        let latitude = input.latitude?.trim();
        let longitude = input.longitude?.trim();
        if (!latitude || !longitude) {
          const site = await db.getSiteById(input.siteId);
          if (site?.latitude != null && site?.longitude != null) {
            if (!latitude) latitude = String(site.latitude);
            if (!longitude) longitude = String(site.longitude);
          }
        }
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
          depreciatedValue: dep.depreciatedValue ?? input.depreciatedValue ?? input.currentDepreciatedValue?.toString(),
          depreciatedValueManualOverride: dep.depreciatedValueManualOverride,
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
          currentDepreciatedValue: dep.currentDepreciatedValue ?? input.currentDepreciatedValue,
          depreciationRate: input.depreciationRate,
          warrantyExpiry: input.warrantyExpiry,
          location: input.location,
          assignedTo: input.assignedTo,
          imageUrl: input.imageUrl,
          notes: input.notes,
          latitude: latitude || undefined,
          longitude: longitude || undefined,
        });
      }),
    
    generateQRCode: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { generateAssetQRCode } = await import('../qrcode');
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
        const { generateBulkQRCodeLabels } = await import('../qrcode');
        
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
        const { parseAssetQRCode } = await import('../qrcode');
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
        const { generateBarcode, generateBarcodeValue } = await import('../barcode');
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
        depreciatedValueManualOverride: z.boolean().optional(),
        depreciationRate: z.string().optional(),
        warrantyExpiry: z.date().optional(),
        location: z.string().optional(),
        assignedTo: z.number().optional(),
        imageUrl: z.string().optional(),
        notes: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        depreciationMethod: z.string().optional(),
        usefulLifeYears: z.number().optional(),
        residualValue: z.string().optional(),
        depreciationStartDate: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, yearAcquired, registerStatus, status, ...rest } = input;
        const existing = await db.getAssetById(id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
        }
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

        const mergedActual =
          (rest.actualUnitValue as string | undefined) ?? existing.actualUnitValue?.toString() ?? undefined;
        const mergedCategory =
          (rest.itemCategory as string | undefined) ?? existing.itemCategory ?? "";
        const mergedYear =
          (rest.yearAcquiredRegister as number | undefined) ?? existing.yearAcquiredRegister ?? undefined;

        if (rest.depreciatedValueManualOverride === true && rest.depreciatedValue != null && String(rest.depreciatedValue).trim() !== "") {
          const n = Number(String(rest.depreciatedValue).replace(/,/g, ""));
          if (Number.isFinite(n)) {
            data.depreciatedValue = String(n);
            data.currentDepreciatedValue = n;
            data.depreciatedValueManualOverride = true;
          }
        } else if (rest.depreciatedValueManualOverride === false) {
          const dep = buildRegisterDepreciationForCreate({
            depreciatedValueManualOverride: false,
            actualUnitValue: mergedActual,
            acquisitionCost: mergedActual,
            itemCategory: mergedCategory,
            yearAcquiredRegister: mergedYear,
          });
          if (dep.depreciatedValue !== undefined) {
            data.depreciatedValue = dep.depreciatedValue;
            data.currentDepreciatedValue = dep.currentDepreciatedValue;
            data.depreciatedValueManualOverride = false;
          } else {
            data.depreciatedValueManualOverride = false;
          }
        } else if (!existing.depreciatedValueManualOverride) {
          const dep = buildRegisterDepreciationForCreate({
            depreciatedValueManualOverride: false,
            actualUnitValue: mergedActual,
            acquisitionCost: mergedActual,
            itemCategory: mergedCategory,
            yearAcquiredRegister: mergedYear,
          });
          if (dep.depreciatedValue !== undefined) {
            data.depreciatedValue = dep.depreciatedValue;
            data.currentDepreciatedValue = dep.currentDepreciatedValue;
            data.depreciatedValueManualOverride = false;
          }
        }

        delete data.depreciatedValueManualOverride;

        try {
          const updated = await db.updateAssetWithAssetEditAudit(
            id,
            data as Parameters<typeof db.updateAsset>[1],
            ctx.user.id
          );
          if (!updated) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
          }
          return updated;
        } catch (e: unknown) {
          if (e instanceof Error && e.message === "Asset not found") {
            throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
          }
          throw e;
        }
      }),

    recalculateDepreciation: managerOrAdminProcedure.mutation(async () => {
      const rows = await db.listAssetsEligibleForAutoDepreciation();
      let updated = 0;
      for (const row of rows) {
        const actual = Number(row.actualUnitValue);
        const year = row.yearAcquiredRegister!;
        const cat = row.itemCategory!;
        const dv = calculateDepreciatedValue(actual, cat, year);
        await db.updateAsset(row.id, {
          depreciatedValue: String(dv),
          currentDepreciatedValue: dv,
          depreciatedValueManualOverride: false,
        });
        updated++;
      }
      const total = await db.countAllAssets();
      return { updated, skipped: Math.max(0, total - updated) };
    }),

    backfillCoordinatesFromFacilities: adminProcedure.mutation(async () => {
      const updated = await db.backfillAssetCoordinatesFromSites();
      return { updated };
    }),

    syncCoordinatesForSite: managerOrAdminProcedure
      .input(z.object({ siteId: z.number() }))
      .mutation(async ({ input }) => {
        const updated = await db.syncAssetCoordinatesForSiteId(input.siteId);
        return { updated };
      }),

    listAssetEditHistory: managerOrAdminProcedure
      .input(
        z.object({
          assetId: z.number(),
          limit: z.number().min(1).max(200).optional(),
        })
      )
      .query(async ({ input }) => {
        return await db.getAssetEditAuditLogs(input.assetId, input.limit ?? 50);
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
  });
