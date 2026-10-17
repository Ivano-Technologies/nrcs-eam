import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { managerOrAdminProcedure } from "./routers/roleProcedures";
import { TRPCError } from "@trpc/server";
import * as complianceDb from "./complianceTrackingDb";

type ScopedUser = { role: string; siteId: number | null };

/** Admins see every facility; everyone else only their own (no facility means nothing). */
export function complianceListSiteId(user: ScopedUser): number | undefined {
  if (user.role === "admin") return undefined;
  return user.siteId ?? -1;
}
/** @deprecated kept for IVA-160 callers; same rule as complianceListSiteId. */
export const vehiclePapersListSiteId = complianceListSiteId;

/**
 * Non-admins may only change compliance records at their own facility (IVA-160, IVA-172). Records with no
 * facility are admin only.
 */
export function assertComplianceFacility(user: ScopedUser, recordSiteId: number | null, what: string): void {
  if (user.role === "admin") return;
  if (user.siteId == null || recordSiteId == null || recordSiteId !== user.siteId) {
    throw new TRPCError({ code: "FORBIDDEN", message: `You can only manage ${what} for your own facility.` });
  }
}

export function assertVehicleFacility(user: ScopedUser, vehicleSiteId: number | null): void {
  assertComplianceFacility(user, vehicleSiteId, "vehicle papers");
}

async function assertAssetAccess(user: ScopedUser, assetId: number, what: string, notFound: string) {
  const siteId = await complianceDb.getAssetSiteId(assetId);
  if (siteId === undefined) throw new TRPCError({ code: "NOT_FOUND", message: notFound });
  assertComplianceFacility(user, siteId, what);
}

async function assertRecordAccess(
  user: ScopedUser,
  lookup: Promise<number | null | undefined>,
  what: string,
  notFound: string
) {
  const siteId = await lookup;
  if (siteId === undefined) throw new TRPCError({ code: "NOT_FOUND", message: notFound });
  assertComplianceFacility(user, siteId, what);
}

const assertVehicleAssetAccess = (user: ScopedUser, assetId: number) =>
  assertAssetAccess(user, assetId, "vehicle papers", "Vehicle not found.");
const assertVehicleRecordAccess = (user: ScopedUser, id: number) =>
  assertRecordAccess(user, complianceDb.getVehicleComplianceSiteId(id), "vehicle papers", "Vehicle papers not found.");

const GENERATORS = "generator records";
const BUILDINGS = "building certificates";
const DONORS = "donor reports";

const docStatusZod = z.enum(["compliant", "expiring", "non_compliant"]);
const generatorStatusZod = z.enum(["serviced", "due_soon", "overdue"]);
const donorStatusZod = z.enum(["submitted", "due_soon", "overdue", "pending"]);

