/**
 * Asset Map data (`sites.mapFacilities`, `sites.mapFacilityDetail`).
 *
 * Access rule (Kezie, 8 Oct 2026): managers and admins see asset counts, book value and
 * work order figures for every facility. Everyone else (field, staff, user) sees those
 * figures only for the facility on their own account. Facility location, type and stock
 * readiness stay visible to every signed in user, as before.
 *
 * The scoping happens here on the server so hidden figures never reach the browser.
 */
import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { assets, inventoryItems, sites, workOrders } from "../drizzle/schema";
import type { FacilityType } from "../shared/facilities";
import { cacheGetJson, cacheSetJson } from "./_core/cache";
import * as db from "./db";

export type MapAssetsByStatus = { inUse: number; maintenance: number; retired: number };

/** One facility as stored in the 30 minute cache (before role scoping). */
export type MapFacilityRaw = {
  id: number;
  code: string | null;
  name: string;
  facilityType: FacilityType;
  lat: number | null;
  lng: number | null;
  parentFacilityId: number | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  stockScorePercent: number | null;
  adequateCards: number;
  totalCards: number;
  lastMovementDate: string | null;
  assetCount: number;
  assetsByStatus: MapAssetsByStatus;
  inventoryCount: number;
};

/** What the browser receives. Asset figures are null when the caller may not see them. */
export type MapFacility = Omit<MapFacilityRaw, "assetCount" | "assetsByStatus"> & {
  statsVisible: boolean;
  assetCount: number | null;
  assetsByStatus: MapAssetsByStatus | null;
};

export type MapStatsScope = "all" | "own" | "none";

export type MapFacilitiesResult = {
  generatedAt: string;
  statsScope: MapStatsScope;
  ownFacilityId: number | null;
  facilities: MapFacility[];
};

export type MapFacilityDetailRaw = {
  id: number;
  address: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  parentFacility: { id: number; name: string; code: string | null } | null;
  bookValue: number;
  openWorkOrders: number;
  overdueWorkOrders: number;
};

export type MapFacilityDetail = Omit<
  MapFacilityDetailRaw,
  "bookValue" | "openWorkOrders" | "overdueWorkOrders"
> & {
  statsVisible: boolean;
  bookValue: number | null;
  openWorkOrders: number | null;
  overdueWorkOrders: number | null;
};

type MapUser = { role: string; siteId: number | null };

const ELEVATED_ROLES = new Set(["manager", "admin"]);

/** The cache key keeps the `sites:mapNetworkData` prefix so cache hit metrics stay grouped. */
export const MAP_FACILITIES_CACHE_KEY = "sites:mapNetworkData:v2";
const MAP_FACILITIES_TTL_SECONDS = 1800;

export function mapStatsScope(user: MapUser): MapStatsScope {
  if (ELEVATED_ROLES.has(user.role)) return "all";
  return user.siteId != null ? "own" : "none";
}

/** True when this user may see asset counts, book value and work orders for `siteId`. */
export function canSeeFacilityStats(user: MapUser, siteId: number): boolean {
  if (ELEVATED_ROLES.has(user.role)) return true;
  return user.siteId != null && user.siteId === siteId;
}

export function scopeMapFacilities(rows: MapFacilityRaw[], user: MapUser): MapFacility[] {
  return rows.map((row) => {
    const visible = canSeeFacilityStats(user, row.id);
    return {
      ...row,
      statsVisible: visible,
      assetCount: visible ? row.assetCount : null,
      assetsByStatus: visible ? { ...row.assetsByStatus } : null,
    };
  });
}

