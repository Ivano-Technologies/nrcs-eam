import { and, asc, eq, lte, gte, sql } from "drizzle-orm";
import {
  commodityTrackingNumbers,
  donors,
  inventoryCatalogue,
  sites,
  stockCards,
  stockMovements,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type StockCheckComputation = {
  quantityIn: number;
  quantityOut: number;
  balanceAfter: number;
  variance: number;
};

export function requiresSupervisorForRetroactiveEntry(entryDateIso: string, todayIso: string): boolean {
  return entryDateIso !== todayIso;
}

export function computeStockCheckMovement(currentBalance: number, countedQty: number): StockCheckComputation {
  const variance = countedQty - currentBalance;
  return {
    quantityIn: variance > 0 ? variance : 0,
    quantityOut: variance < 0 ? Math.abs(variance) : 0,
    balanceAfter: countedQty,
    variance,
  };
}

export async function stockCardNet(db: Db, stockCardId: number): Promise<number> {
  const [agg] = await db
    .select({
      net: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
    })
    .from(stockMovements)
    .where(eq(stockMovements.stockCardId, stockCardId));
  return Number(agg?.net ?? 0);
}

export async function listStockCards(db: Db, filters: {
  search?: string;
  locationId?: number;
  expiryWindow?: "all" | "expiring-30" | "expiring-90" | "expired";
  lowStockOnly?: boolean;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const q = filters.search?.trim() ? `%${filters.search.trim()}%` : undefined;

  const rows = await db
    .select({
      stockCardId: stockCards.id,
      itemName: inventoryCatalogue.name,
      itemCode: inventoryCatalogue.itemCode,
      ctnCode: commodityTrackingNumbers.ctnCode,
      donorCode: donors.code,
      donorName: donors.name,
      locationName: sites.name,
      locationId: stockCards.locationId,
      unit: stockCards.measureUnit,
      expiryDate: stockCards.expiryDate,
      stockMinimum: stockCards.stockMinimum,
      currentBalance: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
      lastMovementDate: sql<string | null>`max(${stockMovements.date})`,
    })
    .from(stockCards)
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
    .innerJoin(donors, eq(commodityTrackingNumbers.donorId, donors.id))
    .innerJoin(sites, eq(stockCards.locationId, sites.id))
    .leftJoin(stockMovements, eq(stockMovements.stockCardId, stockCards.id))
    .where(
      and(
        filters.locationId ? eq(stockCards.locationId, filters.locationId) : undefined,
        q
          ? sql<boolean>`(${inventoryCatalogue.name} ilike ${q} or ${commodityTrackingNumbers.ctnCode} ilike ${q} or ${donors.code} ilike ${q})`
          : undefined,
        filters.expiryWindow === "expired" ? lte(stockCards.expiryDate, todayIso) : undefined,
        filters.expiryWindow === "expiring-30" ? and(gte(stockCards.expiryDate, todayIso), lte(stockCards.expiryDate, in30)) : undefined,
        filters.expiryWindow === "expiring-90" ? and(gte(stockCards.expiryDate, todayIso), lte(stockCards.expiryDate, in90)) : undefined
      )
    )
    .groupBy(
      stockCards.id,
      inventoryCatalogue.name,
      inventoryCatalogue.itemCode,
      commodityTrackingNumbers.ctnCode,
      donors.code,
      donors.name,
      sites.name,
      stockCards.locationId,
      stockCards.measureUnit,
      stockCards.expiryDate,
      stockCards.stockMinimum
    )
    .orderBy(asc(inventoryCatalogue.name), asc(commodityTrackingNumbers.ctnCode));

  if (!filters.lowStockOnly) return rows.map((r) => ({ ...r, minStockFlag: Number(r.stockMinimum ?? 0) > 0 && Number(r.currentBalance) < Number(r.stockMinimum ?? 0) }));
  return rows
    .filter((r) => Number(r.stockMinimum ?? 0) > 0 && Number(r.currentBalance) < Number(r.stockMinimum ?? 0))
    .map((r) => ({ ...r, minStockFlag: true }));
}

export async function getStockCardDetail(db: Db, id: number) {
  const [card] = await db
    .select({
      id: stockCards.id,
      ctnId: stockCards.ctnId,
      locationId: stockCards.locationId,
      description: stockCards.description,
      itemCode: stockCards.itemCode,
      measureUnit: stockCards.measureUnit,
      expiryDate: stockCards.expiryDate,
      stockMinimum: stockCards.stockMinimum,
      ctnCode: commodityTrackingNumbers.ctnCode,
      donorCode: donors.code,
      donorName: donors.name,
      locationName: sites.name,
      itemName: inventoryCatalogue.name,
    })
    .from(stockCards)
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .innerJoin(donors, eq(commodityTrackingNumbers.donorId, donors.id))
    .innerJoin(sites, eq(stockCards.locationId, sites.id))
    .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
    .where(eq(stockCards.id, id))
    .limit(1);

  if (!card) return null;

  const ledger = await db
    .select({
      id: stockMovements.id,
      date: stockMovements.date,
      documentRef: stockMovements.documentRef,
      fromTo: stockMovements.fromTo,
      quantityIn: stockMovements.quantityIn,
      quantityOut: stockMovements.quantityOut,
      balanceAfter: stockMovements.balanceAfter,
      remarks: stockMovements.remarks,
      storekeeperInitials: stockMovements.storekeeperInitials,
      sourceType: stockMovements.sourceType,
      binCardId: stockMovements.binCardId,
      createdByName: users.name,
    })
    .from(stockMovements)
    .leftJoin(users, eq(stockMovements.createdBy, users.id))
    .where(eq(stockMovements.stockCardId, id))
    .orderBy(asc(stockMovements.date), asc(stockMovements.id));

  return { card, ledger };
}

export function buildRetroactiveStockCheckRemark(params: {
  original?: string | null;
  actorName: string;
  todayIso: string;
}) {
  const prefix = `Retroactively recorded by ${params.actorName} on ${params.todayIso}`;
  if (!params.original?.trim()) return prefix;
  return `${prefix}. ${params.original.trim()}`;
}