export const complianceTrackingRouter = router({
  // IVA-169: admins get org-wide counts; everyone else only their facility (no facility gives zeros).
  summary: protectedProcedure.query(({ ctx }) =>
    complianceDb.getComplianceSummary(ctx.user.role === "admin" ? undefined : { siteId: ctx.user.siteId ?? null })
  ),

  lookupAsset: protectedProcedure
    .input(z.object({ assetCode: z.string().min(1) }))
    .query(({ input }) => complianceDb.lookupAssetByCode(input.assetCode.trim())),

  vehicles: router({
    list: protectedProcedure
      .input(z.object({ status: docStatusZod.optional() }).optional())
      .query(({ input, ctx }) =>
        complianceDb.listVehicleCompliance({ ...(input ?? {}), siteId: complianceListSiteId(ctx.user) })
      ),

    upsert: managerOrAdminProcedure
      .input(
        z.object({
          id: z.number().optional(),
          assetId: z.number(),
          plateNumber: z.string().optional(),
          roadWorthinessExpiry: z.string().optional(),
          insuranceExpiry: z.string().optional(),
          licenceExpiry: z.string().optional(),
          lastInspectionDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.id !== undefined) await assertVehicleRecordAccess(ctx.user, input.id);
        await assertVehicleAssetAccess(ctx.user, input.assetId);
        return complianceDb.upsertVehicleCompliance({ ...input, createdBy: ctx.user.id });
      }),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await assertVehicleRecordAccess(ctx.user, input.id);
        return complianceDb.deleteVehicleCompliance(input.id);
      }),
  }),

  generators: router({
    list: protectedProcedure
      .input(z.object({ status: generatorStatusZod.optional() }).optional())
      .query(({ input, ctx }) =>
        complianceDb.listGeneratorCompliance({ ...(input ?? {}), siteId: complianceListSiteId(ctx.user) })
      ),

    upsert: managerOrAdminProcedure
      .input(
        z.object({
          id: z.number().optional(),
          assetId: z.number(),
          lastServiceDate: z.string().optional(),
          nextServiceDue: z.string().optional(),
          serviceProvider: z.string().optional(),
          runningHoursAtService: z.number().int().optional(),
          safetyCertExpiry: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.id !== undefined) {
          await assertRecordAccess(ctx.user, complianceDb.getGeneratorComplianceSiteId(input.id), GENERATORS, "Generator record not found.");
        }
        await assertAssetAccess(ctx.user, input.assetId, GENERATORS, "Generator not found.");
        return complianceDb.upsertGeneratorCompliance({ ...input, createdBy: ctx.user.id });
      }),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordAccess(ctx.user, complianceDb.getGeneratorComplianceSiteId(input.id), GENERATORS, "Generator record not found.");
        return complianceDb.deleteGeneratorCompliance(input.id);
      }),
  }),

  buildings: router({
    list: protectedProcedure
      .input(z.object({ status: docStatusZod.optional() }).optional())
      .query(({ input, ctx }) =>
        complianceDb.listBuildingSafety({ ...(input ?? {}), siteId: complianceListSiteId(ctx.user) })
      ),

    upsert: managerOrAdminProcedure
      .input(
        z.object({
          id: z.number().optional(),
          siteId: z.number(),
          certificateType: z.string().min(1),
          issuingAuthority: z.string().optional(),
          certificateNumber: z.string().optional(),
          issueDate: z.string().optional(),
          expiryDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.id !== undefined) {
          await assertRecordAccess(ctx.user, complianceDb.getBuildingSafetySiteId(input.id), BUILDINGS, "Building certificate not found.");
        }
        assertComplianceFacility(ctx.user, input.siteId, BUILDINGS);
        return complianceDb.upsertBuildingSafety({ ...input, createdBy: ctx.user.id });
      }),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordAccess(ctx.user, complianceDb.getBuildingSafetySiteId(input.id), BUILDINGS, "Building certificate not found.");
        return complianceDb.deleteBuildingSafety(input.id);
      }),
  }),

  donor: router({
    list: protectedProcedure
      .input(z.object({ status: donorStatusZod.optional() }).optional())
      .query(({ input, ctx }) =>
        complianceDb.listDonorReporting({ ...(input ?? {}), siteId: complianceListSiteId(ctx.user) })
      ),

    upsert: managerOrAdminProcedure
      .input(
        z.object({
          id: z.number().optional(),
          donorName: z.string().min(1),
          programmeRef: z.string().optional(),
          assetId: z.number().nullable().optional(),
          siteId: z.number().nullable().optional(),
          reportType: z.string().min(1),
          dueDate: z.string(),
          submittedDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.id !== undefined) {
          await assertRecordAccess(ctx.user, complianceDb.getDonorReportingSiteId(input.id), DONORS, "Donor report not found.");
        }
        // Target facility: the report's own facility, else its asset's. Both, when given, must be allowed.
        if (input.assetId != null) await assertAssetAccess(ctx.user, input.assetId, DONORS, "Asset not found.");
        if (input.siteId != null || input.assetId == null) assertComplianceFacility(ctx.user, input.siteId ?? null, DONORS);
        return complianceDb.upsertDonorReporting({ ...input, createdBy: ctx.user.id });
      }),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordAccess(ctx.user, complianceDb.getDonorReportingSiteId(input.id), DONORS, "Donor report not found.");
        return complianceDb.deleteDonorReporting(input.id);
      }),
  }),
});
