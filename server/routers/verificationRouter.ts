import { TRPCError } from "@trpc/server";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  adminProcedure,
  managerOrAdminProcedure,
} from "./roleProcedures";
import { getDb } from "../db";
import { getCampaignProgressInternal } from "../reports/verificationProgress";
import {
  assetVerifications,
  assets,
  sites,
  verificationCampaigns,
} from "../../drizzle/schema";

const conditionEnum = z.enum([
  "Good",
  "Fair",
  "Damaged",
  "Beyond Repair (For Disposal)",
  "Out of Order (To be repaired)",
]);

export const verificationRouter = router({
  listCampaigns: managerOrAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(verificationCampaigns).orderBy(verificationCampaigns.startsAt);
  }),

  activeCampaign: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select()
      .from(verificationCampaigns)
      .where(eq(verificationCampaigns.status, "active"))
      .limit(1);
    return row ?? null;
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date(),
        scopeType: z.enum(["all_sites", "site_list"]).default("all_sites"),
        siteIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [created] = await db
        .insert(verificationCampaigns)
        .values({
          name: input.name,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          scopeType: input.scopeType,
          siteIds: input.siteIds ?? null,
          createdBy: ctx.user.id,
          status: "draft",
        })
        .returning();
      return created;
    }),

  activate: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db
        .update(verificationCampaigns)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(verificationCampaigns.id, input.id));
      return { success: true };
    }),

  close: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const progress = await getCampaignProgressInternal(db, input.id);
      await db
        .update(verificationCampaigns)
        .set({
          status: "closed",
          closedSummary: progress,
          updatedAt: new Date(),
        })
        .where(eq(verificationCampaigns.id, input.id));

      const verifiedIds = new Set(
        (await db
          .select({ assetId: assetVerifications.assetId })
          .from(assetVerifications)
          .where(eq(assetVerifications.campaignId, input.id))).map((r) => r.assetId)
      );

      const [campaign] = await db
        .select()
        .from(verificationCampaigns)
        .where(eq(verificationCampaigns.id, input.id))
        .limit(1);

      let scopeSiteIds: number[] | null = null;
      if (campaign?.scopeType === "site_list" && campaign.siteIds) {
        scopeSiteIds = campaign.siteIds as number[];
      }

      const assetConditions = [eq(assets.status, "operational")];
      if (scopeSiteIds && scopeSiteIds.length > 0) {
        assetConditions.push(inArray(assets.siteId, scopeSiteIds));
      }
      const allAssets = await db
        .select({ id: assets.id })
        .from(assets)
        .where(and(...assetConditions));

      for (const asset of allAssets) {
        if (!verifiedIds.has(asset.id)) {
          await db
            .update(assets)
            .set({
              notVerifiedCampaignName: campaign?.name ?? "Campaign",
              lastVerificationCampaignId: input.id,
            })
            .where(eq(assets.id, asset.id));
        }
      }

      return { success: true, summary: progress };
    }),

  submitVerification: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        assetId: z.number(),
        method: z.enum(["scan", "manual"]),
        condition: conditionEnum,
        locationSiteId: z.number(),
        notes: z.string().optional(),
        manualReason: z.string().optional(),
        photoDocumentId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "user") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Staff access required" });
      }
      if (input.method === "manual" && !input.manualReason?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Manual verification requires a reason" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [campaign] = await db
        .select()
        .from(verificationCampaigns)
        .where(eq(verificationCampaigns.id, input.campaignId))
        .limit(1);
      if (!campaign || campaign.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign is not active" });
      }

      await db
        .insert(assetVerifications)
        .values({
          campaignId: input.campaignId,
          assetId: input.assetId,
          verifiedBy: ctx.user.id,
          method: input.method,
          condition: input.condition,
          locationSiteId: input.locationSiteId,
          notes: input.notes ?? null,
          manualReason: input.manualReason ?? null,
          photoDocumentId: input.photoDocumentId ?? null,
        })
        .onConflictDoUpdate({
          target: [assetVerifications.campaignId, assetVerifications.assetId],
          set: {
            verifiedBy: ctx.user.id,
            verifiedAt: new Date(),
            method: input.method,
            condition: input.condition,
            locationSiteId: input.locationSiteId,
            notes: input.notes ?? null,
            manualReason: input.manualReason ?? null,
          },
        });

      await db
        .update(assets)
        .set({
          conditionRegister: input.condition,
          lastPhysicalCheck: new Date().toISOString().slice(0, 10),
          lastVerificationCampaignId: input.campaignId,
          notVerifiedCampaignName: null,
        })
        .where(eq(assets.id, input.assetId));

      return { success: true };
    }),

  campaignProgress: managerOrAdminProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return getCampaignProgressInternal(db, input.campaignId);
    }),

  discrepancies: managerOrAdminProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          assetId: assetVerifications.assetId,
          assetTag: assets.assetTag,
          assetName: assets.name,
          registeredSiteId: assets.siteId,
          registeredSiteName: sites.name,
          verifiedSiteId: assetVerifications.locationSiteId,
        })
        .from(assetVerifications)
        .innerJoin(assets, eq(assetVerifications.assetId, assets.id))
        .innerJoin(sites, eq(assets.siteId, sites.id))
        .where(eq(assetVerifications.campaignId, input.campaignId));

      const discrepancies = [];
      for (const row of rows) {
        if (row.registeredSiteId !== row.verifiedSiteId) {
          const [verifiedSite] = await db
            .select({ name: sites.name })
            .from(sites)
            .where(eq(sites.id, row.verifiedSiteId))
            .limit(1);
          discrepancies.push({
            ...row,
            verifiedSiteName: verifiedSite?.name ?? "Unknown",
          });
        }
      }
      return discrepancies;
    }),
});
