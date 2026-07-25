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
function buildRegisterDepreciationResultFromAsset(asset: {
  actualUnitValue: string | null;
  itemCategory: string | null;
  yearAcquiredRegister: number | null;
}): DepreciationResult {
  const actual = Number(asset.actualUnitValue);
  const year = asset.yearAcquiredRegister ?? new Date().getFullYear();
  const category = (asset.itemCategory ?? "").trim();
  const book = calculateDepreciatedValue(actual, category, year);
  const accumulated = Math.max(0, Math.round((actual - book) * 100) / 100);
  const age = Math.max(0, new Date().getFullYear() - year);
  const pct = actual > 0 ? (accumulated / actual) * 100 : 0;
  const annual = age > 0 ? accumulated / age : accumulated;
  const today = new Date().toISOString().split("T")[0]!;
  return {
    method: "NRCS Register (category-based)",
    annualDepreciation: Math.round(annual * 100) / 100,
    accumulatedDepreciation: accumulated,
    currentBookValue: book,
    depreciationPercentage: Math.round(pct * 100) / 100,
    yearsElapsed: age,
    remainingYears: 0,
    schedule: [
      {
        year: 1,
        date: today,
        beginningValue: Math.round(actual * 100) / 100,
        depreciationExpense: accumulated,
        accumulatedDepreciation: accumulated,
        endingValue: book,
      },
    ],
  };
}

export const depreciationRouter = router({
    calculate: protectedProcedure
      .input(z.object({
        assetId: z.number(),
      }))
      .query(async ({ input }) => {
        const { calculateDepreciation } = require('../depreciation');
        const asset = await db.getAssetById(input.assetId);
        if (!asset) return null;

        const legacyReady =
          asset.depreciationMethod &&
          asset.depreciationMethod !== "none" &&
          asset.acquisitionCost &&
          asset.depreciationStartDate;

        if (legacyReady) {
          return calculateDepreciation({
            acquisitionCost: Number(asset.acquisitionCost),
            residualValue: Number(asset.residualValue || 0),
            usefulLifeYears: asset.usefulLifeYears || 5,
            depreciationStartDate: new Date(asset.depreciationStartDate!),
            method: asset.depreciationMethod as "straight-line" | "declining-balance",
            decliningBalanceRate: 2,
          });
        }

        const registerReady =
          asset.actualUnitValue != null &&
          String(asset.actualUnitValue).trim() !== "" &&
          asset.itemCategory &&
          String(asset.itemCategory).trim() !== "" &&
          asset.yearAcquiredRegister != null;

        if (registerReady) {
          return buildRegisterDepreciationResultFromAsset({
            actualUnitValue: asset.actualUnitValue,
            itemCategory: asset.itemCategory,
            yearAcquiredRegister: asset.yearAcquiredRegister,
          });
        }

        return null;
      }),
    
    summary: protectedProcedure.query(async () => {
      const { calculateDepreciation } = require('../depreciation');
      const allAssets = await db.getAllAssets();
      
      let totalAcquisitionCost = 0;
      let totalCurrentValue = 0;
      let totalAccumulatedDepreciation = 0;
      let assetsWithDepreciation = 0;
      
      for (const asset of allAssets) {
        if (asset.acquisitionCost) {
          totalAcquisitionCost += Number(asset.acquisitionCost);
        }
        
        if (asset.depreciationMethod && asset.depreciationMethod !== 'none' && asset.depreciationStartDate && asset.acquisitionCost) {
          assetsWithDepreciation++;
          const result = calculateDepreciation({
            acquisitionCost: Number(asset.acquisitionCost),
            residualValue: Number(asset.residualValue || 0),
            usefulLifeYears: asset.usefulLifeYears || 5,
            depreciationStartDate: new Date(asset.depreciationStartDate!),
            method: asset.depreciationMethod as 'straight-line' | 'declining-balance',
            decliningBalanceRate: 2,
          });
          
          if (result) {
            totalCurrentValue += result.currentBookValue;
            totalAccumulatedDepreciation += result.accumulatedDepreciation;
          }
        } else if (
          asset.actualUnitValue != null &&
          String(asset.actualUnitValue).trim() !== "" &&
          asset.itemCategory &&
          String(asset.itemCategory).trim() !== "" &&
          asset.yearAcquiredRegister != null
        ) {
          assetsWithDepreciation++;
          const reg = buildRegisterDepreciationResultFromAsset({
            actualUnitValue: asset.actualUnitValue,
            itemCategory: asset.itemCategory,
            yearAcquiredRegister: asset.yearAcquiredRegister,
          });
          totalCurrentValue += reg.currentBookValue;
          totalAccumulatedDepreciation += reg.accumulatedDepreciation;
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
        totalAssets: allAssets.length,
      };
    }),
  });
