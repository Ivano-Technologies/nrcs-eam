/**
 * Relational transfer note DTO mapping and write helpers (Phase 4c).
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  commodityTrackingNumbers,
  inventoryCatalogue,
  inventoryDocuments,
  transferNoteLineCtnSources,
  transferNoteLines,
  transferNotes,
  type TransferNote,
  type TransferNoteLine,
  type TransferNoteLineCtnSource,
} from "../../drizzle/schema";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export type TransferSource = "relational" | "legacy";

export type TransferListRow = {
  id: number;
  source: TransferSource;
  documentNumber: string;
  status: string;
  fromWarehouseId: number | null;
  toWarehouseId: number | null;
  referenceDocument: string | null;
  notes: string | null;
  createdAt: Date | null;
  lineCount: number;
};

export type TransferLineDto = {
  id: number;
  catalogueId: number;
  quantity: number;
  lineOrder: number;
  itemCode?: string | null;
  itemName?: string | null;
  ctnSources: Array<{
    id?: number;
    ctnId: number;
    ctnCode?: string | null;
    quantity: number;
    expiryDate?: string | null;
    overrideReason?: string | null;
  }>;
};

export type TransferDetailDto = {
  id: number;
  source: TransferSource;
  documentNumber: string;
  status: string;
  fromWarehouseId: number;
  toWarehouseId: number;
  referenceDocument: string | null;
  notes: string | null;
  transportDetails: Record<string, unknown> | null;
  createdAt: Date | null;
  approvedAt: Date | null;
  dispatchedAt: Date | null;
  completedAt: Date | null;
  lines: TransferLineDto[];
};

export type TransferLineInput = {
  catalogueId: number;
  quantity: number;
};

export function mapLegacyTransferToListRow(doc: typeof inventoryDocuments.$inferSelect): TransferListRow {
  const items = Array.isArray(doc.items) ? doc.items : [];
  return {
    id: doc.id,
    source: "legacy",
    documentNumber: doc.documentNumber,
    status: doc.status ?? "pending_approval",
    fromWarehouseId: doc.fromWarehouseId,
    toWarehouseId: doc.toWarehouseId,
    referenceDocument: doc.referenceDocument,
    notes: doc.notes,
    createdAt: doc.createdAt ?? null,
    lineCount: items.length,
  };
}

export function mapRelationalTransferToListRow(
  note: TransferNote,
  lineCount: number
): TransferListRow {
  return {
    id: note.id,
    source: "relational",
    documentNumber: note.tnNumber,
    status: note.status,
    fromWarehouseId: note.fromWarehouseId,
    toWarehouseId: note.toWarehouseId,
    referenceDocument: note.referenceDocument,
    notes: note.notes,
    createdAt: note.createdAt ?? null,
    lineCount,
  };
}

export async function insertTransferWithLines(
  db: Db,
  params: {
    tnNumber: string;
    fromWarehouseId: number;
    toWarehouseId: number;
    referenceDocument?: string | null;
    transportDetails?: Record<string, unknown> | null;
    notes?: string | null;
    createdBy: number;
    items: TransferLineInput[];
  }
): Promise<TransferNote> {
  const [note] = await db
    .insert(transferNotes)
    .values({
      tnNumber: params.tnNumber,
      fromWarehouseId: params.fromWarehouseId,
      toWarehouseId: params.toWarehouseId,
      referenceDocument: params.referenceDocument ?? null,
      transportDetails: params.transportDetails ?? null,
      notes: params.notes ?? null,
      status: "pending_approval",
      createdBy: params.createdBy,
    })
    .returning();

  if (params.items.length > 0) {
    await db.insert(transferNoteLines).values(
      params.items.map((item, index) => ({
        transferNoteId: note.id,
        catalogueId: item.catalogueId,
        quantity: item.quantity,
        lineOrder: index,
      }))
    );
  }

  return note;
}

export async function loadRelationalTransferLines(
  db: Db,
  transferNoteId: number
): Promise<TransferNoteLine[]> {
  return db
    .select()
    .from(transferNoteLines)
    .where(eq(transferNoteLines.transferNoteId, transferNoteId))
    .orderBy(asc(transferNoteLines.lineOrder));
}

export async function loadRelationalTransferCtnSources(
  db: Db,
  lineIds: number[]
): Promise<TransferNoteLineCtnSource[]> {
  if (lineIds.length === 0) return [];
  return db
    .select()
    .from(transferNoteLineCtnSources)
    .where(inArray(transferNoteLineCtnSources.transferNoteLineId, lineIds))
    .orderBy(asc(transferNoteLineCtnSources.sourceOrder));
}

export async function mapRelationalTransferToDetail(
  db: Db,
  note: TransferNote,
  lines: TransferNoteLine[],
  sources: TransferNoteLineCtnSource[]
): Promise<TransferDetailDto> {
  const catalogueIds = Array.from(new Set(lines.map((line) => line.catalogueId)));
  const catalogueRows =
    catalogueIds.length > 0
      ? await db
          .select({
            id: inventoryCatalogue.id,
            itemCode: inventoryCatalogue.itemCode,
            name: inventoryCatalogue.name,
          })
          .from(inventoryCatalogue)
          .where(inArray(inventoryCatalogue.id, catalogueIds))
      : [];
  const catalogueById = new Map(catalogueRows.map((row) => [row.id, row]));

  const ctnIds = Array.from(new Set(sources.map((source) => source.ctnId)));
  const ctnRows =
    ctnIds.length > 0
      ? await db
          .select({
            id: commodityTrackingNumbers.id,
            ctnCode: commodityTrackingNumbers.ctnCode,
            expiryDate: commodityTrackingNumbers.expiryDate,
          })
          .from(commodityTrackingNumbers)
          .where(inArray(commodityTrackingNumbers.id, ctnIds))
      : [];
  const ctnById = new Map(ctnRows.map((row) => [row.id, row]));

  return {
    id: note.id,
    source: "relational",
    documentNumber: note.tnNumber,
    status: note.status,
    fromWarehouseId: note.fromWarehouseId,
    toWarehouseId: note.toWarehouseId,
    referenceDocument: note.referenceDocument,
    notes: note.notes,
    transportDetails: (note.transportDetails as Record<string, unknown> | null) ?? null,
    createdAt: note.createdAt ?? null,
    approvedAt: note.approvedAt ?? null,
    dispatchedAt: note.dispatchedAt ?? null,
    completedAt: note.completedAt ?? null,
    lines: lines.map((line) => {
      const cat = catalogueById.get(line.catalogueId);
      const lineSources = sources.filter((source) => source.transferNoteLineId === line.id);
      return {
        id: line.id,
        catalogueId: line.catalogueId,
        quantity: Number(line.quantity),
        lineOrder: line.lineOrder,
        itemCode: cat?.itemCode ?? null,
        itemName: cat?.name ?? null,
        ctnSources: lineSources.map((source) => {
          const ctn = ctnById.get(source.ctnId);
          return {
            id: source.id,
            ctnId: source.ctnId,
            ctnCode: ctn?.ctnCode ?? null,
            quantity: Number(source.quantity),
            expiryDate: ctn?.expiryDate ? String(ctn.expiryDate).slice(0, 10) : null,
            overrideReason: source.overrideReason,
          };
        }),
      };
    }),
  };
}

export async function resolveRelationalTransfer(
  db: Db,
  transferId: number
): Promise<TransferNote | null> {
  const [note] = await db.select().from(transferNotes).where(eq(transferNotes.id, transferId)).limit(1);
  return note ?? null;
}

export async function resolveLegacyTransfer(
  db: Db,
  documentId: number
): Promise<typeof inventoryDocuments.$inferSelect | null> {
  const [doc] = await db
    .select()
    .from(inventoryDocuments)
    .where(and(eq(inventoryDocuments.id, documentId), eq(inventoryDocuments.documentType, "transfer_note")))
    .limit(1);
  return doc ?? null;
}
