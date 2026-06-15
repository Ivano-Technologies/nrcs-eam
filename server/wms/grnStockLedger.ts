/**
 * Phase 2 — GRN receipt lines that reference a CTN write to `stock_movements`
 * (see docs/inventory-ledger-architecture.md Decision 1).
 */
import { and, asc, eq, sql } from "drizzle-orm";
import {
  commodityTrackingNumbers,
  goodsReceivedNoteLines,
  goodsReceivedNotes,
  inventoryCatalogue,
  stockCards,
  stockMovements,
  type GoodsReceivedNote,
  type GoodsReceivedNoteLine,
} from "../../drizzle/schema";
import { ensureOpenBinCardForStockCard } from "./binCard";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
export type GrnLedgerDb = Db;

export type GrnFinalizeContext = {
  grn: GoodsReceivedNote;
  lines: GoodsReceivedNoteLine[];
};

export async function loadGrnFinalizeContext(db: Db, grnId: number): Promise<GrnFinalizeContext> {
  const [grn] = await db.select().from(goodsReceivedNotes).where(eq(goodsReceivedNotes.id, grnId)).limit(1);
  if (!grn) {
    throw new Error("GRN not found.");
  }
  const lines = await db
    .select()
    .from(goodsReceivedNoteLines)
    .where(eq(goodsReceivedNoteLines.grnId, grnId))
    .orderBy(asc(goodsReceivedNoteLines.lineOrder));
  return { grn, lines };
}

export async function validateGrnFinalize(db: Db, ctx: GrnFinalizeContext): Promise<void> {
  const { grn, lines } = ctx;
  if (grn.status !== "draft" && grn.status !== "pending_approval") {
    throw new Error("GRN is not in a finalizable state.");
  }
  if (lines.length === 0) {
    throw new Error("GRN has no line items.");
  }
  const errors: string[] = [];
  for (const line of lines) {
    if (line.ctnId == null) {
      errors.push(
        `Line ${line.lineOrder + 1}: CTN is required. Create the CTN in the CTN Registry first, or use the GRN form's inline CTN creator.`
      );
      continue;
    }
    const [ctn] = await db
      .select({ id: commodityTrackingNumbers.id })
      .from(commodityTrackingNumbers)
      .where(eq(commodityTrackingNumbers.id, line.ctnId))
      .limit(1);
    if (!ctn) {
      errors.push(`Line ${line.lineOrder + 1}: CTN not found.`);
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}

export async function finalizeGrnLedger(
  db: Db,
  ctx: GrnFinalizeContext,
  params: { userId: number | null }
): Promise<void> {
  const { grn, lines } = ctx;
  for (const line of lines) {
    if (line.ctnId == null) continue;
    const stockCardId = await ensureStockCardForCtnAtLocation(db, {
      ctnId: line.ctnId,
      locationId: grn.delegationLocationId,
    });
    await insertGrnReceiptMovement(db, {
      stockCardId,
      quantityIn: Number(line.nbOfUnits),
      documentNumber: grn.grnNumber,
      fromTo: grn.receivedFrom ?? null,
      remarks: line.claimNotes ?? null,
      createdBy: params.userId,
    });
  }
}

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

