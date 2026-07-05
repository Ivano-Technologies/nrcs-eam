import { and, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import {
  commodityTrackingNumbers,
  donors,
  goodsReceivedNotes,
  inventoryCatalogue,
  stockCards,
  stockMovements,
  waybills,
} from "../../drizzle/schema";
import { getDb } from "../db";

export type DonorStatementLine = {
  catalogueId: number;
  itemCode: string;
  itemName: string;
  openingBalance: number;
  received: number;
  distributed: number;
  losses: number;
  closingBalance: number;
  receivedRefs: Array<{ ref: string; date: string; qty: number }>;
  distributedRefs: Array<{ ref: string; date: string; qty: number; destination: string | null }>;
};

export type DonorStatementResult = {
  donorId: number;
  donorName: string;
  donorCode: string;
  periodFrom: string;
  periodTo: string;
  lines: DonorStatementLine[];
  documents: Array<{ type: string; number: string; date: string }>;
  reconciled: boolean;
  discrepancies: string[];
};

export async function buildDonorStatement(opts: {
  donorId: number;
  from?: string;
  to?: string;
}): Promise<DonorStatementResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [donor] = await db.select().from(donors).where(eq(donors.id, opts.donorId)).limit(1);
  if (!donor) throw new Error("Donor not found");

  const periodFrom = opts.from ?? "1970-01-01";
  const periodTo = opts.to ?? new Date().toISOString().slice(0, 10);

  const ctns = await db
    .select({ id: commodityTrackingNumbers.id })
    .from(commodityTrackingNumbers)
    .where(eq(commodityTrackingNumbers.donorId, opts.donorId));
  const ctnIds = ctns.map((c) => c.id);
  if (ctnIds.length === 0) {
    return {
      donorId: donor.id,
      donorName: donor.name,
      donorCode: donor.code,
      periodFrom,
      periodTo,
      lines: [],
      documents: [],
      reconciled: true,
      discrepancies: [],
    };
  }

  const cards = await db
    .select({
      stockCardId: stockCards.id,
      catalogueId: commodityTrackingNumbers.itemId,
      itemCode: inventoryCatalogue.itemCode,
      itemName: inventoryCatalogue.name,
    })
    .from(stockCards)
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
    .where(inArray(commodityTrackingNumbers.id, ctnIds));

  const cardIds = cards.map((c) => c.stockCardId);
  const movements =
    cardIds.length > 0
      ? await db
          .select()
          .from(stockMovements)
          .where(inArray(stockMovements.stockCardId, cardIds))
          .orderBy(stockMovements.date)
      : [];

  const lineMap = new Map<number, DonorStatementLine>();
  for (const card of cards) {
    if (!lineMap.has(card.catalogueId)) {
      lineMap.set(card.catalogueId, {
        catalogueId: card.catalogueId,
        itemCode: card.itemCode,
        itemName: card.itemName,
        openingBalance: 0,
        received: 0,
        distributed: 0,
        losses: 0,
        closingBalance: 0,
        receivedRefs: [],
        distributedRefs: [],
      });
    }
  }

  const cardToCatalogue = new Map(cards.map((c) => [c.stockCardId, c.catalogueId]));

  for (const mv of movements) {
    const catId = cardToCatalogue.get(mv.stockCardId);
    if (catId == null) continue;
    const line = lineMap.get(catId)!;
    const inQ = Number(mv.quantityIn ?? 0);
    const outQ = Number(mv.quantityOut ?? 0);
    const beforePeriod = mv.date < periodFrom;
    const inPeriod = mv.date >= periodFrom && mv.date <= periodTo;

    if (beforePeriod) {
      line.openingBalance += inQ - outQ;
    }
    if (inPeriod) {
      if (mv.sourceType === "grn" && inQ > 0) {
        line.received += inQ;
        line.receivedRefs.push({ ref: mv.documentRef ?? "GRN", date: mv.date, qty: inQ });
      } else if (mv.sourceType === "waybill" && outQ > 0) {
        line.distributed += outQ;
        line.distributedRefs.push({
          ref: mv.documentRef ?? "WAYBILL",
          date: mv.date,
          qty: outQ,
          destination: mv.fromTo,
        });
      } else if ((mv.sourceType === "expiry" || mv.sourceType === "adjustment") && outQ > 0) {
        line.losses += outQ;
      }
    }
    if (mv.date <= periodTo) {
      line.closingBalance += inQ - outQ;
    }
  }

  const lines = Array.from(lineMap.values());
  const discrepancies: string[] = [];
  for (const line of lines) {
    const computed = line.openingBalance + line.received - line.distributed - line.losses;
    const diff = Math.abs(computed - line.closingBalance);
    if (diff > 0.01) {
      discrepancies.push(
        `${line.itemName}: opening ${line.openingBalance} + received ${line.received} - distributed ${line.distributed} - losses ${line.losses} = ${computed}, ledger closing ${line.closingBalance}`
      );
    }
  }

  const grnDocs = await db
    .select({ number: goodsReceivedNotes.grnNumber, date: goodsReceivedNotes.dateOfArrival })
    .from(goodsReceivedNotes)
    .where(and(gte(goodsReceivedNotes.dateOfArrival, periodFrom), lte(goodsReceivedNotes.dateOfArrival, periodTo)))
    .limit(50);
  const wbDocs = await db
    .select({ number: waybills.wbNumber, date: waybills.date })
    .from(waybills)
    .where(and(gte(waybills.date, periodFrom), lte(waybills.date, periodTo)))
    .limit(50);

  const documents = [
    ...grnDocs.map((d) => ({ type: "GRN", number: d.number, date: String(d.date) })),
    ...wbDocs.map((d) => ({ type: "Waybill", number: d.number, date: String(d.date) })),
  ];

  return {
    donorId: donor.id,
    donorName: donor.name,
    donorCode: donor.code,
    periodFrom,
    periodTo,
    lines,
    documents,
    reconciled: discrepancies.length === 0,
    discrepancies,
  };
}
