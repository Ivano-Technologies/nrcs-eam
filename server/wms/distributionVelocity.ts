import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { stockCards, stockMovements, waybills } from "../../drizzle/schema";
import { isDistributionVelocityMvAvailable } from "../_core/distributionVelocityMv";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export const WAYBILL_DISTRIBUTION_DESTINATIONS = ["beneficiary", "distribution_point"] as const;

export type DistributionVelocityWindow = {
  siteId?: number;
  currentStartIso: string;
  currentEndIso: string;
  previousStartIso: string;
  previousEndIso: string;
};

export type DistributionVelocityTotals = {
  current: number;
  previous: number;
  historical: number;
};

function mapTotalsRow(row: {
  current?: number | null;
  previous?: number | null;
  historical?: number | null;
}): DistributionVelocityTotals {
  return {
    current: Number(row.current ?? 0),
    previous: Number(row.previous ?? 0),
    historical: Number(row.historical ?? 0),
  };
}

async function queryDistributionVelocityTotalsFromMv(
  database: Db,
  window: DistributionVelocityWindow
): Promise<DistributionVelocityTotals> {
  const siteFilter =
    window.siteId != null ? sql`AND location_id = ${window.siteId}` : sql``;

  const rows = await database.execute(sql`
    SELECT
      coalesce(sum(total_out) FILTER (
        WHERE movement_date >= ${window.currentStartIso}::date
          AND movement_date <= ${window.currentEndIso}::date
      ), 0)::double precision AS current,
      coalesce(sum(total_out) FILTER (
        WHERE movement_date >= ${window.previousStartIso}::date
          AND movement_date <= ${window.previousEndIso}::date
      ), 0)::double precision AS previous,
      coalesce(sum(total_out), 0)::double precision AS historical
    FROM distribution_outbound_daily
    WHERE true ${siteFilter}
  `);

  const list = Array.isArray(rows) ? rows : (rows as { rows?: Record<string, unknown>[] }).rows;
  const row = (list?.[0] ?? {}) as { current?: number; previous?: number; historical?: number };
  return mapTotalsRow(row);
}

async function queryDistributionVelocityTotalsFromJoins(
  database: Db,
  window: DistributionVelocityWindow
): Promise<DistributionVelocityTotals> {
  const distributionDestFilter = inArray(waybills.destinationType, [...WAYBILL_DISTRIBUTION_DESTINATIONS]);
  const cardSiteFilter = window.siteId != null ? eq(stockCards.locationId, window.siteId) : undefined;

  const baseWhere = and(
    eq(stockMovements.sourceType, "waybill"),
    distributionDestFilter,
    cardSiteFilter ?? sql`true`
  );

  const [currentDist, previousDist, historicalDist] = await Promise.all([
    database
      .select({ total: sql<number>`coalesce(sum(${stockMovements.quantityOut}),0)`.mapWith(Number) })
      .from(stockMovements)
      .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
      .innerJoin(waybills, eq(stockMovements.documentRef, waybills.wbNumber))
      .where(
        and(
          baseWhere,
          gte(stockMovements.date, window.currentStartIso),
          lte(stockMovements.date, window.currentEndIso)
        )
      ),
    database
      .select({ total: sql<number>`coalesce(sum(${stockMovements.quantityOut}),0)`.mapWith(Number) })
      .from(stockMovements)
      .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
      .innerJoin(waybills, eq(stockMovements.documentRef, waybills.wbNumber))
      .where(
        and(
          baseWhere,
          gte(stockMovements.date, window.previousStartIso),
          lte(stockMovements.date, window.previousEndIso)
        )
      ),
    database
      .select({ total: sql<number>`coalesce(sum(${stockMovements.quantityOut}),0)`.mapWith(Number) })
      .from(stockMovements)
      .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
      .innerJoin(waybills, eq(stockMovements.documentRef, waybills.wbNumber))
      .where(baseWhere),
  ]);

  return {
    current: Number(currentDist[0]?.total ?? 0),
    previous: Number(previousDist[0]?.total ?? 0),
    historical: Number(historicalDist[0]?.total ?? 0),
  };
}

export async function queryDistributionVelocityTotals(
  database: Db,
  window: DistributionVelocityWindow
): Promise<DistributionVelocityTotals> {
  if (await isDistributionVelocityMvAvailable(database)) {
    return queryDistributionVelocityTotalsFromMv(database, window);
  }
  return queryDistributionVelocityTotalsFromJoins(database, window);
}
