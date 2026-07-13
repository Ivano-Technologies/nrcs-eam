import { and, eq, gt, lte, sql } from "drizzle-orm";
import {
  commodityTrackingNumbers,
  inventoryCatalogue,
  sites,
  stockCards,
  stockMovements,
} from "../../drizzle/schema";
import { getDb } from "../db";

export type ExpiryBucketRow = {
  bucket: "30" | "60" | "90";
  warehouseId: number;
  warehouseName: string;
  category: string;
  quantity: number;
  estimatedValue: number;
};

export type WriteOffCandidate = {
  ctnId: number;
  ctnCode: string;
  itemName: string;
  warehouseId: number;
  warehouseName: string;
  balance: number;
  expiryDate: string;
  category: string;
};

export async function buildExpiryHorizonBuckets(): Promise<{
  buckets: ExpiryBucketRow[];
  writeOffCandidates: WriteOffCandidate[];
}> {
  const db = await getDb();
  if (!db) return { buckets: [], writeOffCandidates: [] };

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const d30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const d60 = new Date(today.getTime() + 60 * 86400000).toISOString().slice(0, 10);
  const d90 = new Date(today.getTime() + 90 * 86400000).toISOString().slice(0, 10);

  const rows = await db
    .select({
      stockCardId: stockCards.id,
      ctnId: commodityTrackingNumbers.id,
      ctnCode: commodityTrackingNumbers.ctnCode,
      itemName: inventoryCatalogue.name,
      warehouseId: stockCards.locationId,
      warehouseName: sites.name,
      category: inventoryCatalogue.category,
      expiryDate: stockCards.expiryDate,
      balance: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(
        Number
      ),
    })
    .from(stockCards)
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
    .innerJoin(sites, eq(stockCards.locationId, sites.id))
    .leftJoin(stockMovements, eq(stockMovements.stockCardId, stockCards.id))
    .groupBy(
      stockCards.id,
      commodityTrackingNumbers.id,
      commodityTrackingNumbers.ctnCode,
      inventoryCatalogue.name,
      stockCards.locationId,
      sites.name,
      inventoryCatalogue.category,
      stockCards.expiryDate
    );

  const bucketMap = new Map<string, ExpiryBucketRow>();
  const writeOffCandidates: WriteOffCandidate[] = [];

  for (const row of rows) {
    const balance = Number(row.balance ?? 0);
    if (balance <= 0 || !row.expiryDate) continue;

    if (row.expiryDate < todayIso) {
      writeOffCandidates.push({
        ctnId: row.ctnId,
        ctnCode: row.ctnCode,
        itemName: row.itemName,
        warehouseId: row.warehouseId,
        warehouseName: row.warehouseName,
        balance,
        expiryDate: row.expiryDate,
        category: row.category ?? "other",
      });
      continue;
    }

    let bucket: "30" | "60" | "90" | null = null;
    if (row.expiryDate <= d30) bucket = "30";
    else if (row.expiryDate <= d60) bucket = "60";
    else if (row.expiryDate <= d90) bucket = "90";
    if (!bucket) continue;

    const key = `${bucket}|${row.warehouseId}|${row.category}`;
    const existing = bucketMap.get(key);
    if (existing) {
      existing.quantity += balance;
      existing.estimatedValue += balance;
    } else {
      bucketMap.set(key, {
        bucket,
        warehouseId: row.warehouseId,
        warehouseName: row.warehouseName,
        category: row.category ?? "other",
        quantity: balance,
        estimatedValue: balance,
      });
    }
  }

  return {
    buckets: Array.from(bucketMap.values()).sort(
      (a, b) => Number(a.bucket) - Number(b.bucket) || a.warehouseName.localeCompare(b.warehouseName)
    ),
    writeOffCandidates,
  };
}

/** CTNs whose expiry entered the 30-day window today (for digest). */
export async function listCtnsEntering30DayBucketToday(): Promise<
  Array<{ itemName: string; ctnCode: string; warehouseName: string; expiryDate: string; balance: number }>
> {
  const db = await getDb();
  if (!db) return [];
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  const rows = await db
    .select({
      itemName: inventoryCatalogue.name,
      ctnCode: commodityTrackingNumbers.ctnCode,
      warehouseName: sites.name,
      expiryDate: stockCards.expiryDate,
      balance: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(
        Number
      ),
    })
    .from(stockCards)
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
    .innerJoin(sites, eq(stockCards.locationId, sites.id))
    .leftJoin(stockMovements, eq(stockMovements.stockCardId, stockCards.id))
    .where(
      and(
        sql`${stockCards.expiryDate} > ${yesterday}`,
        lte(stockCards.expiryDate, in30),
        gt(stockCards.expiryDate, todayIso)
      )
    )
    .groupBy(
      inventoryCatalogue.name,
      commodityTrackingNumbers.ctnCode,
      sites.name,
      stockCards.expiryDate
    );

  return rows
    .filter((r) => Number(r.balance) > 0 && r.expiryDate)
    .map((r) => ({
      itemName: r.itemName,
      ctnCode: r.ctnCode,
      warehouseName: r.warehouseName,
      expiryDate: r.expiryDate!,
      balance: Number(r.balance),
    }));
}
