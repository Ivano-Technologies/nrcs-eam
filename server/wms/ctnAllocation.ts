/**
 * FEFO CTN allocation for auto-fulfill and similar flows.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import {
  commodityTrackingNumbers,
  inventoryCatalogue,
  stockCards,
  stockMovements,
} from "../../drizzle/schema";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export type CtnAllocationCandidate = {
  ctnId: number;
  ctnCode: string;
  balance: number;
  expiryDate: string | null;
};

export type CtnAllocationResult = {
  ctnId: number;
  quantity: number;
};

export function isCtnExpired(expiryDate: string | null, todayIso: string): boolean {
  if (!expiryDate) return false;
  return expiryDate < todayIso;
}

export function sortFefoCandidates(candidates: CtnAllocationCandidate[]): CtnAllocationCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.expiryDate == null && b.expiryDate != null) return 1;
    if (a.expiryDate != null && b.expiryDate == null) return -1;
    if (a.expiryDate != null && b.expiryDate != null && a.expiryDate !== b.expiryDate) {
      return a.expiryDate < b.expiryDate ? -1 : 1;
    }
    return a.ctnCode.localeCompare(b.ctnCode);
  });
}

export function allocateFefoFromCandidates(
  candidates: CtnAllocationCandidate[],
  quantity: number,
  todayIso: string
): CtnAllocationResult[] {
  const eligible = sortFefoCandidates(candidates).filter(
    (row) => row.balance > 0 && !isCtnExpired(row.expiryDate, todayIso)
  );

  let remaining = quantity;
  const allocations: CtnAllocationResult[] = [];

  for (const row of eligible) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, row.balance);
    if (take <= 0) continue;
    allocations.push({ ctnId: row.ctnId, quantity: take });
    remaining -= take;
  }

  if (remaining > 0.0001) {
    throw new Error(
      `Insufficient non-expired stock: need ${quantity}, short by ${remaining.toFixed(2)} after FEFO allocation.`
    );
  }

  return allocations;
}

export async function loadFefoCandidates(
  db: Db,
  params: { itemId: number; warehouseId: number }
): Promise<CtnAllocationCandidate[]> {
  const rows = await db
    .select({
      ctnId: stockCards.ctnId,
      ctnCode: commodityTrackingNumbers.ctnCode,
      expiryDate: stockCards.expiryDate,
      balance: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(
        Number
      ),
    })
    .from(stockCards)
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .leftJoin(stockMovements, eq(stockMovements.stockCardId, stockCards.id))
    .where(and(eq(stockCards.locationId, params.warehouseId), eq(commodityTrackingNumbers.itemId, params.itemId)))
    .groupBy(stockCards.id, commodityTrackingNumbers.ctnCode, stockCards.expiryDate)
    .orderBy(asc(commodityTrackingNumbers.ctnCode));

  return rows
    .map((row) => ({
      ctnId: row.ctnId,
      ctnCode: row.ctnCode,
      expiryDate: row.expiryDate ?? null,
      balance: Number(row.balance),
    }))
    .filter((row) => row.balance > 0);
}

export async function pickFefoCtnSources(
  db: Db,
  params: { itemId: number; warehouseId: number; quantity: number; todayIso?: string }
): Promise<CtnAllocationResult[]> {
  const todayIso = params.todayIso ?? new Date().toISOString().slice(0, 10);
  const candidates = await loadFefoCandidates(db, {
    itemId: params.itemId,
    warehouseId: params.warehouseId,
  });

  try {
    return allocateFefoFromCandidates(candidates, params.quantity, todayIso);
  } catch (error) {
    const [cat] = await db
      .select({ name: inventoryCatalogue.name })
      .from(inventoryCatalogue)
      .where(eq(inventoryCatalogue.id, params.itemId))
      .limit(1);
    const itemLabel = cat?.name ?? `item #${params.itemId}`;
    const message = error instanceof Error ? error.message : "FEFO allocation failed.";
    throw new Error(`${itemLabel}: ${message}`);
  }
}
