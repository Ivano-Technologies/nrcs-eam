/**
 * Phase 2 — GRN receipt lines that reference a CTN write to `stock_movements`
 * (see docs/inventory-ledger-architecture.md Decision 1).
 */
import { and, eq, sql } from "drizzle-orm";
import {
  commodityTrackingNumbers,
  inventoryCatalogue,
  inventoryStock,
  stockCards,
  stockMovements,
} from "../../drizzle/schema";
import { ensureOpenBinCardForStockCard } from "./binCard";
type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export async function assertCtnMatchesCatalogue(db: Db, ctnId: number, catalogueId: number): Promise<void> {
  const [row] = await db
    .select({ itemId: commodityTrackingNumbers.itemId })
    .from(commodityTrackingNumbers)
    .where(eq(commodityTrackingNumbers.id, ctnId))
    .limit(1);
  if (!row) {
    throw new Error("CTN not found");
  }
  if (row.itemId !== catalogueId) {
    throw new Error("GRN line catalogueId does not match CTN item");
  }
}

export async function ensureStockCardForCtnAtLocation(
  db: Db,
  params: { ctnId: number; locationId: number }
): Promise<number> {
  const { ctnId, locationId } = params;
  const [existing] = await db
    .select({ id: stockCards.id })
    .from(stockCards)
    .where(and(eq(stockCards.ctnId, ctnId), eq(stockCards.locationId, locationId)))
    .limit(1);
  if (existing) return existing.id;

  const [ctn] = await db
    .select({
      itemId: commodityTrackingNumbers.itemId,
      expiryDate: commodityTrackingNumbers.expiryDate,
      unit: commodityTrackingNumbers.unit,
    })
    .from(commodityTrackingNumbers)
    .where(eq(commodityTrackingNumbers.id, ctnId))
    .limit(1);
  if (!ctn) throw new Error("CTN not found");

  const [cat] = await db
    .select({
      itemCode: inventoryCatalogue.itemCode,
      name: inventoryCatalogue.name,
      unitOfMeasure: inventoryCatalogue.unitOfMeasure,
    })
    .from(inventoryCatalogue)
    .where(eq(inventoryCatalogue.id, ctn.itemId))
    .limit(1);
  if (!cat) throw new Error("Catalogue row missing for CTN");

  await db
    .insert(stockCards)
    .values({
      ctnId,
      locationId,
      description: cat.name,
      itemCode: cat.itemCode,
      measureUnit: ctn.unit || cat.unitOfMeasure,
      expiryDate: ctn.expiryDate ?? null,
    })
    .onConflictDoNothing({ target: [stockCards.ctnId, stockCards.locationId] });

  const [after] = await db
    .select({ id: stockCards.id })
    .from(stockCards)
    .where(and(eq(stockCards.ctnId, ctnId), eq(stockCards.locationId, locationId)))
    .limit(1);
  if (!after) throw new Error("Failed to resolve stock card after insert");
  return after.id;
}

async function netOnStockCard(db: Db, stockCardId: number): Promise<number> {
  const [agg] = await db
    .select({
      net: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(
        Number
      ),
    })
    .from(stockMovements)
    .where(eq(stockMovements.stockCardId, stockCardId));
  return Number(agg?.net ?? 0);
}

export async function insertGrnReceiptMovement(
  db: Db,
  params: {
    stockCardId: number;
    quantityIn: number;
    documentNumber: string;
    fromTo: string | null;
    remarks: string | null;
    createdBy: number | null;
  }
): Promise<void> {
  const prev = await netOnStockCard(db, params.stockCardId);
  const balanceAfter = prev + params.quantityIn;
  const today = new Date().toISOString().slice(0, 10);
  const binCardId = await ensureOpenBinCardForStockCard(db, params.stockCardId);
  await db.insert(stockMovements).values({
    stockCardId: params.stockCardId,
    binCardId,
    date: today,
    documentRef: params.documentNumber,
    fromTo: params.fromTo,
    quantityIn: params.quantityIn,
    quantityOut: 0,
    balanceAfter,
    remarks: params.remarks,
    sourceType: "grn",
    createdBy: params.createdBy,
  });
}

export async function applyTransitionalInventoryStockReceipt(
  db: Db,
  params: { catalogueId: number; warehouseId: number; quantity: number }
): Promise<void> {
  const [stock] = await db
    .select()
    .from(inventoryStock)
    .where(and(eq(inventoryStock.catalogueId, params.catalogueId), eq(inventoryStock.warehouseId, params.warehouseId)))
    .limit(1);

  const current = stock
    ? stock
    : (
        await db
          .insert(inventoryStock)
          .values({ catalogueId: params.catalogueId, warehouseId: params.warehouseId })
          .returning()
      )[0];

  const nextOnHand = Number(current.quantityOnHand) + Number(params.quantity);
  // TODO(Phase 5): TRANSITIONAL: inventory_stock is written alongside stock_movements
  // until Phase 5 migrates UI reads to stock_movements aggregates. Remove this dual-write
  // in Phase 5. See docs/inventory-ledger-architecture.md § Transitional dual-writes.
  await db
    .update(inventoryStock)
    .set({ quantityOnHand: nextOnHand, lastMovementAt: new Date(), updatedAt: new Date() })
    .where(eq(inventoryStock.id, current.id));
}