export function scopeMapFacilityDetail(
  detail: MapFacilityDetailRaw,
  user: MapUser
): MapFacilityDetail {
  const visible = canSeeFacilityStats(user, detail.id);
  return {
    ...detail,
    statsVisible: visible,
    bookValue: visible ? detail.bookValue : null,
    openWorkOrders: visible ? detail.openWorkOrders : null,
    overdueWorkOrders: visible ? detail.overdueWorkOrders : null,
  };
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/** Same book value rule as the fleet health report and branch scorecards. */
const bookValueSql = sql`coalesce(${assets.depreciatedValue}::numeric, ${assets.actualUnitValue}::numeric, ${assets.acquisitionCost}::numeric, 0)`;

/** Same overdue rule as branch scorecards: open and untouched for more than 14 days. */
const OVERDUE_DAYS = 14;

export async function queryMapFacilitiesRaw(): Promise<MapFacilityRaw[]> {
  const database = await db.getDb();
  if (!database) return [];

  const [network, parentRows, assetRows, inventoryRows] = await Promise.all([
    db.getSitesMapNetworkData(),
    database.select({ id: sites.id, parentFacilityId: sites.parentFacilityId }).from(sites),
    database
      .select({
        siteId: assets.siteId,
        inUse: sql<number>`count(*) filter (where ${assets.status} = 'operational')`.mapWith(Number),
        maintenance: sql<number>`count(*) filter (where ${assets.status} in ('maintenance', 'repair'))`.mapWith(
          Number
        ),
        retired: sql<number>`count(*) filter (where ${assets.status} = 'retired')`.mapWith(Number),
      })
      .from(assets)
      .where(ne(assets.status, "disposed"))
      .groupBy(assets.siteId),
    database
      .select({
        siteId: inventoryItems.siteId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(inventoryItems)
      .groupBy(inventoryItems.siteId),
  ]);

  const parentById = new Map(parentRows.map((r) => [r.id, r.parentFacilityId]));
  const assetsBySite = new Map(assetRows.map((r) => [r.siteId, r]));
  const inventoryBySite = new Map(inventoryRows.map((r) => [r.siteId, r.count]));

  return network.map((site) => {
    const a = assetsBySite.get(site.id);
    const byStatus: MapAssetsByStatus = {
      inUse: Number(a?.inUse ?? 0),
      maintenance: Number(a?.maintenance ?? 0),
      retired: Number(a?.retired ?? 0),
    };
    return {
      id: site.id,
      code: site.code,
      name: site.name,
      facilityType: site.facilityType,
      lat: toNumber(site.latitude),
      lng: toNumber(site.longitude),
      parentFacilityId: parentById.get(site.id) ?? null,
      city: site.city,
      state: site.state,
      isActive: site.isActive,
      stockScorePercent: site.stockScorePercent,
      adequateCards: site.adequateCards,
      totalCards: site.totalCards,
      lastMovementDate: site.lastMovementDate,
      assetCount: byStatus.inUse + byStatus.maintenance + byStatus.retired,
      assetsByStatus: byStatus,
      inventoryCount: Number(inventoryBySite.get(site.id) ?? 0),
    };
  });
}

/** All facilities (active and offline) with readiness and asset figures, cached 30 min. */
export async function getMapFacilitiesCached(): Promise<{
  generatedAt: string;
  rows: MapFacilityRaw[];
}> {
  const cached = await cacheGetJson<{ generatedAt: string; rows: MapFacilityRaw[] }>(
    MAP_FACILITIES_CACHE_KEY
  );
  if (cached && Array.isArray(cached.rows)) return cached;
  const rows = await queryMapFacilitiesRaw();
  const value = { generatedAt: new Date().toISOString(), rows };
  await cacheSetJson(MAP_FACILITIES_CACHE_KEY, value, MAP_FACILITIES_TTL_SECONDS);
  return value;
}

/** Drawer details for one facility (not cached; loaded when the drawer opens). */
export async function getMapFacilityDetailRaw(id: number): Promise<MapFacilityDetailRaw | null> {
  const database = await db.getDb();
  if (!database) return null;

  const [site] = await database
    .select({
      id: sites.id,
      address: sites.address,
      contactPerson: sites.contactPerson,
      contactPhone: sites.contactPhone,
      parentFacilityId: sites.parentFacilityId,
    })
    .from(sites)
    .where(eq(sites.id, id))
    .limit(1);
  if (!site) return null;

  const [parentRows, valueRows, woRows] = await Promise.all([
    site.parentFacilityId != null
      ? database
          .select({ id: sites.id, name: sites.name, code: sites.code })
          .from(sites)
          .where(inArray(sites.id, [site.parentFacilityId]))
          .limit(1)
      : Promise.resolve([]),
    database
      .select({ total: sql<number>`coalesce(sum(${bookValueSql}), 0)`.mapWith(Number) })
      .from(assets)
      .where(and(eq(assets.siteId, id), eq(assets.status, "operational"))),
    database
      .select({
        open: sql<number>`count(*)`.mapWith(Number),
        overdue: sql<number>`count(*) filter (where ${workOrders.updatedAt} < now() - ${sql.raw(`interval '${OVERDUE_DAYS} days'`)})`.mapWith(
          Number
        ),
      })
      .from(workOrders)
      .where(
        and(eq(workOrders.siteId, id), notInArray(workOrders.status, ["completed", "cancelled"]))
      ),
  ]);

  const parent = parentRows[0];
  return {
    id: site.id,
    address: site.address,
    contactPerson: site.contactPerson,
    contactPhone: site.contactPhone,
    parentFacility: parent ? { id: parent.id, name: parent.name, code: parent.code } : null,
    bookValue: Math.round(Number(valueRows[0]?.total ?? 0) * 100) / 100,
    openWorkOrders: Number(woRows[0]?.open ?? 0),
    overdueWorkOrders: Number(woRows[0]?.overdue ?? 0),
  };
}
