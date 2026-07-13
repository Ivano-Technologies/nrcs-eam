import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  assetVerifications,
  assets,
  sites,
  verificationCampaigns,
} from "../../drizzle/schema";
import { getDb } from "../db";

export async function getCampaignProgressInternal(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  campaignId: number
) {
  const [campaign] = await db
    .select()
    .from(verificationCampaigns)
    .where(eq(verificationCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });

  let siteFilter: number[] | undefined;
  if (campaign.scopeType === "site_list" && campaign.siteIds) {
    siteFilter = campaign.siteIds as number[];
  }

  const conditions = [eq(assets.status, "operational")];
  if (siteFilter?.length) conditions.push(inArray(assets.siteId, siteFilter));

  const totalRows = await db
    .select({
      siteId: assets.siteId,
      siteName: sites.name,
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(assets)
    .innerJoin(sites, eq(assets.siteId, sites.id))
    .where(and(...conditions))
    .groupBy(assets.siteId, sites.name);

  const verifiedRows = await db
    .select({
      siteId: assets.siteId,
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(assetVerifications)
    .innerJoin(assets, eq(assetVerifications.assetId, assets.id))
    .where(eq(assetVerifications.campaignId, campaignId))
    .groupBy(assets.siteId);

  const verifiedBySite = new Map(verifiedRows.map((r) => [r.siteId, r.count]));
  const perSite = totalRows.map((row) => {
    const verified = verifiedBySite.get(row.siteId) ?? 0;
    const total = row.count;
    return {
      siteId: row.siteId,
      siteName: row.siteName,
      total,
      verified,
      percent: total > 0 ? Math.round((verified / total) * 1000) / 10 : 0,
    };
  });

  const totalAssets = perSite.reduce((s, r) => s + r.total, 0);
  const totalVerified = perSite.reduce((s, r) => s + r.verified, 0);

  return {
    campaignId,
    campaignName: campaign.name,
    status: campaign.status,
    totalAssets,
    totalVerified,
    percentComplete: totalAssets > 0 ? Math.round((totalVerified / totalAssets) * 1000) / 10 : 0,
    perSite,
  };
}
