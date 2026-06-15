/**
 * Transfer dispatch/receive → stock_movements (Phase 4c).
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  commodityTrackingNumbers,
  stockCards,
  stockMovements,
  transferNoteLineCtnSources,
  transferNoteLines,
  transferNotes,
  users,
  type TransferNote,
} from "../../drizzle/schema";
import { isCtnExpired } from "./ctnAllocation";
import { ensureStockCardForCtnAtLocation } from "./grnStockLedger";
import { stockCardNet } from "./stockCard";
import { computeTransferDispatch, computeTransferReceive } from "./transfers";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export type TransferDispatchOverride = {
  ctnSourceId: number;
  overrideByUserId: number;
  overrideReason: string;
};

export type TransferDispatchLine = typeof transferNoteLines.$inferSelect;
export type TransferDispatchSource = typeof transferNoteLineCtnSources.$inferSelect;

export type TransferDispatchContext = {
  transfer: TransferNote;
  lines: TransferDispatchLine[];
  sources: TransferDispatchSource[];
};

async function resolveStockCardAtWarehouse(
  db: Db,
  ctnId: number,
  warehouseId: number
): Promise<number> {
  const [card] = await db
    .select({ id: stockCards.id })
    .from(stockCards)
    .where(and(eq(stockCards.ctnId, ctnId), eq(stockCards.locationId, warehouseId)))
    .limit(1);
  if (!card) {
    throw new Error(`CTN ${ctnId} is not currently held in warehouse ${warehouseId}.`);
  }
  return card.id;
}

export async function loadTransferDispatchContext(
  db: Db,
  transferId: number
): Promise<TransferDispatchContext> {
  const [transfer] = await db.select().from(transferNotes).where(eq(transferNotes.id, transferId)).limit(1);
  if (!transfer) {
    throw new Error("Transfer note not found.");
  }
  const lines = await db
    .select()
    .from(transferNoteLines)
    .where(eq(transferNoteLines.transferNoteId, transfer.id));
  const lineIds = lines.map((line) => line.id);
  const sources =
    lineIds.length > 0
      ? await db
          .select()
          .from(transferNoteLineCtnSources)
          .where(inArray(transferNoteLineCtnSources.transferNoteLineId, lineIds))
      : [];
  return { transfer, lines, sources };
}

export async function validateTransferDispatch(
  db: Db,
  ctx: TransferDispatchContext,
  overrideApprovals: TransferDispatchOverride[] = [],
  todayIso?: string
): Promise<void> {
  const { transfer, lines, sources } = ctx;
  const today = todayIso ?? new Date().toISOString().slice(0, 10);

  if (transfer.status !== "approved") {
    throw new Error("Transfer must be approved before dispatch.");
  }
  if (lines.length === 0) {
    throw new Error("Transfer has no line items.");
  }
  if (sources.length === 0) {
    throw new Error("CTN sources must be allocated before dispatch.");
  }

  const overrideBySourceId = new Map(overrideApprovals.map((entry) => [entry.ctnSourceId, entry]));
  const errors: string[] = [];

  for (const line of lines) {
    const lineSources = sources.filter((source) => source.transferNoteLineId === line.id);
    if (lineSources.length === 0) {
      errors.push(`Line ${line.id}: at least one CTN source is required.`);
      continue;
    }
    const lineQty = Number(line.quantity);
    const sourceQty = lineSources.reduce((sum, source) => sum + Number(source.quantity), 0);
    if (Math.abs(lineQty - sourceQty) > 0.0001) {
      errors.push(`Line ${line.id}: CTN source quantities must equal line quantity.`);
    }

    for (const source of lineSources) {
      const [ctn] = await db
        .select({
          itemId: commodityTrackingNumbers.itemId,
          expiryDate: commodityTrackingNumbers.expiryDate,
        })
        .from(commodityTrackingNumbers)
        .where(eq(commodityTrackingNumbers.id, source.ctnId))
        .limit(1);
      if (!ctn) {
        errors.push(`Line ${line.id}: CTN ${source.ctnId} not found.`);
        continue;
      }
      if (ctn.itemId !== line.catalogueId) {
        errors.push(`Line ${line.id}: CTN ${source.ctnId} item does not match catalogue line.`);
      }
      const stockCardId = await resolveStockCardAtWarehouse(db, source.ctnId, transfer.fromWarehouseId);
      const balance = await stockCardNet(db, stockCardId);
      if (balance < Number(source.quantity)) {
        errors.push(
          `Line ${line.id}: CTN ${source.ctnId} balance ${balance} is below requested ${source.quantity}.`
        );
      }
      const expiryDate = ctn.expiryDate ? String(ctn.expiryDate).slice(0, 10) : null;
      if (isCtnExpired(expiryDate, today)) {
        const override = overrideBySourceId.get(source.id);
        if (!override) {
          errors.push(`Line ${line.id}: expired CTN ${source.ctnId} requires manager override.`);
          continue;
        }
        const [manager] = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, override.overrideByUserId))
          .limit(1);
        if (!manager || !["manager", "admin"].includes(manager.role)) {
          errors.push(`Line ${line.id}: override user must be manager or admin.`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}

export async function dispatchTransferLedger(
  db: Db,
  ctx: TransferDispatchContext,
  params: {
    createdBy: number;
    overrideApprovals?: TransferDispatchOverride[];
  }
): Promise<{ catalogueIds: number[] }> {
  const { transfer, lines, sources } = ctx;
  const overrideBySourceId = new Map((params.overrideApprovals ?? []).map((entry) => [entry.ctnSourceId, entry]));
  const today = new Date().toISOString().slice(0, 10);

  for (const source of sources) {
    const stockCardId = await resolveStockCardAtWarehouse(db, source.ctnId, transfer.fromWarehouseId);
    const prev = await stockCardNet(db, stockCardId);
    const movement = computeTransferDispatch(prev, Number(source.quantity));
    await db.insert(stockMovements).values({
      stockCardId,
      date: today,
      documentRef: transfer.tnNumber,
      fromTo: `transfer:${transfer.toWarehouseId}`,
      quantityIn: 0,
      quantityOut: movement.quantityOut,
      balanceAfter: movement.balanceAfter,
      remarks: "Transfer dispatch",
      sourceType: movement.sourceType,
      createdBy: params.createdBy,
    });
    const override = overrideBySourceId.get(source.id);
    if (override) {
      await db
        .update(transferNoteLineCtnSources)
        .set({
          overrideByUserId: override.overrideByUserId,
          overrideAt: new Date(),
          overrideReason: override.overrideReason,
        })
        .where(eq(transferNoteLineCtnSources.id, source.id));
    }
  }

  await db
    .update(transferNotes)
    .set({ status: "dispatched", dispatchedAt: new Date(), updatedAt: new Date() })
    .where(eq(transferNotes.id, transfer.id));

  return { catalogueIds: Array.from(new Set(lines.map((line) => line.catalogueId))) };
}

export async function validateTransferReceive(ctx: TransferDispatchContext): Promise<void> {
  const { transfer, sources } = ctx;
  if (transfer.status !== "dispatched") {
    throw new Error("Transfer must be dispatched before receive.");
  }
  if (sources.length === 0) {
    throw new Error("Transfer has no CTN sources to receive.");
  }
}

export async function receiveTransferLedger(
  db: Db,
  ctx: TransferDispatchContext,
  params: { createdBy: number }
): Promise<{ catalogueIds: number[] }> {
  const { transfer, lines, sources } = ctx;
  const today = new Date().toISOString().slice(0, 10);

  for (const source of sources) {
    const stockCardId = await ensureStockCardForCtnAtLocation(db, {
      ctnId: source.ctnId,
      locationId: transfer.toWarehouseId,
    });
    const prev = await stockCardNet(db, stockCardId);
    const movement = computeTransferReceive(prev, Number(source.quantity));
    await db.insert(stockMovements).values({
      stockCardId,
      date: today,
      documentRef: transfer.tnNumber,
      fromTo: `transfer:${transfer.fromWarehouseId}`,
      quantityIn: movement.quantityIn,
      quantityOut: 0,
      balanceAfter: movement.balanceAfter,
      remarks: "Transfer receive",
      sourceType: movement.sourceType,
      createdBy: params.createdBy,
    });
  }

  await db
    .update(transferNotes)
    .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(transferNotes.id, transfer.id));

  return { catalogueIds: Array.from(new Set(lines.map((line) => line.catalogueId))) };
}
