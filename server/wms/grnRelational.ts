/**
 * Relational GRN DTO mapping and write helpers (Phase 4b).
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  commodityTrackingNumbers,
  goodsReceivedNoteLines,
  goodsReceivedNotes,
  inventoryCatalogue,
  inventoryDocuments,
  type GoodsReceivedNote,
  type GoodsReceivedNoteLine,
} from "../../drizzle/schema";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export type GrnSource = "relational" | "legacy";

export type GrnListRow = {
  id: number;
  source: GrnSource;
  documentNumber: string;
  status: string;
  referenceDocument: string | null;
  toWarehouseId: number | null;
  createdAt: Date | null;
  dateOfArrival: string | null;
  items: unknown[];
  lineCount: number;
  copiesPrinted?: Record<string, string | null>;
};

export type GrnDetailDto = {
  id: number;
  source: GrnSource;
  documentNumber: string;
  status: string;
  toWarehouseId: number | null;
  referenceDocument: string | null;
  notes: string | null;
  createdAt: Date | null;
  copiesPrinted: Record<string, string | null>;
  items: Array<Record<string, unknown>>;
  transportDetails: Record<string, unknown>;
};

export type GrnDraftLineInput = {
  catalogueId: number;
  quantity: number;
  ctnId: number;
  consignmentNumber?: string;
  description?: string;
  unitType?: string;
  weightKg?: number;
  receivedInGoodCondition?: boolean;
  claimNotes?: string;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
};

export type GrnDraftHeaderInput = {
  grnNumber: string;
  countryCode?: string;
  delegationLocationId: number;
  receivedFrom: string;
  dateOfArrival: string;
  documentWellReceived?: boolean;
  incompleteDocumentsNotes?: string;
  meansOfTransport?: "road" | "rail" | "air" | "sea" | "handcarried";
  awbNumber?: string;
  waybillCmrNumber?: string;
  blNumber?: string;
  flightNumber?: string;
  registrationNumber?: string;
  vesselName?: string;
  comments?: string;
  deliveredByName?: string;
  deliveredByFunction?: string;
  deliveredByDate?: string;
  deliveredBySignature?: string;
  receivedByName?: string;
  receivedByFunction?: string;
  receivedByDate?: string;
  receivedBySignature?: string;
  items: GrnDraftLineInput[];
};

function legacyStatusToUi(status: string | null): string {
  if (status === "completed") return "finalized";
  return status ?? "draft";
}

export function mapLegacyInventoryDocToListRow(doc: typeof inventoryDocuments.$inferSelect): GrnListRow {
  const items = Array.isArray(doc.items) ? doc.items : [];
  const td = (doc.transportDetails ?? {}) as Record<string, unknown>;
  return {
    id: doc.id,
    source: "legacy",
    documentNumber: doc.documentNumber,
    status: legacyStatusToUi(doc.status),
    referenceDocument: doc.referenceDocument,
    toWarehouseId: doc.toWarehouseId,
    createdAt: doc.createdAt ?? null,
    dateOfArrival: td.dateOfArrival ? String(td.dateOfArrival).slice(0, 10) : null,
    items,
    lineCount: items.length,
    copiesPrinted: (doc.copiesPrinted as Record<string, string | null> | undefined) ?? {},
  };
}

export function mapRelationalGrnToListRow(
  grn: GoodsReceivedNote,
  lineCount: number
): GrnListRow {
  return {
    id: grn.id,
    source: "relational",
    documentNumber: grn.grnNumber,
    status: grn.status,
    referenceDocument: grn.receivedFrom,
    toWarehouseId: grn.delegationLocationId,
    createdAt: grn.createdAt ?? null,
    dateOfArrival: grn.dateOfArrival ? String(grn.dateOfArrival).slice(0, 10) : null,
    items: [],
    lineCount,
    copiesPrinted: grn.copiesPrinted ?? {},
  };
}

function relationalLineToItem(line: GoodsReceivedNoteLine, catalogueId?: number): Record<string, unknown> {
  return {
    catalogueId: catalogueId ?? null,
    ctnId: line.ctnId,
    quantity: line.nbOfUnits,
    nbOfUnits: line.nbOfUnits,
    consignmentNumber: line.consignmentNumber,
    description: line.description,
    unitType: line.unitType,
    weightKg: line.weightKg,
    receivedInGoodCondition: line.receivedInGoodCondition,
    claimNotes: line.claimNotes,
    notes: line.claimNotes,
  };
}

export function mapRelationalGrnToDetail(
  grn: GoodsReceivedNote,
  lines: GoodsReceivedNoteLine[],
  ctnCatalogueByCtnId: Map<number, number>
): GrnDetailDto {
  return {
    id: grn.id,
    source: "relational",
    documentNumber: grn.grnNumber,
    status: grn.status === "finalized" ? "finalized" : grn.status,
    toWarehouseId: grn.delegationLocationId,
    referenceDocument: grn.receivedFrom,
    notes: grn.comments,
    createdAt: grn.createdAt ?? null,
    copiesPrinted: grn.copiesPrinted ?? {},
    items: lines.map((line) =>
      relationalLineToItem(line, line.ctnId != null ? ctnCatalogueByCtnId.get(line.ctnId) : undefined)
    ),
    transportDetails: {
      countryCode: grn.countryCode ?? "NG",
      dateOfArrival: grn.dateOfArrival,
      documentWellReceived: grn.documentWellReceived,
      incompleteDocumentsNotes: grn.incompleteDocumentsNotes,
      meansOfTransport: grn.meansOfTransport,
      awbNumber: grn.awbNumber,
      waybillCmrNumber: grn.waybillCmrNumber,
      blNumber: grn.blNumber,
      flightNumber: grn.flightNumber,
      registrationNumber: grn.registrationNumber,
      vesselName: grn.vesselName,
      comments: grn.comments,
      deliveredByName: grn.deliveredByName,
      deliveredByFunction: grn.deliveredByFunction,
      deliveredByDate: grn.deliveredByDate,
      deliveredBySignature: grn.deliveredBySignatureUrl,
      receivedByName: grn.receivedByName,
      receivedByFunction: grn.receivedByFunction,
      receivedByDate: grn.receivedByDate,
      receivedBySignature: grn.receivedBySignatureUrl,
    },
  };
}

export function mapLegacyDocToDetail(doc: typeof inventoryDocuments.$inferSelect): GrnDetailDto {
  const items = Array.isArray(doc.items) ? doc.items : [];
  const td = (doc.transportDetails ?? {}) as Record<string, unknown>;
  return {
    id: doc.id,
    source: "legacy",
    documentNumber: doc.documentNumber,
    status: legacyStatusToUi(doc.status),
    toWarehouseId: doc.toWarehouseId,
    referenceDocument: doc.referenceDocument,
    notes: doc.notes,
    createdAt: doc.createdAt ?? null,
    copiesPrinted: (doc.copiesPrinted as Record<string, string | null> | undefined) ?? {},
    items: items as Array<Record<string, unknown>>,
    transportDetails: td,
  };
}

export function grnHeaderValuesFromDraft(input: GrnDraftHeaderInput, createdBy: number, status: GoodsReceivedNote["status"]) {
  return {
    grnNumber: input.grnNumber,
    countryCode: input.countryCode ?? "NG",
    delegationLocationId: input.delegationLocationId,
    receivedFrom: input.receivedFrom,
    dateOfArrival: input.dateOfArrival,
    documentWellReceived: input.documentWellReceived ?? true,
    incompleteDocumentsNotes: input.incompleteDocumentsNotes ?? null,
    meansOfTransport: input.meansOfTransport ?? null,
    awbNumber: input.awbNumber ?? null,
    waybillCmrNumber: input.waybillCmrNumber ?? null,
    blNumber: input.blNumber ?? null,
    flightNumber: input.flightNumber ?? null,
    registrationNumber: input.registrationNumber ?? null,
    vesselName: input.vesselName ?? null,
    comments: input.comments ?? null,
    deliveredByName: input.deliveredByName ?? null,
    deliveredByFunction: input.deliveredByFunction ?? null,
    deliveredByDate: input.deliveredByDate || null,
    deliveredBySignatureUrl: input.deliveredBySignature ?? null,
    receivedByName: input.receivedByName ?? null,
    receivedByFunction: input.receivedByFunction ?? null,
    receivedByDate: input.receivedByDate || null,
    receivedBySignatureUrl: input.receivedBySignature ?? null,
    status,
    createdBy,
    updatedAt: new Date(),
  };
}

export async function resolveGrnLineRows(
  db: Db,
  items: GrnDraftLineInput[]
): Promise<Array<Omit<typeof goodsReceivedNoteLines.$inferInsert, "grnId">>> {
  const catalogueIds = Array.from(new Set(items.map((item) => item.catalogueId)));
  const ctnIds = Array.from(new Set(items.map((item) => item.ctnId)));

  const catalogueRows =
    catalogueIds.length > 0
      ? await db
          .select({ id: inventoryCatalogue.id, name: inventoryCatalogue.name, unitOfMeasure: inventoryCatalogue.unitOfMeasure })
          .from(inventoryCatalogue)
          .where(inArray(inventoryCatalogue.id, catalogueIds))
      : [];
  const catalogueById = new Map(catalogueRows.map((row) => [row.id, row]));

  const ctnRows =
    ctnIds.length > 0
      ? await db
          .select({ id: commodityTrackingNumbers.id, unit: commodityTrackingNumbers.unit })
          .from(commodityTrackingNumbers)
          .where(inArray(commodityTrackingNumbers.id, ctnIds))
      : [];
  const ctnById = new Map(ctnRows.map((row) => [row.id, row]));

  return items.map((item, index) => {
    const cat = catalogueById.get(item.catalogueId);
    const ctn = ctnById.get(item.ctnId);
    return {
      consignmentNumber: item.consignmentNumber ?? null,
      description: item.description?.trim() || cat?.name || "Item",
      ctnId: item.ctnId,
      nbOfUnits: item.quantity,
      unitType: item.unitType || ctn?.unit || cat?.unitOfMeasure || "pieces",
      weightKg: item.weightKg ?? null,
      receivedInGoodCondition: item.receivedInGoodCondition ?? true,
      claimNotes: item.claimNotes ?? item.notes ?? null,
      lineOrder: index,
    };
  });
}

export async function insertGrnWithLines(
  db: Db,
  header: typeof goodsReceivedNotes.$inferInsert,
  items: GrnDraftLineInput[]
): Promise<GoodsReceivedNote> {
  const [grn] = await db.insert(goodsReceivedNotes).values(header).returning();
  if (!grn) throw new Error("Failed to create GRN");
  const lineRows = await resolveGrnLineRows(db, items);
  if (lineRows.length > 0) {
    await db.insert(goodsReceivedNoteLines).values(lineRows.map((line) => ({ ...line, grnId: grn.id })));
  }
  return grn;
}

export async function replaceGrnLines(db: Db, grnId: number, items: GrnDraftLineInput[]): Promise<void> {
  await db.delete(goodsReceivedNoteLines).where(eq(goodsReceivedNoteLines.grnId, grnId));
  const lineRows = await resolveGrnLineRows(db, items);
  if (lineRows.length > 0) {
    await db.insert(goodsReceivedNoteLines).values(lineRows.map((line) => ({ ...line, grnId })));
  }
}

export async function loadRelationalGrnDetail(db: Db, grnId: number): Promise<GrnDetailDto | null> {
  const [grn] = await db.select().from(goodsReceivedNotes).where(eq(goodsReceivedNotes.id, grnId)).limit(1);
  if (!grn) return null;
  const lines = await db
    .select()
    .from(goodsReceivedNoteLines)
    .where(eq(goodsReceivedNoteLines.grnId, grnId))
    .orderBy(asc(goodsReceivedNoteLines.lineOrder));
  const ctnIds = lines.map((line) => line.ctnId).filter((id): id is number => id != null);
  const ctnRows =
    ctnIds.length > 0
      ? await db
          .select({ id: commodityTrackingNumbers.id, itemId: commodityTrackingNumbers.itemId })
          .from(commodityTrackingNumbers)
          .where(inArray(commodityTrackingNumbers.id, ctnIds))
      : [];
  const ctnCatalogueByCtnId = new Map(ctnRows.map((row) => [row.id, row.itemId]));
  return mapRelationalGrnToDetail(grn, lines, ctnCatalogueByCtnId);
}

export async function resolveGrnById(
  db: Db,
  id: number,
  source?: GrnSource
): Promise<GrnDetailDto | null> {
  if (source === "legacy") {
    const [doc] = await db
      .select()
      .from(inventoryDocuments)
      .where(and(eq(inventoryDocuments.id, id), eq(inventoryDocuments.documentType, "grn")))
      .limit(1);
    return doc ? mapLegacyDocToDetail(doc) : null;
  }
  if (source === "relational") {
    return loadRelationalGrnDetail(db, id);
  }
  const relational = await loadRelationalGrnDetail(db, id);
  if (relational) return relational;
  const [doc] = await db
    .select()
    .from(inventoryDocuments)
    .where(and(eq(inventoryDocuments.id, id), eq(inventoryDocuments.documentType, "grn")))
    .limit(1);
  return doc ? mapLegacyDocToDetail(doc) : null;
}

export function mapLegacyStatusFilter(uiStatus: "draft" | "pending_approval" | "finalized" | "claim_raised"): string {
  if (uiStatus === "finalized") return "completed";
  return uiStatus;
}

export function mapUiStatusToRelational(
  uiStatus: "draft" | "pending_approval" | "finalized" | "claim_raised"
): GoodsReceivedNote["status"] {
  return uiStatus;
}
