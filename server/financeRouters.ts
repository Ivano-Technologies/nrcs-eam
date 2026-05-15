import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "./_core/trpc";
import { managerOrAdminProcedure, adminProcedure } from "./routers/roleProcedures";
import * as financeDb from "./financeModulesDb";
const maintenanceTypeZod = z.enum(["Routine", "Repair", "Emergency", "Inspection"]);
const insuranceTypeZod = z.enum(["Property", "Vehicle", "Equipment", "Liability"]);

export const costManagementRouter = router({
  listBudgets: managerOrAdminProcedure
    .input(z.object({ period: z.number().int() }))
    .query(({ input }) => financeDb.listBudgets(input.period)),

  upsertBudget: managerOrAdminProcedure
    .input(
      z.object({
        id: z.number().optional(),
        siteId: z.number().nullable(),
        categoryId: z.number().nullable(),
        period: z.number().int(),
        amount: z.number().min(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = await financeDb.upsertBudget({
        ...input,
        createdBy: ctx.user.id,
      });
      return { id };
    }),

  budgetVsActual: managerOrAdminProcedure
    .input(z.object({ year: z.number().int() }))
    .query(({ input }) => financeDb.getBudgetVsActualByBranch(input.year)),

  listMaintenanceCosts: managerOrAdminProcedure
    .input(
      z
        .object({
          siteId: z.number().optional(),
          categoryId: z.number().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          minCost: z.number().optional(),
          maxCost: z.number().optional(),
        })
        .optional()
    )
    .query(({ input }) => financeDb.listMaintenanceCosts(input ?? {})),

  maintenanceSummary: managerOrAdminProcedure
    .input(z.object({ year: z.number().int() }))
    .query(({ input }) => financeDb.getMaintenanceCostSummary(input.year)),

  createMaintenanceCost: managerOrAdminProcedure
    .input(
      z.object({
        assetId: z.number(),
        maintenanceType: maintenanceTypeZod,
        date: z.string(),
        costNgn: z.number().min(0),
        description: z.string().optional(),
        referenceNumber: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = await financeDb.createMaintenanceCost({
        ...input,
        loggedBy: ctx.user.id,
      });
      return { id };
    }),

  exportMaintenanceCostsExcel: managerOrAdminProcedure
    .input(
      z
        .object({
          siteId: z.number().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const rows = await financeDb.listMaintenanceCosts(input ?? {});
      const { buildMaintenanceCostsWorkbook } = await import("./financeExcelExports");
      const { buffer, filename } = await buildMaintenanceCostsWorkbook(rows);
      return {
        filename,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: buffer.toString("base64"),
      };
    }),

  exportBudgetSummaryExcel: managerOrAdminProcedure
    .input(z.object({ year: z.number().int() }))
    .mutation(async ({ input }) => {
      const rows = await financeDb.getBudgetVsActualByBranch(input.year);
      const { buildBudgetSummaryWorkbook } = await import("./financeExcelExports");
      const { buffer, filename } = await buildBudgetSummaryWorkbook(rows, input.year);
      return {
        filename,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: buffer.toString("base64"),
      };
    }),
});

export const depreciationReportRouter = router({
  summary: managerOrAdminProcedure.query(() => financeDb.getDepreciationReportSummary()),

  schedule: managerOrAdminProcedure
    .input(
      z
        .object({
          siteId: z.number().optional(),
          categoryId: z.number().optional(),
          yearAcquired: z.number().optional(),
          status: z.enum(["active", "fully_depreciated"]).optional(),
        })
        .optional()
    )
    .query(({ input }) => financeDb.getDepreciationSchedule(input ?? {})),

  recalculateAll: adminProcedure.mutation(() => financeDb.recalculateAllRegisterDepreciation()),

  exportExcel: managerOrAdminProcedure
    .input(
      z
        .object({
          siteId: z.number().optional(),
          categoryId: z.number().optional(),
          yearAcquired: z.number().optional(),
          status: z.enum(["active", "fully_depreciated"]).optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const rows = await financeDb.getDepreciationSchedule(input ?? {});
      const { buildDepreciationScheduleWorkbook } = await import("./financeExcelExports");
      const { buffer, filename } = await buildDepreciationScheduleWorkbook(rows);
      return {
        filename,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: buffer.toString("base64"),
      };
    }),
});

export const insuranceRecordsRouter = router({
  list: managerOrAdminProcedure
    .input(
      z
        .object({
          siteId: z.number().optional(),
          insuranceType: z.string().optional(),
          status: z.enum(["active", "expiring", "expired"]).optional(),
        })
        .optional()
    )
    .query(({ input }) => financeDb.listInsuranceRecords(input)),

  expiringSoonCount: managerOrAdminProcedure.query(() => financeDb.countInsuranceExpiringSoon()),

  create: managerOrAdminProcedure
    .input(
      z.object({
        assetId: z.number().nullable(),
        siteId: z.number().nullable(),
        insuranceType: insuranceTypeZod,
        insurer: z.string().min(1),
        policyNumber: z.string().min(1),
        insuredValueNgn: z.number().optional(),
        annualPremiumNgn: z.number().optional(),
        policyStart: z.string(),
        policyEnd: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = await financeDb.createInsuranceRecord({
        assetId: input.assetId,
        siteId: input.siteId,
        insuranceType: input.insuranceType,
        insurer: input.insurer,
        policyNumber: input.policyNumber,
        insuredValueNgn: input.insuredValueNgn ?? 0,
        annualPremiumNgn: input.annualPremiumNgn ?? 0,
        policyStart: input.policyStart,
        policyEnd: input.policyEnd,
        notes: input.notes ?? null,
        createdBy: ctx.user.id,
      });
      return { id };
    }),

  update: managerOrAdminProcedure
    .input(
      z.object({
        id: z.number(),
        assetId: z.number().nullable().optional(),
        siteId: z.number().nullable().optional(),
        insuranceType: insuranceTypeZod.optional(),
        insurer: z.string().optional(),
        policyNumber: z.string().optional(),
        insuredValueNgn: z.number().optional(),
        annualPremiumNgn: z.number().optional(),
        policyStart: z.string().optional(),
        policyEnd: z.string().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      await financeDb.updateInsuranceRecord(id, rest);
      return { ok: true };
    }),

  delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await financeDb.deleteInsuranceRecord(input.id);
    return { ok: true };
  }),

  exportExcel: managerOrAdminProcedure
    .input(
      z
        .object({
          siteId: z.number().optional(),
          status: z.enum(["active", "expiring", "expired"]).optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const rows = await financeDb.listInsuranceRecords(input);
      const { buildInsuranceRegisterWorkbook } = await import("./financeExcelExports");
      const { buffer, filename } = await buildInsuranceRegisterWorkbook(rows);
      return {
        filename,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: buffer.toString("base64"),
      };
    }),
});

export const annualFinanceReportRouter = router({
  getData: managerOrAdminProcedure
    .input(
      z.object({
        year: z.number().int(),
        siteId: z.number().optional(),
      })
    )
    .query(({ input }) => financeDb.getAnnualFinanceReportData(input.year, input.siteId)),

  exportPdf: managerOrAdminProcedure
    .input(
      z.object({
        year: z.number().int(),
        siteId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const data = await financeDb.getAnnualFinanceReportData(input.year, input.siteId);
      const { buildAnnualFinanceReportPdf } = await import("./annualFinanceReportPdf");
      const buffer = await buildAnnualFinanceReportPdf(data);
      if (!buffer.length) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PDF generation failed" });
      }
      return {
        filename: `nrcs-annual-finance-report-${input.year}.pdf`,
        mimeType: "application/pdf",
        base64: buffer.toString("base64"),
      };
    }),

  exportExcel: managerOrAdminProcedure
    .input(
      z.object({
        year: z.number().int(),
        siteId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const data = await financeDb.getAnnualFinanceReportData(input.year, input.siteId);
      const { buildAnnualFinanceReportWorkbook } = await import("./financeExcelExports");
      const { buffer, filename } = await buildAnnualFinanceReportWorkbook(data);
      return {
        filename,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: buffer.toString("base64"),
      };
    }),
});
