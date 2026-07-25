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

export const branchScorecardsRouter = router({
    list: managerOrAdminProcedure.query(async () => {
      const { buildBranchScorecardList } = await import("./reports/branchScorecards");
      return await buildBranchScorecardList();
    }),

    exportXlsx: managerOrAdminProcedure.mutation(async () => {
      const { buildBranchScorecardList } = await import("./reports/branchScorecards");
      const list = await buildBranchScorecardList();
      const columns = [
        { header: "Branch", key: "branchName", width: 24 },
        { header: "Composite score", key: "compositeScore", width: 14 },
        { header: "Trend vs prior", key: "trendVsPriorMonth", width: 14 },
        { header: "Assets", key: "assetCount", width: 10 },
        { header: "Book value", key: "bookValue", width: 14 },
        { header: "Verified %", key: "verificationPercent", width: 12 },
        { header: "Open WOs", key: "openWorkOrders", width: 10 },
        { header: "Overdue WOs", key: "overdueWorkOrders", width: 12 },
        { header: "Stock alerts", key: "stockAlerts", width: 12 },
        { header: "30d expiry qty", key: "expiryExposure30Day", width: 14 },
      ];
      const rows = list.map((row) => ({
        ...row,
        trendVsPriorMonth: row.trendVsPriorMonth ?? "Ã¢â‚¬â€",
      }));
      const buffer = await generateExcelReport("Branch scorecards", rows, columns, {
        sheetName: "Scorecards",
      });
      const date = new Date().toISOString().slice(0, 10);
      return {
        data: buffer.toString("base64"),
        filename: `branch-scorecards-${date}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }),
  });
