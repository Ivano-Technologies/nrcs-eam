import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  binCards,
  commodityTrackingNumbers,
  donors,
  inventoryCatalogue,
  sites,
  stockCards,
  stockMovements,
} from "../../drizzle/schema";
import { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export function assertBinCardLifecycleTransition(status: "open" | "closed", action: "close" | "reopen") {
  if (action === "close" && status === "closed") throw new Error("Bin card is already closed.");
  if (action === "reopen" && status === "open") throw new Error("Bin card is already open.");
}

export async function ensureOpenBinCardForStockCard(db: Db, stockCardId: number) {
  const [existing] = await db
    .select({ id: binCards.id })
    .from(binCards)
    .where(and(eq(binCards.stockCardId, stockCardId), eq(binCards.status, "open")))
    .orderBy(desc(binCards.openedAt))
    .limit(1);
  if (existing) return existing.id;

  const [card] = await db
    .select({
      stockCardId: stockCards.id,
      ctnCode: commodityTrackingNumbers.ctnCode,
      donorCode: donors.code,
      itemCode: inventoryCatalogue.itemCode,
      itemName: inventoryCatalogue.name,
      unit: stockCards.measureUnit,
      expiryDate: stockCards.expiryDate,
      locationName: sites.name,
    })
    .from(stockCards)
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .innerJoin(donors, eq(commodityTrackingNumbers.donorId, donors.id))
    .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
    .innerJoin(sites, eq(stockCards.locationId, sites.id))
    .where(eq(stockCards.id, stockCardId))
    .limit(1);

  if (!card) throw new Error("Stock card not found for bin card creation");
  const binNumber = `BIN-${card.itemCode}-${Date.now().toString().slice(-6)}`;
  const [created] = await db
    .insert(binCards)
    .values({
      stockCardId,
      binNumber,
      stockLocation: card.locationName,
      itemCode: card.itemCode,
      itemDescription: card.itemName,
      commodityTrackingNumber: card.ctnCode,
      donorCode: card.donorCode,
      unit: card.unit,
      expiryDate: card.expiryDate,
      status: "open",
    })
    .returning({ id: binCards.id });
  return created.id;
}

export async function listBinCards(db: Db) {
  return db
    .select({
      id: binCards.id,
      binNumber: binCards.binNumber,
      stockLocation: binCards.stockLocation,
      itemCode: binCards.itemCode,
      itemDescription: binCards.itemDescription,
      ctnDonor: sql<string>`concat(coalesce(${binCards.commodityTrackingNumber}, ''), ' / ', coalesce(${binCards.donorCode}, ''))`,
      currentBalance: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
      storekeeper: stockMovements.storekeeperInitials,
      openedAt: binCards.openedAt,
      status: binCards.status,
    })
    .from(binCards)
    .leftJoin(stockMovements, eq(stockMovements.binCardId, binCards.id))
    .groupBy(
      binCards.id,
      binCards.binNumber,
      binCards.stockLocation,
      binCards.itemCode,
      binCards.itemDescription,
      binCards.commodityTrackingNumber,
      binCards.donorCode,
      stockMovements.storekeeperInitials,
      binCards.openedAt,
      binCards.status
    )
    .orderBy(desc(binCards.openedAt));
}

export async function getBinCardDetail(db: Db, id: number) {
  const [card] = await db.select().from(binCards).where(eq(binCards.id, id)).limit(1);
  if (!card) return null;
  const ledger = await db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.binCardId, id))
    .orderBy(asc(stockMovements.date), asc(stockMovements.id));
  return { card, ledger };
}

