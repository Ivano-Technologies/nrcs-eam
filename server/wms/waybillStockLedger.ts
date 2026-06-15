/**
 * Waybill dispatch → stock_movements (see docs/inventory-ledger-architecture.md).
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  commodityTrackingNumbers,
  stockCards,
  stockMovements,
  users,
  waybillLineCtnSources,
  waybillLines,
  waybills,
  type Waybill,
} from "../../drizzle/schema";
import { stockCardNet } from "./stockCard";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export type WaybillDispatchOverride = {
  ctnSourceId: number;
  overrideByUserId: number;
  overrideReason: string;
};

export type WaybillDispatchLine = typeof waybillLines.$inferSelect;
export type WaybillDispatchSource = typeof waybillLineCtnSources.$inferSelect;

export type WaybillDispatchContext = {
  waybill: Waybill;
  lines: WaybillDispatchLine[];
  sources: WaybillDispatchSource[];
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
    throw new Error(`CTN ${ctnId} is not currently held in source warehouse ${warehouseId}.`);
  }
  return card.id;
}

export async function loadWaybillDispatchContext(db: Db, waybillId: number): Promise<WaybillDispatchContext> {
  const [waybill] = await db.select().from(waybills).where(eq(waybills.id, waybillId)).limit(1);
  if (!waybill) {
    throw new Error("Waybill not found.");
  }
  const lines = await db.select().from(waybillLines).where(eq(waybillLines.waybillId, waybill.id));
  const lineIds = lines.map((line) => line.id);
  const sources =
    lineIds.length > 0
      ? await db.select().from(waybillLineCtnSources).where(inArray(waybillLineCtnSources.waybillLineId, lineIds))
      : [];
  return { waybill, lines, sources };
}

export async function validateWaybillDispatch(
  db: Db,
  ctx: WaybillDispatchContext,
  overrideApprovals: WaybillDispatchOverride[] = []
): Promise<void> {
  const { waybill: wb, lines, sources } = ctx;
  if (wb.status !== "draft") {
    throw new Error("Waybill is not in draft state.");
  }
  if (!wb.loadedByName || !wb.transportedByName) {
    throw new Error("Loaded by and transported by signatures are required.");
  }

  const overrideBySourceId = new Map(overrideApprovals.map((entry) => [entry.ctnSourceId, entry]));
  const errors: string[] = [];

  for (const line of lines) {
    const lineSources = sources.filter((source) => source.waybillLineId === line.id);
    if (lineSources.length === 0) {
      errors.push(`Line ${line.id}: at least one CTN source is required.`);
      continue;
    }
    const lineQty = Number(line.nbOfUnits);
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
      if (ctn.itemId !== line.itemId) {
        errors.push(`Line ${line.id}: CTN ${source.ctnId} item does not match selected line item.`);
      }
      const stockCardId = await resolveStockCardAtWarehouse(db, source.ctnId, wb.warehouseId);
      const balance = await stockCardNet(db, stockCardId);
      if (balance < Number(source.quantity)) {
        errors.push(
          `Line ${line.id}: CTN ${source.ctnId} balance ${balance} is below requested ${source.quantity}.`
        );
      }
      const isExpired = ctn.expiryDate ? new Date(ctn.expiryDate).getTime() < Date.now() : false;
      if (isExpired) {
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

export async function dispatchWaybillLedger(
  db: Db,
  ctx: WaybillDispatchContext,
  params: {
    createdBy: number;
    overrideApprovals?: WaybillDispatchOverride[];
  }
): Promise<{ lineItemIds: number[] }> {
  const { waybill: wb, lines, sources } = ctx;
  const overrideBySourceId = new Map((params.overrideApprovals ?? []).map((entry) => [entry.ctnSourceId, entry]));
  const today = new Date().toISOString().slice(0, 10);

  for (const source of sources) {
    const line = lines.find((l) => l.id === source.waybillLineId);
    if (!line) continue;
    const stockCardId = await resolveStockCardAtWarehouse(db, source.ctnId, wb.warehouseId);
    const prev = await stockCardNet(db, stockCardId);
    const next = prev - Number(source.quantity);
    const override = overrideBySourceId.get(source.id);
    await db.insert(stockMovements).values({
      stockCardId,
      date: today,
      documentRef: wb.wbNumber,
      fromTo: wb.destinationBeneficiary,
      quantityIn: 0,
      quantityOut: Number(source.quantity),
      balanceAfter: next,
      remarks: line.remarks ?? wb.comments ?? null,
      sourceType: "waybill",
      createdBy: params.createdBy,
    });
    if (override) {
      await db
        .update(waybillLineCtnSources)
        .set({
          overrideByUserId: override.overrideByUserId,
          overrideAt: new Date(),
          overrideReason: override.overrideReason,
        })
        .where(eq(waybillLineCtnSources.id, source.id));
    }
  }

  await db.update(waybills).set({ status: "dispatched", updatedAt: new Date() }).where(eq(waybills.id, wb.id));

  const lineItemIds = Array.from(new Set(lines.map((line) => line.itemId)));
  return { lineItemIds };
}
