import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { managerOrAdminProcedure } from "./routers/roleProcedures";
import { TRPCError } from "@trpc/server";
import * as complianceDb from "./complianceTrackingDb";

type ScopedUser = { role: string; siteId: number | null };

/** Admins see every facility; everyone else only their own (no facility means nothing). */
export function vehiclePapersListSiteId(user: ScopedUser): number | undefined {
  if (user.role === "admin") return undefined;
  return user.siteId ?? -1;
}

/** Non-admins may only change papers for vehicles at their own facility (IVA-160). */
export function assertVehicleFacility(user: ScopedUser, vehicleSiteId: number | null): void {
  if (user.role === "admin") return;
  if (user.siteId == null || vehicleSiteId == null || vehicleSiteId !== user.siteId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You can only manage vehicle papers for your own facility." });
  }
}

async function assertVehicleAssetAccess(user: ScopedUser, assetId: number) {
  const siteId = await complianceDb.getAssetSiteId(assetId);
  if (siteId === undefined) throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle not found." });
  assertVehicleFacility(user, siteId);
}

async function assertVehicleRecordAccess(user: ScopedUser, id: number) {
  const siteId = await complianceDb.getVehicleComplianceSiteId(id);
  if (siteId === undefined) throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle papers not found." });
  assertVehicleFacility(user, siteId);
}

const docStatusZod = z.enum(["compliant", "expiring", "non_compliant"]);
const generatorStatusZod = z.enum(["serviced", "due_soon", "overdue"]);
const donorStatusZod = z.enum(["submitted", "due_soon", "overdue", "pending"]);

export const complianceTrackingRouter = router({
  summary: protectedProcedure.query(() => complianceDb.getComplianceSummary()),

  lookupAsset: protectedProcedure
    .input(z.object({ assetCode: z.string().min(1) }))
    .query(({ input }) => complianceDb.lookupAssetByCode(input.assetCode.trim())),

  vehicles: router({
    list: protectedProcedure
      .input(z.object({ status: docStatusZod.optional() }).optional())
      .query(({ input, ctx }) =>
        complianceDb.listVehicleCompliance({ ...(input ?? {}), siteId: vehiclePapersListSiteId(ctx.user) })
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
      .query(({ input }) => complianceDb.listGeneratorCompliance(input ?? undefined)),

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
      .mutation(({ input, ctx }) =>
        complianceDb.upsertGeneratorCompliance({ ...input, createdBy: ctx.user.id })
      ),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => complianceDb.deleteGeneratorCompliance(input.id)),
  }),

  buildings: router({
    list: protectedProcedure
      .input(z.object({ status: docStatusZod.optional() }).optional())
      .query(({ input }) => complianceDb.listBuildingSafety(input ?? undefined)),

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
      .mutation(({ input, ctx }) =>
        complianceDb.upsertBuildingSafety({ ...input, createdBy: ctx.user.id })
      ),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => complianceDb.deleteBuildingSafety(input.id)),
  }),

  donor: router({
    list: protectedProcedure
      .input(z.object({ status: donorStatusZod.optional() }).optional())
      .query(({ input }) => complianceDb.listDonorReporting(input ?? undefined)),

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
      .mutation(({ input, ctx }) =>
        complianceDb.upsertDonorReporting({ ...input, createdBy: ctx.user.id })
      ),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => complianceDb.deleteDonorReporting(input.id)),
  }),
});
