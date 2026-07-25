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

export const bulkOperationsRouter = router({
    exportAssets: protectedProcedure
      .query(async () => {
        const { exportAssets } = await import('../bulkImportExport');
        const buffer = await exportAssets();
        return {
          data: buffer.toString('base64'),
          filename: `assets_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    exportWorkOrders: protectedProcedure
      .query(async () => {
        const { exportWorkOrders } = await import('../bulkImportExport');
        const buffer = await exportWorkOrders();
        return {
          data: buffer.toString('base64'),
          filename: `work_orders_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    exportInventory: protectedProcedure
      .query(async () => {
        const { exportInventory } = await import('../bulkImportExport');
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
        "../bulkImportExport"
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
        const { generateImportTemplate } = await import('../bulkImportExport');
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
        const { importAssets } = await import('../bulkImportExport');
        const buffer = Buffer.from(input.fileData, 'base64');
        return await importAssets(buffer, ctx.user.id);
      }),

    exportAssetRegister: protectedProcedure
      .input(
        z
          .object({
            siteId: z.number().optional(),
            categoryId: z.number().optional(),
            categoryIds: z.array(z.number().int().positive()).optional(),
            registerStatus: z.string().optional(),
            itemType: z.string().optional(),
            search: z.string().optional(),
            siteLabel: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const { buildNRCSAssetRegisterWorkbook } = await import("../nrcsAssetExcel");
        const { buffer, filename } = await buildNRCSAssetRegisterWorkbook({
          siteId: input?.siteId,
          categoryId: input?.categoryId,
          categoryIds: input?.categoryIds,
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
        const { previewNRCSAssetImport } = await import("../nrcsAssetExcel");
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
              branchCode: z.string(),
              itemCategory: z.string(),
              itemCategoryCode: z.string(),
              assetNum: z.number().int().positive().optional(),
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
        try {
          const { confirmNRCSAssetImport } = await import("../nrcsAssetExcel");
          return await confirmNRCSAssetImport(
            input.rows.map((row) => ({
              ...row,
              itemType: normalizeAssetItemType(row.itemType),
            }))
          );
        } catch (e) {
          console.error("[bulkOperations.confirmAssetRegisterImport]", e);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Import failed: the import could not be completed. Please contact your administrator if this persists.",
          });
        }
      }),

    exportSites: protectedProcedure
      .query(async () => {
        const { exportSites } = await import('../bulkImportExport');
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
        const { importSites } = await import('../bulkImportExport');
        const buffer = Buffer.from(input.fileData, 'base64');
        return await importSites(buffer);
      }),

    downloadSiteTemplate: protectedProcedure
      .query(async () => {
        const { generateSiteTemplate } = await import('../bulkImportExport');
        const buffer = await generateSiteTemplate();
        return {
          data: buffer.toString('base64'),
          filename: "NRCS_Facilities_Import_Template.xlsx",
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),
  });
