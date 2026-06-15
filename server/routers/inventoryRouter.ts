import ExcelJS from "exceljs";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  commodityTrackingNumbers,
  donors,
  binCards,
  distributions,
  goodsReceivedNoteLines,
  goodsReceivedNotes,
  inventoryKits,
  kitAssemblies,
  kitCtnContributors,
  requisitions,
  inventoryCountLines,
  inventoryCounts,
  inventoryBatches,
  inventoryCatalogue,
  inventoryDocuments,
  inventoryImportDrafts,
  stockSettings,
  stockCards,
  stockMovements,
  sites,
  transferNoteLineCtnSources,
  transferNoteLines,
  transferNotes,
  users,
  waybillLineCtnSources,
  waybillLines,
  waybills,
} from "../../drizzle/schema";
import { getDb, getAllUsers, createNotification, getUserById } from "../db";
import { AUDIT_ACTIONS, logAuditEvent } from "../_core/auditHelper";
import { protectedProcedure, requireRole, router } from "../_core/trpc";
import {
  enforceFacilityScope,
  assertFacilityAccess,
  assertRecordFacilityAccess,
} from "../_core/facilityAccess";
import { checkStockThreshold } from "../_core/inventoryAlerts";
import {
  IFRC_CATALOGUE_SEED,
  INVENTORY_CATEGORIES,
  INVENTORY_VED_VALUES,
  type InventoryCatalogueSeedItem,
} from "../../shared/inventoryCatalogueSeed";
import { itemCategoryZod, type ItemCategory } from "../../shared/itemCategory";
import { listPaginationInput, resolveListLimit, resolveListOffset } from "../../shared/listPagination";
import { generateGrnPdf } from "../_core/pdfTemplates/grnPdf";
import { generateWaybillPdf } from "../_core/pdfTemplates/waybillPdf";
import { generateRequisitionPdf } from "../_core/pdfTemplates/requisitionPdf";
import { generateDistributionReportPdf } from "../_core/pdfTemplates/distributionReport";
import { createEmailService } from "../_core/createEmailService";
import { generateExcelReport, generatePDFReport } from "../reportGenerator";
import {
  assertCtnMatchesCatalogue,
  ensureStockCardForCtnAtLocation,
  finalizeGrnLedger,
  insertGrnReceiptMovement,
  loadGrnFinalizeContext,
  validateGrnFinalize,
  type GrnLedgerDb,
} from "../wms/grnStockLedger";
import {
  grnHeaderValuesFromDraft,
  insertGrnWithLines,
  mapLegacyInventoryDocToListRow,
  mapLegacyStatusFilter,
  mapRelationalGrnToListRow,
  replaceGrnLines,
  resolveGrnById,
  type GrnDraftHeaderInput,
  type GrnSource,
} from "../wms/grnRelational";
import { pickFefoCtnSources, loadFefoCandidates, allocateFefoFromCandidates } from "../wms/ctnAllocation";
import {
  dispatchWaybillLedger,
  loadWaybillDispatchContext,
  validateWaybillDispatch,
} from "../wms/waybillStockLedger";
import {
  dispatchTransferLedger,
  loadTransferDispatchContext,
  receiveTransferLedger,
  validateTransferDispatch,
  validateTransferReceive,
  type TransferDispatchOverride,
} from "../wms/transferStockLedger";
import {
  insertTransferWithLines,
  loadRelationalTransferCtnSources,
  loadRelationalTransferLines,
  mapLegacyTransferToListRow,
  mapRelationalTransferToDetail,
  mapRelationalTransferToListRow,
  resolveLegacyTransfer,
  resolveRelationalTransfer,
} from "../wms/transferRelational";
import { expandKitDonorContribution } from "../wms/kitDonorContribution";
import {
  buildRetroactiveStockCheckRemark,
  computeStockCheckMovement,
  getStockCardDetail,
  listStockCards,
  requiresSupervisorForRetroactiveEntry,
} from "../wms/stockCard";
import { assertBinCardLifecycleTransition, getBinCardDetail, listBinCards } from "../wms/binCard";
import { buildTemplateWorkbook, parseExcelRows, parseTypedPdfText, type ImportDocumentType } from "../wms/importPipeline";
import { buildHistoricalStockMovement } from "../wms/historicalImport";
import {
  buildMonthlyWarehouseReport,
  monthlyReportColumns,
  monthlyReportHeader,
} from "../wms/monthlyWarehouseReport";

const vedEnum = z.enum(INVENTORY_VED_VALUES);
const categoryEnum = z.enum(INVENTORY_CATEGORIES);

async function sendRequisitionStatusEmailToSubmitter(opts: {
  requisitionId: number;
  statusRaw: string;
  approver: { name: string | null; email: string | null };
}) {
  const database = await getDb();
  if (!database) return;
  const { requisitionStatusEmail, formatRequisitionStatusLabel, requisitionDetailLink } = await import(
    "../notifications/emailTemplates"
  );
  const { createEmailService } = await import("../_core/createEmailService");
  const [req] = await database.select().from(requisitions).where(eq(requisitions.id, opts.requisitionId)).limit(1);
  if (!req) return;
  const submitter = await getUserById(req.requestedBy);
  const to = submitter?.email?.trim();
  if (!to) return;

  const rawItems = Array.isArray(req.items)
    ? (req.items as Array<{ catalogueId: number; quantity: number; notes?: string }>)
    : [];
  const itemLines = rawItems.map(
    (it) =>
      `Catalogue item #${it.catalogueId} — quantity ${it.quantity}${it.notes ? ` (${it.notes})` : ""}`
  );

  const approverName = opts.approver.name?.trim() || opts.approver.email?.trim() || "Approver";
  const { subject, html } = requisitionStatusEmail({
    refNumber: req.reqNumber ?? `#${req.id}`,
    status: formatRequisitionStatusLabel(opts.statusRaw),
    items: itemLines,
    approverName,
    link: requisitionDetailLink(req.id),
  });
  await createEmailService().send({ type: "requisition_status", to, subject, html });
}

const stockStatusEnum = z.enum(["normal", "low", "critical", "out_of_stock"]);

type StockStatus = z.infer<typeof stockStatusEnum>;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let value = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(value.trim());
      value = "";
      continue;
    }
    value += ch;
  }
  out.push(value.trim());
  return out;
}

function deriveStockStatus(row: {
  quantityOnHand: number;
  minLevel: number;
  safetyStockLevel: number | null;
}): StockStatus {
  if (row.quantityOnHand <= 0) return "out_of_stock";
  if (row.safetyStockLevel != null && row.quantityOnHand < row.safetyStockLevel) return "critical";
  if (row.quantityOnHand < row.minLevel) return "low";
  return "normal";
}

function toMonthKey(value: Date | string | null | undefined): string {
  const d = value ? new Date(value) : new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function validateImportRows(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  rows: Array<{ rowIndex: number; status: "valid" | "warning" | "error"; errors: string[]; data: Record<string, string | number | null> }>
) {
  const facilityCodes = new Set(
    (
      await db
        .select({ code: sites.code })
        .from(sites)
        .where(eq(sites.isActive, true))
    )
      .map((r) => String(r.code ?? "").trim().toUpperCase())
      .filter(Boolean)
  );
  const itemCodes = new Set((await db.select({ code: inventoryCatalogue.itemCode }).from(inventoryCatalogue)).map((r) => String(r.code ?? "").trim().toUpperCase()));
  const donorCodes = new Set((await db.select({ code: donors.code }).from(donors)).map((r) => String(r.code ?? "").trim().toUpperCase()));

  return rows.map((row) => {
    const errors = [...row.errors];
    const fCode = String(row.data.facility_code ?? "").trim().toUpperCase();
    const iCode = String(row.data.item_code ?? "").trim().toUpperCase();
    const dCode = String(row.data.donor_code ?? "").trim().toUpperCase();
    if (fCode && !facilityCodes.has(fCode)) errors.push(`Unknown facility code: ${fCode}`);
    if (iCode && !itemCodes.has(iCode)) errors.push(`Unknown item code: ${iCode}`);
    if (dCode && !donorCodes.has(dCode)) errors.push(`Unknown donor code: ${dCode}`);
    return { ...row, status: errors.length ? "error" : row.status, errors };
  });
}

const inventoryMovementTypeEnum = z.enum([
  "receipt",
  "issue",
  "transfer_out",
  "transfer_in",
  "adjustment",
  "count",
  "loss",
  "distribution",
]);
const inventoryDocumentTypeEnum = z.enum(["grn", "waybill", "transfer_note", "adjustment_note", "loss_report"]);
const inventoryDocumentStatusEnum = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "completed",
  "cancelled",
  "dispatched",
]);

const documentItemSchema = z.object({
  catalogueId: z.number(),
  quantity: z.number().positive(),
  /** When set, GRN approval writes only `stock_movements` (WMS Phase 2+). */
  ctnId: z.number().int().positive().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

const grnDocumentItemSchema = documentItemSchema.extend({
  ctnId: z.number().int().positive(),
  consignmentNumber: z.string().optional(),
  description: z.string().optional(),
  unitType: z.string().optional(),
  weightKg: z.number().optional(),
  receivedInGoodCondition: z.boolean().optional(),
  claimNotes: z.string().optional(),
});

const transferSourceSchema = z.enum(["relational", "legacy"]);
const transferRefSchema = z.object({
  id: z.number(),
  source: transferSourceSchema,
});
const transferLineAllocationSchema = z.object({
  lineId: z.number(),
  sources: z
    .array(
      z.object({
        ctnId: z.number(),
        quantity: z.number().positive(),
      })
    )
    .min(1),
});
const transferExpiredOverrideSchema = z.object({
  lineId: z.number(),
  ctnId: z.number(),
  overrideReason: z.string().min(1),
});

async function legacyTransferDispatch(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  doc: typeof inventoryDocuments.$inferSelect,
  userId: number
) {
  const lines = Array.isArray(doc.items) ? (doc.items as z.infer<typeof documentItemSchema>[]) : [];
  for (const line of lines) {
    await ensureStockSettingsRecord(line.catalogueId, Number(doc.fromWarehouseId));
    await ensureStockSettingsRecord(line.catalogueId, Number(doc.toWarehouseId));
    const sourceOnHand = await itemWarehouseNet(line.catalogueId, Number(doc.fromWarehouseId));
    const sourceStockCardId = await ensureCountStockCardForItemLocation({
      itemId: line.catalogueId,
      locationId: Number(doc.fromWarehouseId),
      expectedBalance: Number(sourceOnHand),
      createdBy: userId,
    });
    const sourceBalance = await stockCardNet(sourceStockCardId);
    if (sourceBalance < Number(line.quantity)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient stock for item ${line.catalogueId}.` });
    }
    await db.insert(stockMovements).values({
      stockCardId: sourceStockCardId,
      date: new Date().toISOString().slice(0, 10),
      documentRef: doc.documentNumber,
      fromTo: `transfer:${doc.toWarehouseId}`,
      quantityIn: 0,
      quantityOut: Math.abs(Number(line.quantity)),
      balanceAfter: sourceBalance - Number(line.quantity),
      remarks: "Transfer dispatch",
      sourceType: "transfer_out",
      createdBy: userId,
    });
    await checkStockThreshold({
      catalogueId: line.catalogueId,
      warehouseId: Number(doc.fromWarehouseId),
      relatedEntityId: doc.id,
    });
  }
  await db.update(inventoryDocuments).set({ status: "dispatched" }).where(eq(inventoryDocuments.id, doc.id));
}

async function legacyTransferReceive(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  doc: typeof inventoryDocuments.$inferSelect,
  userId: number
) {
  const lines = Array.isArray(doc.items) ? (doc.items as z.infer<typeof documentItemSchema>[]) : [];
  for (const line of lines) {
    await ensureStockSettingsRecord(line.catalogueId, Number(doc.toWarehouseId));
    const destOnHand = await itemWarehouseNet(line.catalogueId, Number(doc.toWarehouseId));
    const destinationStockCardId = await ensureCountStockCardForItemLocation({
      itemId: line.catalogueId,
      locationId: Number(doc.toWarehouseId),
      expectedBalance: Number(destOnHand),
      createdBy: userId,
    });
    const destBalance = await stockCardNet(destinationStockCardId);
    await db.insert(stockMovements).values({
      stockCardId: destinationStockCardId,
      date: new Date().toISOString().slice(0, 10),
      documentRef: doc.documentNumber,
      fromTo: `transfer:${doc.fromWarehouseId}`,
      quantityIn: Math.abs(Number(line.quantity)),
      quantityOut: 0,
      balanceAfter: destBalance + Number(line.quantity),
      remarks: "Transfer receive",
      sourceType: "transfer_in",
      createdBy: userId,
    });
    await checkStockThreshold({
      catalogueId: line.catalogueId,
      warehouseId: Number(doc.toWarehouseId),
      relatedEntityId: doc.id,
    });
  }
  await db
    .update(inventoryDocuments)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(inventoryDocuments.id, doc.id));
}

const grnSourceSchema = z.enum(["relational", "legacy"]).optional();

const grnDraftInputSchema = z.object({
  grnNumber: z.string().min(1).max(100),
  countryCode: z.string().max(8).optional(),
  delegationLocationId: z.number(),
  receivedFrom: z.string().min(1).max(500),
  dateOfArrival: z.string(),
  documentWellReceived: z.boolean().default(true),
  incompleteDocumentsNotes: z.string().optional(),
  meansOfTransport: z.enum(["road", "rail", "air", "sea", "handcarried"]).optional(),
  awbNumber: z.string().optional(),
  waybillCmrNumber: z.string().optional(),
  blNumber: z.string().optional(),
  flightNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  vesselName: z.string().optional(),
  comments: z.string().optional(),
  deliveredByName: z.string().optional(),
  deliveredByFunction: z.string().optional(),
  deliveredByDate: z.string().optional(),
  deliveredBySignature: z.string().optional(),
  receivedByName: z.string().optional(),
  receivedByFunction: z.string().optional(),
  receivedByDate: z.string().optional(),
  receivedBySignature: z.string().optional(),
  items: z.array(grnDocumentItemSchema).min(1),
});

const waybillSourceSchema = z.object({
  ctnId: z.number().int().positive(),
  quantity: z.number().positive(),
  overrideByUserId: z.number().int().positive().optional(),
  overrideReason: z.string().optional(),
});

const waybillLineSchema = z.object({
  itemId: z.number().int().positive(),
  itemDescription: z.string().min(1),
  nbOfUnits: z.number().positive(),
  unitType: z.string().min(1).default("pieces"),
  weightKg: z.number().optional(),
  volumeM3: z.number().optional(),
  requisitionLineId: z.string().optional(),
  remarks: z.string().optional(),
  ctnSources: z.array(waybillSourceSchema).min(1),
});

const waybillDraftSchema = z.object({
  wbNumber: z.string().optional(),
  date: z.string(),
  warehouseId: z.number().int().positive(),
  destinationType: z.enum(["beneficiary", "branch_store", "other"]),
  destinationBeneficiary: z.string().min(1),
  destinationLocation: z.string().optional(),
  requisitionId: z.number().int().positive().optional(),
  meansOfTransport: z.enum(["road", "rail", "air", "sea", "handcarried"]).optional(),
  vehicle1: z.string().optional(),
  registration1: z.string().optional(),
  transportedByName: z.string().optional(),
  loadedByName: z.string().optional(),
  loadedByDate: z.string().optional(),
  loadedByFunction: z.string().optional(),
  transportedByDate: z.string().optional(),
  transportedByFunction: z.string().optional(),
  comments: z.string().optional(),
  lines: z.array(waybillLineSchema).min(1),
});

const stockCheckInputSchema = z.object({
  stockCardId: z.number().int().positive(),
  date: z.string(),
  countedQty: z.number().min(0),
  storekeeperId: z.number().int().positive(),
  notes: z.string().optional(),
  supervisorId: z.number().int().positive().optional(),
});

const openingStockRowSchema = z.object({
  warehouseCode: z.string(),
  itemCode: z.string(),
  quantityOnHand: z.number(),
  minLevel: z.number().optional(),
  maxLevel: z.number().nullable().optional(),
  safetyLevel: z.number().nullable().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

const historicalMovementRowSchema = z.object({
  date: z.string(),
  warehouseCode: z.string(),
  itemCode: z.string(),
  movementType: z.enum(["receipt", "issue", "transfer_in", "transfer_out", "adjustment", "loss", "distribution", "count"]),
  quantity: z.number(),
  documentNumber: z.string().optional(),
  notes: z.string().optional(),
});

async function ensureStockSettingsRecord(catalogueId: number, warehouseId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const [existing] = await db
    .select()
    .from(stockSettings)
    .where(and(eq(stockSettings.catalogueId, catalogueId), eq(stockSettings.warehouseId, warehouseId)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(stockSettings).values({ catalogueId, warehouseId, minLevel: 0 }).returning();
  return created;
}

async function nextDocumentNumber(prefix: "GRN" | "WB" | "TN") {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const rows = await db
    .select({ documentNumber: inventoryDocuments.documentNumber })
    .from(inventoryDocuments)
    .where(ilike(inventoryDocuments.documentNumber, like));
  const max = rows.reduce((acc, r) => {
    const tail = Number(r.documentNumber.split("-").at(-1));
    return Number.isFinite(tail) ? Math.max(acc, tail) : acc;
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

async function notifyManagers(title: string, message: string, relatedEntityId?: number) {
  const users = await getAllUsers();
  for (const user of users) {
    if (user.role === "manager" || user.role === "admin") {
      await createNotification({
        userId: user.id,
        type: "system_alert",
        title,
        message,
        relatedEntityType: "inventory",
        relatedEntityId: relatedEntityId ?? null,
      });
    }
  }
}

async function nextCountNumber() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const year = new Date().getFullYear();
  const like = `COUNT-${year}-%`;
  const rows = await db.select({ countNumber: inventoryCounts.countNumber }).from(inventoryCounts).where(ilike(inventoryCounts.countNumber, like));
  const max = rows.reduce((acc, r) => {
    const tail = Number(r.countNumber.split("-").at(-1));
    return Number.isFinite(tail) ? Math.max(acc, tail) : acc;
  }, 0);
  return `COUNT-${year}-${String(max + 1).padStart(4, "0")}`;
}

async function nextRequisitionNumber() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const year = new Date().getFullYear();
  const like = `REQ-${year}-%`;
  const rows = await db.select({ reqNumber: requisitions.reqNumber }).from(requisitions).where(ilike(requisitions.reqNumber, like));
  const max = rows.reduce((acc, r) => {
    const tail = Number(r.reqNumber.split("-").at(-1));
    return Number.isFinite(tail) ? Math.max(acc, tail) : acc;
  }, 0);
  return `REQ-${year}-${String(max + 1).padStart(4, "0")}`;
}

async function nextDistributionNumber() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const year = new Date().getFullYear();
  const like = `DIST-${year}-%`;
  const rows = await db
    .select({ distributionNumber: distributions.distributionNumber })
    .from(distributions)
    .where(ilike(distributions.distributionNumber, like));
  const max = rows.reduce((acc, r) => {
    const tail = Number(r.distributionNumber.split("-").at(-1));
    return Number.isFinite(tail) ? Math.max(acc, tail) : acc;
  }, 0);
  return `DIST-${year}-${String(max + 1).padStart(4, "0")}`;
}

async function nextWaybillNumber(warehouseId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const [warehouse] = await db.select({ code: sites.code }).from(sites).where(eq(sites.id, warehouseId)).limit(1);
  const facilityCode = (warehouse?.code || "UNK").toUpperCase();
  const year = new Date().getFullYear();
  const prefix = `NRCS-${facilityCode}-${year}-WB-`;
  const like = `${prefix}%`;
  const rows = await db.select({ wbNumber: waybills.wbNumber }).from(waybills).where(ilike(waybills.wbNumber, like));
  const max = rows.reduce((acc, r) => {
    const tail = Number(r.wbNumber.split("-").at(-1));
    return Number.isFinite(tail) ? Math.max(acc, tail) : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

async function ensureStockCard(ctnId: number, warehouseId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const [card] = await db
    .select({ id: stockCards.id })
    .from(stockCards)
    .where(and(eq(stockCards.ctnId, ctnId), eq(stockCards.locationId, warehouseId)))
    .limit(1);
  if (!card) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `CTN ${ctnId} is not currently held in source warehouse ${warehouseId}.`,
    });
  }
  return card.id;
}

async function stockCardNet(stockCardId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const [agg] = await db
    .select({
      net: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
    })
    .from(stockMovements)
    .where(eq(stockMovements.stockCardId, stockCardId));
  return Number(agg?.net ?? 0);
}

async function itemWarehouseNet(itemId: number, warehouseId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const [agg] = await db
    .select({
      net: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
    })
    .from(stockMovements)
    .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .where(and(eq(commodityTrackingNumbers.itemId, itemId), eq(stockCards.locationId, warehouseId)));
  return Number(agg?.net ?? 0);
}

async function ensureCountStockCardForItemLocation(params: {
  itemId: number;
  locationId: number;
  expectedBalance: number;
  createdBy: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

  const existing = await db
    .select({
      stockCardId: stockCards.id,
    })
    .from(stockCards)
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .where(and(eq(stockCards.locationId, params.locationId), eq(commodityTrackingNumbers.itemId, params.itemId)))
    .orderBy(asc(stockCards.id))
    .limit(1);
  if (existing.length > 0) return existing[0]!.stockCardId;

  const [blendedDonor] = await db.select({ id: donors.id }).from(donors).where(eq(donors.code, "BLENDED")).limit(1);
  if (!blendedDonor) throw new TRPCError({ code: "BAD_REQUEST", message: "BLENDED donor is missing." });
  const [cat] = await db.select().from(inventoryCatalogue).where(eq(inventoryCatalogue.id, params.itemId)).limit(1);
  if (!cat) throw new TRPCError({ code: "NOT_FOUND", message: "Catalogue item not found." });

  const syntheticCtnCode = `LEGACY-${params.itemId}-${params.locationId}-${Date.now().toString().slice(-6)}`;
  const [ctn] = await db
    .insert(commodityTrackingNumbers)
    .values({
      ctnCode: syntheticCtnCode,
      donorId: blendedDonor.id,
      itemId: params.itemId,
      unit: cat.unitOfMeasure || "units",
      originalQuantity: Math.max(0, Number(params.expectedBalance)),
      status: "active",
      notes: "Synthetic opening CTN for stock-count migration",
    })
    .returning();

  const stockCardId = await ensureStockCardForCtnAtLocation(db, { ctnId: ctn.id, locationId: params.locationId });
  const openingBalance = Math.max(0, Number(params.expectedBalance));
  await db.insert(stockMovements).values({
    stockCardId,
    date: new Date().toISOString().slice(0, 10),
    documentRef: "— OPENING BALANCE",
    fromTo: "MIGRATION",
    quantityIn: openingBalance,
    quantityOut: 0,
    balanceAfter: openingBalance,
    remarks: "Auto-created from legacy stock table during count migration (bootstrap)",
    sourceType: "import",
    createdBy: params.createdBy,
  });
  return stockCardId;
}

async function importCatalogueRows(rows: InventoryCatalogueSeedItem[]) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  if (rows.length === 0) return { imported: 0 };
  await db
    .insert(inventoryCatalogue)
    .values(
      rows.map((item) => ({
        itemCode: item.itemCode,
        name: item.name,
        description: item.description ?? null,
        category: item.category,
        itemCategory: "other" as ItemCategory,
        unitOfMeasure: item.unitOfMeasure,
        vedClassification: item.vedClassification,
        hasExpiry: item.hasExpiry ?? false,
        coldChainRequired: item.coldChainRequired ?? false,
        standardSuppliers: [],
        ifrcItemCode: item.itemCode,
      }))
    )
    .onConflictDoNothing({ target: inventoryCatalogue.itemCode });
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(inventoryCatalogue)
    .where(inArray(inventoryCatalogue.itemCode, rows.map((r) => r.itemCode)));
  return { imported: count ?? 0 };
}

export const inventoryV2Router = router({
  catalogue: router({
    list: protectedProcedure
      .input(
        z
          .object({
            category: categoryEnum.optional(),
            ved: vedEnum.optional(),
            search: z.string().optional(),
            active: z.boolean().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const filters = [];
        if (input?.category) filters.push(eq(inventoryCatalogue.category, input.category));
        if (input?.ved) filters.push(eq(inventoryCatalogue.vedClassification, input.ved));
        if (input?.active !== undefined) filters.push(eq(inventoryCatalogue.isActive, input.active));
        if (input?.search?.trim()) {
          const q = `%${input.search.trim()}%`;
          filters.push(
            or(ilike(inventoryCatalogue.name, q), ilike(inventoryCatalogue.itemCode, q), ilike(inventoryCatalogue.description, q))!
          );
        }
        return db
          .select()
          .from(inventoryCatalogue)
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(asc(inventoryCatalogue.category), asc(inventoryCatalogue.name));
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [item] = await db
          .select()
          .from(inventoryCatalogue)
          .where(eq(inventoryCatalogue.id, input.id))
          .limit(1);
        if (!item) return null;
        const stockRows = await db
          .select({
            stockId: sql<number | null>`null`.mapWith((v) => (v == null ? null : Number(v))),
            warehouseId: stockSettings.warehouseId,
            warehouseName: sites.name,
            catalogueId: stockSettings.catalogueId,
            quantityReserved: sql<number>`0`.mapWith(Number),
            quantityInTransit: sql<number>`0`.mapWith(Number),
            minLevel: stockSettings.minLevel,
            maxLevel: stockSettings.maxLevel,
            safetyStockLevel: stockSettings.safetyStockLevel,
            zoneLocation: stockSettings.zoneLocation,
          })
          .from(stockSettings)
          .innerJoin(sites, eq(stockSettings.warehouseId, sites.id))
          .where(eq(stockSettings.catalogueId, input.id))
          .orderBy(asc(sites.name));
        const ledgerRows = await db
          .select({
            warehouseId: stockCards.locationId,
            quantityOnHand: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .where(eq(commodityTrackingNumbers.itemId, input.id))
          .groupBy(stockCards.locationId);
        const ledgerByWarehouse = new Map(ledgerRows.map((row) => [row.warehouseId, Number(row.quantityOnHand ?? 0)]));
        return {
          ...item,
          stock: stockRows.map((row) => ({
            ...row,
            quantityOnHand: Number(ledgerByWarehouse.get(row.warehouseId) ?? 0),
          })),
        };
      }),

    create: protectedProcedure
      .input(
        z.object({
          itemCode: z.string().trim().min(1).max(50),
          name: z.string().trim().min(1).max(255),
          description: z.string().optional(),
          category: categoryEnum,
          itemCategory: itemCategoryZod,
          subcategory: z.string().optional(),
          unitOfMeasure: z.string().trim().min(1).max(50),
          vedClassification: vedEnum.optional(),
          unitWeightKg: z.number().optional(),
          packSize: z.number().int().optional(),
          packUnit: z.string().optional(),
          hasExpiry: z.boolean().optional(),
          coldChainRequired: z.boolean().optional(),
          photoUrl: z.string().optional(),
          ifrcItemCode: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [created] = await db
          .insert(inventoryCatalogue)
          .values({ ...input, standardSuppliers: [] })
          .returning();
        return created;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().trim().min(1).max(255).optional(),
          description: z.string().optional(),
          category: categoryEnum.optional(),
          itemCategory: itemCategoryZod.optional(),
          subcategory: z.string().optional(),
          unitOfMeasure: z.string().trim().min(1).max(50).optional(),
          vedClassification: vedEnum.optional(),
          unitWeightKg: z.number().optional(),
          packSize: z.number().int().optional(),
          packUnit: z.string().optional(),
          hasExpiry: z.boolean().optional(),
          coldChainRequired: z.boolean().optional(),
          photoUrl: z.string().optional(),
          notes: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const { id, ...updates } = input;
        const [updated] = await db
          .update(inventoryCatalogue)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(inventoryCatalogue.id, id))
          .returning();
        return updated ?? null;
      }),

    deactivate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        await db
          .update(inventoryCatalogue)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(inventoryCatalogue.id, input.id));
        return { success: true as const };
      }),

    import: protectedProcedure
      .input(z.object({ csvData: z.string().optional() }).optional())
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["admin"]);
        if (!input?.csvData?.trim()) {
          return importCatalogueRows(IFRC_CATALOGUE_SEED);
        }
        const lines = input.csvData.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (lines.length < 2) return { imported: 0 };
        const headers = parseCsvLine(lines[0]).map((x) => x.toLowerCase());
        const index = (name: string) => headers.indexOf(name);
        const codeIdx = index("itemcode");
        const nameIdx = index("name");
        const categoryIdx = index("category");
        const unitIdx = index("unitofmeasure");
        const vedIdx = index("vedclassification");
        if (codeIdx < 0 || nameIdx < 0 || categoryIdx < 0 || unitIdx < 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "CSV requires itemCode, name, category, unitOfMeasure columns." });
        }
        const parsed: InventoryCatalogueSeedItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          const category = cols[categoryIdx] as (typeof INVENTORY_CATEGORIES)[number];
          if (!INVENTORY_CATEGORIES.includes(category)) continue;
          const vedRaw = (vedIdx >= 0 ? cols[vedIdx] : "essential").toLowerCase() as (typeof INVENTORY_VED_VALUES)[number];
          const vedClassification = INVENTORY_VED_VALUES.includes(vedRaw) ? vedRaw : "essential";
          parsed.push({
            itemCode: cols[codeIdx],
            name: cols[nameIdx],
            category,
            unitOfMeasure: cols[unitIdx],
            vedClassification,
          });
        }
        return importCatalogueRows(parsed);
      }),
  }),

  stock: router({
    overview: protectedProcedure
      .input(
          z
          .object({
            warehouseId: z.number().optional(),
            category: categoryEnum.optional(),
            itemCategory: itemCategoryZod.optional(),
            status: stockStatusEnum.optional(),
            ved: vedEnum.optional(),
            search: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        const scopedWarehouseId = enforceFacilityScope(ctx.user, input?.warehouseId);
        if (scopedWarehouseId === -1) return [];

        const db = await getDb();
        if (!db) return [];

        const warehouses = await db
          .select()
          .from(sites)
          .where(
            and(
              eq(sites.facilityType, "warehouse"),
              scopedWarehouseId != null && scopedWarehouseId > 0
                ? eq(sites.id, scopedWarehouseId)
                : undefined
            )
          )
          .orderBy(asc(sites.name));
        const warehouseParentIds = warehouses
          .map((w) => w.parentFacilityId)
          .filter((id): id is number => id != null);
        const parents = warehouseParentIds.length
          ? await db.select().from(sites).where(inArray(sites.id, warehouseParentIds))
          : [];
        const parentMap = new Map(parents.map((p) => [p.id, p.name]));

        const catalogueFilters = [];
        if (input?.category) catalogueFilters.push(eq(inventoryCatalogue.category, input.category));
        if (input?.itemCategory) catalogueFilters.push(eq(inventoryCatalogue.itemCategory, input.itemCategory));
        if (input?.ved) catalogueFilters.push(eq(inventoryCatalogue.vedClassification, input.ved));
        if (input?.search?.trim()) {
          const q = `%${input.search.trim()}%`;
          catalogueFilters.push(
            or(ilike(inventoryCatalogue.name, q), ilike(inventoryCatalogue.itemCode, q), ilike(inventoryCatalogue.description, q))!
          );
        }
        const catalogueRows = await db
          .select()
          .from(inventoryCatalogue)
          .where(catalogueFilters.length ? and(...catalogueFilters) : undefined)
          .orderBy(asc(inventoryCatalogue.name));

        if (!warehouses.length || !catalogueRows.length) return [];

        const stockRows = await db
          .select()
          .from(stockSettings)
          .where(
            and(
              inArray(stockSettings.catalogueId, catalogueRows.map((c) => c.id)),
              inArray(stockSettings.warehouseId, warehouses.map((w) => w.id))
            )
          );
        const ledgerRows = await db
          .select({
            catalogueId: commodityTrackingNumbers.itemId,
            warehouseId: stockCards.locationId,
            quantityOnHand: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .where(
            and(
              inArray(commodityTrackingNumbers.itemId, catalogueRows.map((c) => c.id)),
              inArray(stockCards.locationId, warehouses.map((w) => w.id))
            )
          )
          .groupBy(commodityTrackingNumbers.itemId, stockCards.locationId);
        const stockMap = new Map(stockRows.map((s) => [`${s.catalogueId}:${s.warehouseId}`, s]));
        const ledgerMap = new Map(ledgerRows.map((l) => [`${l.catalogueId}:${l.warehouseId}`, Number(l.quantityOnHand ?? 0)]));

        const overview = [];
        for (const item of catalogueRows) {
          for (const warehouse of warehouses) {
            const stock = stockMap.get(`${item.id}:${warehouse.id}`);
            const ledgerOnHand = ledgerMap.get(`${item.id}:${warehouse.id}`);
            const quantityOnHand = Number(ledgerOnHand ?? 0);
            const row = {
              catalogueId: item.id,
              itemCode: item.itemCode,
              itemName: item.name,
              category: item.category,
              itemCategory: item.itemCategory,
              vedClassification: item.vedClassification,
              unitOfMeasure: item.unitOfMeasure,
              photoUrl: item.photoUrl,
              warehouseId: warehouse.id,
              warehouseName: warehouse.name,
              parentBranchName: warehouse.parentFacilityId ? (parentMap.get(warehouse.parentFacilityId) ?? null) : null,
              quantityOnHand,
              minLevel: stock?.minLevel ?? 0,
              maxLevel: stock?.maxLevel ?? null,
              safetyStockLevel: stock?.safetyStockLevel ?? null,
              quantityReserved: 0,
              quantityInTransit: 0,
              zoneLocation: stock?.zoneLocation ?? null,
              status: deriveStockStatus({
                quantityOnHand,
                minLevel: stock?.minLevel ?? 0,
                safetyStockLevel: stock?.safetyStockLevel ?? null,
              }),
            };
            if (input?.status && row.status !== input.status) continue;
            overview.push(row);
          }
        }
        return overview;
      }),

    byWarehouse: protectedProcedure
      .input(z.object({ warehouseId: z.number() }))
      .query(async ({ input, ctx }) => {
        assertFacilityAccess(ctx.user, input.warehouseId);
        const db = await getDb();
        if (!db) return [];
        const rows = await db
          .select({
            stockId: sql<number | null>`null`.mapWith((v) => (v == null ? null : Number(v))),
            catalogueId: inventoryCatalogue.id,
            itemCode: inventoryCatalogue.itemCode,
            itemName: inventoryCatalogue.name,
            category: inventoryCatalogue.category,
            itemCategory: inventoryCatalogue.itemCategory,
            vedClassification: inventoryCatalogue.vedClassification,
            unitOfMeasure: inventoryCatalogue.unitOfMeasure,
            minLevel: stockSettings.minLevel,
            maxLevel: stockSettings.maxLevel,
            safetyStockLevel: stockSettings.safetyStockLevel,
            zoneLocation: stockSettings.zoneLocation,
          })
          .from(stockSettings)
          .innerJoin(inventoryCatalogue, eq(stockSettings.catalogueId, inventoryCatalogue.id))
          .where(eq(stockSettings.warehouseId, input.warehouseId))
          .orderBy(asc(inventoryCatalogue.name));
        const ledgerRows = await db
          .select({
            catalogueId: commodityTrackingNumbers.itemId,
            quantityOnHand: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .where(eq(stockCards.locationId, input.warehouseId))
          .groupBy(commodityTrackingNumbers.itemId);
        const ledgerByCatalogue = new Map(ledgerRows.map((row) => [row.catalogueId, Number(row.quantityOnHand ?? 0)]));
        return rows.map((row) => ({
          ...row,
          quantityOnHand: Number(ledgerByCatalogue.get(row.catalogueId) ?? 0),
        }));
      }),

    byItem: protectedProcedure
      .input(z.object({ catalogueId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const cfgRows = await db
          .select({
            stockId: sql<number | null>`null`.mapWith((v) => (v == null ? null : Number(v))),
            warehouseId: sites.id,
            warehouseName: sites.name,
            zoneLocation: stockSettings.zoneLocation,
            minLevel: stockSettings.minLevel,
            maxLevel: stockSettings.maxLevel,
            safetyStockLevel: stockSettings.safetyStockLevel,
          })
          .from(stockSettings)
          .innerJoin(sites, eq(stockSettings.warehouseId, sites.id))
          .where(eq(stockSettings.catalogueId, input.catalogueId))
          .orderBy(asc(sites.name));
        const ledgerRows = await db
          .select({
            warehouseId: stockCards.locationId,
            quantityOnHand: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .where(eq(commodityTrackingNumbers.itemId, input.catalogueId))
          .groupBy(stockCards.locationId);
        const ledgerByWarehouse = new Map(ledgerRows.map((row) => [row.warehouseId, Number(row.quantityOnHand ?? 0)]));
        return cfgRows.map((row) => ({
          ...row,
          quantityOnHand: Number(ledgerByWarehouse.get(row.warehouseId) ?? 0),
        }));
      }),

    updateLevels: protectedProcedure
      .input(
        z.object({
          catalogueId: z.number(),
          warehouseId: z.number(),
          minLevel: z.number(),
          maxLevel: z.number().nullable().optional(),
          safetyStockLevel: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const existing = await db
          .select()
          .from(stockSettings)
          .where(and(eq(stockSettings.catalogueId, input.catalogueId), eq(stockSettings.warehouseId, input.warehouseId)))
          .limit(1);
        if (existing.length) {
          const [updated] = await db
            .update(stockSettings)
            .set({
              minLevel: input.minLevel,
              maxLevel: input.maxLevel ?? null,
              safetyStockLevel: input.safetyStockLevel ?? null,
              updatedAt: new Date(),
            })
            .where(eq(stockSettings.id, existing[0].id))
            .returning();
          return updated;
        }
        const [created] = await db
          .insert(stockSettings)
          .values({
            catalogueId: input.catalogueId,
            warehouseId: input.warehouseId,
            minLevel: input.minLevel,
            maxLevel: input.maxLevel ?? null,
            safetyStockLevel: input.safetyStockLevel ?? null,
          })
          .returning();
        return created;
      }),

    setZoneLocation: protectedProcedure
      .input(z.object({ catalogueId: z.number(), warehouseId: z.number(), zoneLocation: z.string().max(100) }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const existing = await db
          .select()
          .from(stockSettings)
          .where(and(eq(stockSettings.catalogueId, input.catalogueId), eq(stockSettings.warehouseId, input.warehouseId)))
          .limit(1);
        if (existing.length) {
          const [updated] = await db
            .update(stockSettings)
            .set({ zoneLocation: input.zoneLocation, updatedAt: new Date() })
            .where(eq(stockSettings.id, existing[0].id))
            .returning();
          return updated;
        }
        const [created] = await db
          .insert(stockSettings)
          .values({
            catalogueId: input.catalogueId,
            warehouseId: input.warehouseId,
            zoneLocation: input.zoneLocation,
          })
          .returning();
        return created;
      }),
  }),

  movements: router({
    list: protectedProcedure
      .input(
        z
          .object({
            warehouseId: z.number().optional(),
            itemId: z.number().optional(),
            type: inventoryMovementTypeEnum.optional(),
            dateFrom: z.coerce.date().optional(),
            dateTo: z.coerce.date().optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        const scopedWarehouseId = enforceFacilityScope(ctx.user, input?.warehouseId);
        if (scopedWarehouseId === -1) return [];

        const db = await getDb();
        if (!db) return [];
        const filters = [];
        if (scopedWarehouseId != null && scopedWarehouseId > 0) {
          filters.push(eq(stockCards.locationId, scopedWarehouseId));
        }
        if (input?.itemId) filters.push(eq(commodityTrackingNumbers.itemId, input.itemId));
        if (input?.type) filters.push(eq(stockMovements.sourceType, input.type as any));
        if (input?.dateFrom) filters.push(gte(stockMovements.createdAt, input.dateFrom));
        if (input?.dateTo) filters.push(lte(stockMovements.createdAt, input.dateTo));
        return db
          .select({
            id: stockMovements.id,
            createdAt: stockMovements.createdAt,
            movementType: stockMovements.sourceType,
            quantityChange: sql<number>`${stockMovements.quantityIn} - ${stockMovements.quantityOut}`,
            balanceAfter: stockMovements.balanceAfter,
            documentNumber: stockMovements.documentRef,
            documentType: stockMovements.sourceType,
            fromWarehouseId: stockCards.locationId,
            toWarehouseId: sql<number | null>`null`,
            itemCode: inventoryCatalogue.itemCode,
            itemName: inventoryCatalogue.name,
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(desc(stockMovements.createdAt));
      }),

    byDocument: protectedProcedure
      .input(z.object({ documentNumber: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select({
            id: stockMovements.id,
            createdAt: stockMovements.createdAt,
            sourceType: stockMovements.sourceType,
            quantityIn: stockMovements.quantityIn,
            quantityOut: stockMovements.quantityOut,
            balanceAfter: stockMovements.balanceAfter,
            documentRef: stockMovements.documentRef,
            locationId: stockCards.locationId,
            itemId: commodityTrackingNumbers.itemId,
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .where(eq(stockMovements.documentRef, input.documentNumber))
          .orderBy(asc(stockMovements.id));
      }),

    byItem: protectedProcedure
      .input(z.object({ catalogueId: z.number(), warehouseId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const filters = [eq(commodityTrackingNumbers.itemId, input.catalogueId)];
        if (input.warehouseId) {
          filters.push(eq(stockCards.locationId, input.warehouseId));
        }
        return db
          .select({
            id: stockMovements.id,
            createdAt: stockMovements.createdAt,
            sourceType: stockMovements.sourceType,
            quantityIn: stockMovements.quantityIn,
            quantityOut: stockMovements.quantityOut,
            balanceAfter: stockMovements.balanceAfter,
            documentRef: stockMovements.documentRef,
            locationId: stockCards.locationId,
            itemId: commodityTrackingNumbers.itemId,
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .where(and(...filters))
          .orderBy(desc(stockMovements.createdAt));
      }),
  }),

  receipts: router({
    suggestNumber: protectedProcedure
      .input(z.object({ facilityId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const year = new Date().getUTCFullYear();
        const [site] = input?.facilityId
          ? await db.select({ code: sites.code }).from(sites).where(eq(sites.id, input.facilityId)).limit(1)
          : [{ code: null as string | null }];
        const facilityCode = (site?.code ?? "LOC").toUpperCase();
        const prefix = `NRCS-${facilityCode}-${year}-`;
        const relationalRows = await db
          .select({ grnNumber: goodsReceivedNotes.grnNumber })
          .from(goodsReceivedNotes)
          .where(ilike(goodsReceivedNotes.grnNumber, `${prefix}%`));
        const legacyRows = await db
          .select({ documentNumber: inventoryDocuments.documentNumber })
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.documentType, "grn"), ilike(inventoryDocuments.documentNumber, `${prefix}%`)));
        const max = [...relationalRows, ...legacyRows].reduce((acc, row) => {
          const num = "grnNumber" in row ? row.grnNumber : row.documentNumber;
          const tail = Number(num.split("-").at(-1));
          return Number.isFinite(tail) ? Math.max(acc, tail) : acc;
        }, 0);
        return {
          suggested: `${prefix}${String(max + 1).padStart(4, "0")}`,
          facilityCode,
          year,
        };
      }),

    createDraft: protectedProcedure.input(grnDraftInputSchema).mutation(async ({ input, ctx }) => {
      requireRole(ctx, ["staff", "manager", "admin"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const [dupeRel] = await db
        .select({ id: goodsReceivedNotes.id })
        .from(goodsReceivedNotes)
        .where(eq(goodsReceivedNotes.grnNumber, input.grnNumber))
        .limit(1);
      const [dupeLegacy] = await db
        .select({ id: inventoryDocuments.id })
        .from(inventoryDocuments)
        .where(eq(inventoryDocuments.documentNumber, input.grnNumber))
        .limit(1);
      if (dupeRel || dupeLegacy) {
        throw new TRPCError({ code: "CONFLICT", message: "GRN number already exists." });
      }
      const grn = await insertGrnWithLines(
        db,
        grnHeaderValuesFromDraft(input as GrnDraftHeaderInput, ctx.user.id, "draft"),
        input.items as GrnDraftHeaderInput["items"]
      );
      return { ...grn, id: grn.id, source: "relational" as const };
    }),

    updateDraft: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          source: grnSourceSchema,
          payload: grnDraftInputSchema,
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        if (input.source === "legacy") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Legacy GRNs cannot be edited. Migrate or recreate as relational." });
        }
        const [grn] = await db
          .select()
          .from(goodsReceivedNotes)
          .where(eq(goodsReceivedNotes.id, input.documentId))
          .limit(1);
        if (!grn) throw new TRPCError({ code: "NOT_FOUND", message: "GRN not found." });
        if (grn.status !== "draft" && grn.status !== "pending_approval") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft GRNs can be edited." });
        }
        const [dupeRel] = await db
          .select({ id: goodsReceivedNotes.id })
          .from(goodsReceivedNotes)
          .where(
            and(
              eq(goodsReceivedNotes.grnNumber, input.payload.grnNumber),
              sql`${goodsReceivedNotes.id} <> ${input.documentId}`
            )
          )
          .limit(1);
        const [dupeLegacy] = await db
          .select({ id: inventoryDocuments.id })
          .from(inventoryDocuments)
          .where(eq(inventoryDocuments.documentNumber, input.payload.grnNumber))
          .limit(1);
        if (dupeRel || dupeLegacy) {
          throw new TRPCError({ code: "CONFLICT", message: "GRN number already exists." });
        }
        const [updated] = await db
          .update(goodsReceivedNotes)
          .set({
            ...grnHeaderValuesFromDraft(input.payload as GrnDraftHeaderInput, ctx.user.id, "draft"),
            status: "draft",
          })
          .where(eq(goodsReceivedNotes.id, input.documentId))
          .returning();
        await replaceGrnLines(db, input.documentId, input.payload.items as GrnDraftHeaderInput["items"]);
        return { ...updated!, source: "relational" as const };
      }),

    create: protectedProcedure
      .input(
        z.object({
          warehouseId: z.number(),
          receiptType: z.enum(["purchase", "donation", "transfer_in", "return"]),
          supplierName: z.string().optional(),
          referenceDocument: z.string().optional(),
          transportDetails: z
            .object({
              carrier: z.string().optional(),
              vehicleReg: z.string().optional(),
              driverName: z.string().optional(),
              driverPhone: z.string().optional(),
            })
            .optional(),
          items: z.array(grnDocumentItemSchema).min(1),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const documentNumber = await nextDocumentNumber("GRN");
        const grn = await insertGrnWithLines(
          db,
          {
            grnNumber: documentNumber,
            countryCode: "NG",
            delegationLocationId: input.warehouseId,
            receivedFrom: input.supplierName || input.referenceDocument || "Supplier",
            dateOfArrival: new Date().toISOString().slice(0, 10),
            documentWellReceived: true,
            comments: input.notes ?? null,
            status: "pending_approval",
            createdBy: ctx.user.id,
            updatedAt: new Date(),
          },
          input.items as GrnDraftHeaderInput["items"]
        );
        return { ...grn, id: grn.id, source: "relational" as const };
      }),

    approve: protectedProcedure
      .input(z.object({ documentId: z.number(), source: grnSourceSchema }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

        const useLegacy =
          input.source === "legacy" ||
          (input.source !== "relational" &&
            !(await db.select({ id: goodsReceivedNotes.id }).from(goodsReceivedNotes).where(eq(goodsReceivedNotes.id, input.documentId)).limit(1))[0]);

        if (useLegacy) {
          const [doc] = await db
            .select()
            .from(inventoryDocuments)
            .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "grn")))
            .limit(1);
          if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "GRN not found." });
          const lines = Array.isArray(doc.items) ? (doc.items as z.infer<typeof grnDocumentItemSchema>[]) : [];
          for (const line of lines) {
            if (line.ctnId == null) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                  "GRN lines must specify a CTN. Create the CTN in the CTN Registry first, or use the GRN form's inline CTN creator.",
              });
            }
            try {
              await assertCtnMatchesCatalogue(db, line.ctnId, line.catalogueId);
            } catch (e) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: e instanceof Error ? e.message : String(e),
              });
            }
            const stockCardId = await ensureStockCardForCtnAtLocation(db, {
              ctnId: line.ctnId,
              locationId: Number(doc.toWarehouseId),
            });
            await insertGrnReceiptMovement(db, {
              stockCardId,
              quantityIn: line.quantity,
              documentNumber: doc.documentNumber,
              fromTo: doc.referenceDocument ?? null,
              remarks: line.notes ?? null,
              createdBy: ctx.user.id,
            });
          }
          await db
            .update(inventoryDocuments)
            .set({ status: "completed", approvedBy: ctx.user.id, approvedAt: new Date(), completedAt: new Date() })
            .where(eq(inventoryDocuments.id, doc.id));
          await notifyManagers("GRN Approved", `GRN ${doc.documentNumber} completed.`, doc.id);
          if (process.env.WMS_GRN_NOTIFY_TO) {
            const emailService = createEmailService();
            await emailService.send({
              type: "grn_finalized",
              to: process.env.WMS_GRN_NOTIFY_TO,
              subject: `GRN ${doc.documentNumber} finalized - ${lines.length} items received`,
              html: `<p>GRN <strong>${doc.documentNumber}</strong> has been finalized with ${lines.length} line item(s).</p>`,
            });
          }
          await logAuditEvent({
            userId: ctx.user.id,
            action: AUDIT_ACTIONS.INVENTORY_GOODS_RECEIVED,
            entityType: "grn",
            entityId: doc.id,
            changes: {
              documentNumber: doc.documentNumber,
              warehouseId: doc.toWarehouseId,
              lineCount: lines.length,
              source: "legacy",
              items: lines.map((line) => ({
                catalogueId: line.catalogueId,
                quantity: line.quantity,
              })),
            },
            req: ctx.req,
          });
          return { success: true as const, source: "legacy" as const };
        }

        const finalizeCtx = await loadGrnFinalizeContext(db, input.documentId);
        try {
          await validateGrnFinalize(db, finalizeCtx);
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        await db.transaction(async (tx) => {
          await finalizeGrnLedger(tx as unknown as GrnLedgerDb, finalizeCtx, { userId: ctx.user.id });
          await tx
            .update(goodsReceivedNotes)
            .set({
              status: "finalized",
              finalizedBy: ctx.user.id,
              finalizedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(goodsReceivedNotes.id, input.documentId));
        });
        const { grn, lines } = finalizeCtx;
        await notifyManagers("GRN Approved", `GRN ${grn.grnNumber} finalized.`, grn.id);
        if (process.env.WMS_GRN_NOTIFY_TO) {
          const emailService = createEmailService();
          await emailService.send({
            type: "grn_finalized",
            to: process.env.WMS_GRN_NOTIFY_TO,
            subject: `GRN ${grn.grnNumber} finalized - ${lines.length} items received`,
            html: `<p>GRN <strong>${grn.grnNumber}</strong> has been finalized with ${lines.length} line item(s).</p>`,
          });
        }
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.INVENTORY_GOODS_RECEIVED,
          entityType: "grn",
          entityId: grn.id,
          changes: {
            documentNumber: grn.grnNumber,
            warehouseId: grn.delegationLocationId,
            lineCount: lines.length,
            source: "relational",
          },
          req: ctx.req,
        });
        return { success: true as const, source: "relational" as const };
      }),

    list: protectedProcedure
      .input(
        z
          .object({
            warehouseId: z.number().optional(),
            status: z.enum(["draft", "pending_approval", "finalized", "claim_raised"]).optional(),
            search: z.string().optional(),
            receivedFrom: z.string().optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
          })
          .merge(listPaginationInput)
          .optional()
      )
      .query(async ({ input, ctx }) => {
        const scopedWarehouseId = enforceFacilityScope(ctx.user, input?.warehouseId);
        if (scopedWarehouseId === -1) return [];

        const db = await getDb();
        if (!db) return [];
        const search = input?.search?.trim();
        const receivedFrom = input?.receivedFrom?.trim();
        const limit = resolveListLimit(input?.limit);
        const offset = resolveListOffset(input?.offset);

        const relationalFilters = [];
        if (scopedWarehouseId != null && scopedWarehouseId > 0) {
          relationalFilters.push(eq(goodsReceivedNotes.delegationLocationId, scopedWarehouseId));
        }
        if (input?.status) {
          relationalFilters.push(eq(goodsReceivedNotes.status, input.status));
        }
        if (search) {
          relationalFilters.push(
            or(
              ilike(goodsReceivedNotes.grnNumber, `%${search}%`),
              ilike(goodsReceivedNotes.receivedFrom, `%${search}%`)
            )!
          );
        }
        if (receivedFrom) {
          relationalFilters.push(ilike(goodsReceivedNotes.receivedFrom, `%${receivedFrom}%`));
        }
        if (input?.dateFrom) {
          relationalFilters.push(gte(goodsReceivedNotes.createdAt, new Date(`${input.dateFrom}T00:00:00.000Z`)));
        }
        if (input?.dateTo) {
          relationalFilters.push(lte(goodsReceivedNotes.createdAt, new Date(`${input.dateTo}T23:59:59.999Z`)));
        }

        const relationalRows = await db
          .select()
          .from(goodsReceivedNotes)
          .where(relationalFilters.length ? and(...relationalFilters) : undefined)
          .orderBy(desc(goodsReceivedNotes.createdAt));

        const relationalIds = relationalRows.map((row) => row.id);
        const lineCounts =
          relationalIds.length > 0
            ? await db
                .select({
                  grnId: goodsReceivedNoteLines.grnId,
                  count: sql<number>`count(*)::int`.mapWith(Number),
                })
                .from(goodsReceivedNoteLines)
                .where(inArray(goodsReceivedNoteLines.grnId, relationalIds))
                .groupBy(goodsReceivedNoteLines.grnId)
            : [];
        const lineCountByGrnId = new Map(lineCounts.map((row) => [row.grnId, row.count]));

        const legacyFilters = [eq(inventoryDocuments.documentType, "grn")];
        if (scopedWarehouseId != null && scopedWarehouseId > 0) {
          legacyFilters.push(eq(inventoryDocuments.toWarehouseId, scopedWarehouseId));
        }
        if (input?.status) {
          legacyFilters.push(eq(inventoryDocuments.status, mapLegacyStatusFilter(input.status)));
        }
        if (search) {
          legacyFilters.push(
            or(
              ilike(inventoryDocuments.documentNumber, `%${search}%`),
              ilike(inventoryDocuments.referenceDocument, `%${search}%`)
            )!
          );
        }
        if (receivedFrom) {
          legacyFilters.push(ilike(inventoryDocuments.referenceDocument, `%${receivedFrom}%`));
        }
        if (input?.dateFrom) {
          legacyFilters.push(gte(inventoryDocuments.createdAt, new Date(`${input.dateFrom}T00:00:00.000Z`)));
        }
        if (input?.dateTo) {
          legacyFilters.push(lte(inventoryDocuments.createdAt, new Date(`${input.dateTo}T23:59:59.999Z`)));
        }

        const legacyRows = await db
          .select()
          .from(inventoryDocuments)
          .where(and(...legacyFilters))
          .orderBy(desc(inventoryDocuments.createdAt));

        const merged = [
          ...relationalRows.map((row) => mapRelationalGrnToListRow(row, lineCountByGrnId.get(row.id) ?? 0)),
          ...legacyRows.map(mapLegacyInventoryDocToListRow),
        ].sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

        return merged.slice(offset, offset + limit);
      }),

    get: protectedProcedure
      .input(z.object({ documentId: z.number(), source: grnSourceSchema }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return null;
        const detail = await resolveGrnById(db, input.documentId, input.source as GrnSource | undefined);
        if (!detail) return null;
        assertRecordFacilityAccess(ctx.user, detail.toWarehouseId);
        return detail;
      }),

    downloadPdf: protectedProcedure
      .input(z.object({ documentId: z.number(), source: grnSourceSchema }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const detail = await resolveGrnById(db, input.documentId, input.source as GrnSource | undefined);
        if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "GRN not found." });
        assertRecordFacilityAccess(ctx.user, detail.toWarehouseId);
        const rows = [
          { label: "Document Number", value: detail.documentNumber },
          { label: "Status", value: detail.status ?? "draft" },
          { label: "Reference", value: detail.referenceDocument ?? "—" },
          { label: "Created At", value: detail.createdAt ? new Date(detail.createdAt).toISOString() : "—" },
          { label: "Notes", value: detail.notes ?? "—" },
        ];
        const buffer = await generateGrnPdf({ rows });
        return {
          data: buffer.toString("base64"),
          filename: `${detail.documentNumber}.pdf`,
          mimeType: "application/pdf",
        };
      }),
  }),

  waybills: router({
    list: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            warehouseId: z.number().optional(),
            status: z.enum(["draft", "dispatched", "received", "claim_raised"]).optional(),
            destinationType: z.enum(["beneficiary", "branch_store", "other"]).optional(),
          })
          .merge(listPaginationInput)
          .optional()
      )
      .query(async ({ input, ctx }) => {
        const scopedWarehouseId = enforceFacilityScope(ctx.user, input?.warehouseId);
        if (scopedWarehouseId === -1) return [];

        const db = await getDb();
        if (!db) return [];
        const filters = [];
        if (scopedWarehouseId != null && scopedWarehouseId > 0) {
          filters.push(eq(waybills.warehouseId, scopedWarehouseId));
        }
        if (input?.status) filters.push(eq(waybills.status, input.status));
        if (input?.destinationType) filters.push(eq(waybills.destinationType, input.destinationType));
        if (input?.dateFrom) filters.push(gte(waybills.date, input.dateFrom));
        if (input?.dateTo) filters.push(lte(waybills.date, input.dateTo));
        if (input?.search?.trim()) {
          const q = `%${input.search.trim()}%`;
          filters.push(or(ilike(waybills.wbNumber, q), ilike(waybills.destinationBeneficiary, q))!);
        }
        const limit = resolveListLimit(input?.limit);
        const offset = resolveListOffset(input?.offset);
        const rows = await db
          .select()
          .from(waybills)
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(desc(waybills.createdAt))
          .limit(limit)
          .offset(offset);
        const waybillIds = rows.map((r) => r.id);
        const allLines =
          waybillIds.length > 0
            ? await db.select().from(waybillLines).where(inArray(waybillLines.waybillId, waybillIds))
            : [];
        const linesByWaybill = new Map<number, typeof allLines>();
        for (const line of allLines) {
          const bucket = linesByWaybill.get(line.waybillId) ?? [];
          bucket.push(line);
          linesByWaybill.set(line.waybillId, bucket);
        }
        return rows.map((row) => {
          const lineRows = linesByWaybill.get(row.id) ?? [];
          const totalUnits = lineRows.reduce((sum, line) => sum + Number(line.nbOfUnits), 0);
          return { ...row, lineCount: lineRows.length, totalUnits };
        });
      }),

    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const [wb] = await db.select().from(waybills).where(eq(waybills.id, input.id)).limit(1);
      if (!wb) return null;
      assertRecordFacilityAccess(ctx.user, wb.warehouseId);
      const lines = await db.select().from(waybillLines).where(eq(waybillLines.waybillId, wb.id)).orderBy(asc(waybillLines.lineOrder));
      const lineIds = lines.map((line) => line.id);
      const sources =
        lineIds.length > 0
          ? await db
              .select()
              .from(waybillLineCtnSources)
              .where(inArray(waybillLineCtnSources.waybillLineId, lineIds))
              .orderBy(asc(waybillLineCtnSources.sourceOrder))
          : [];
      return {
        ...wb,
        lines: lines.map((line) => ({
          ...line,
          ctnSources: sources.filter((source) => source.waybillLineId === line.id),
        })),
      };
    }),

    generateNumber: protectedProcedure
      .input(z.object({ warehouseId: z.number().int().positive() }))
      .query(async ({ input }) => ({ suggested: await nextWaybillNumber(input.warehouseId) })),

    create: protectedProcedure.input(waybillDraftSchema).mutation(async ({ input, ctx }) => {
      requireRole(ctx, ["staff", "manager", "admin"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const wbNumber = input.wbNumber?.trim() || (await nextWaybillNumber(input.warehouseId));
      const [created] = await db
        .insert(waybills)
        .values({
          wbNumber,
          docType: "waybill",
          date: input.date,
          warehouseId: input.warehouseId,
          destinationType: input.destinationType,
          destinationBeneficiary: input.destinationBeneficiary,
          destinationLocation: input.destinationLocation ?? null,
          meansOfTransport: input.meansOfTransport ?? null,
          vehicle1: input.vehicle1 ?? null,
          registration1: input.registration1 ?? null,
          transportedByName: input.transportedByName ?? null,
          transportedByDate: input.transportedByDate ?? null,
          transportedByFunction: input.transportedByFunction ?? null,
          loadedByName: input.loadedByName ?? null,
          loadedByDate: input.loadedByDate ?? null,
          loadedByFunction: input.loadedByFunction ?? null,
          comments: input.comments ?? null,
          requisitionId: input.requisitionId ?? null,
          status: "draft",
          createdBy: ctx.user.id,
        })
        .returning();

      for (let index = 0; index < input.lines.length; index += 1) {
        const line = input.lines[index]!;
        const firstSource = line.ctnSources[0];
        const [createdLine] = await db
          .insert(waybillLines)
          .values({
            waybillId: created.id,
              itemId: line.itemId,
            itemDescription: line.itemDescription,
            ctnId: firstSource.ctnId,
            nbOfUnits: line.nbOfUnits,
            unitType: line.unitType,
            weightKg: line.weightKg ?? null,
            volumeM3: line.volumeM3 ?? null,
            requisitionLineId: line.requisitionLineId ?? null,
            remarks: line.remarks ?? null,
            lineOrder: index,
          })
          .returning();
        await db.insert(waybillLineCtnSources).values(
          line.ctnSources.map((source: z.infer<typeof waybillSourceSchema>, sourceIndex: number) => ({
            waybillLineId: createdLine.id,
            ctnId: source.ctnId,
            quantity: source.quantity,
            overrideByUserId: source.overrideByUserId ?? null,
            overrideReason: source.overrideReason ?? null,
            sourceOrder: sourceIndex,
          }))
        );
      }
      return created;
    }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          payload: waybillDraftSchema,
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [existing] = await db.select().from(waybills).where(eq(waybills.id, input.id)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Waybill not found." });
        assertRecordFacilityAccess(ctx.user, existing.warehouseId);
        assertFacilityAccess(ctx.user, input.payload.warehouseId);
        if (existing.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft waybills can be updated." });

        await db
          .update(waybills)
          .set({
            wbNumber: input.payload.wbNumber?.trim() || existing.wbNumber,
            date: input.payload.date,
            warehouseId: input.payload.warehouseId,
            destinationType: input.payload.destinationType,
            destinationBeneficiary: input.payload.destinationBeneficiary,
            destinationLocation: input.payload.destinationLocation ?? null,
            meansOfTransport: input.payload.meansOfTransport ?? null,
            vehicle1: input.payload.vehicle1 ?? null,
            registration1: input.payload.registration1 ?? null,
            transportedByName: input.payload.transportedByName ?? null,
            transportedByDate: input.payload.transportedByDate ?? null,
            transportedByFunction: input.payload.transportedByFunction ?? null,
            loadedByName: input.payload.loadedByName ?? null,
            loadedByDate: input.payload.loadedByDate ?? null,
            loadedByFunction: input.payload.loadedByFunction ?? null,
            comments: input.payload.comments ?? null,
            requisitionId: input.payload.requisitionId ?? null,
            updatedAt: new Date(),
          })
          .where(eq(waybills.id, input.id));

        const currentLines = await db.select().from(waybillLines).where(eq(waybillLines.waybillId, input.id));
        if (currentLines.length > 0) {
          await db.delete(waybillLineCtnSources).where(inArray(waybillLineCtnSources.waybillLineId, currentLines.map((x) => x.id)));
        }
        await db.delete(waybillLines).where(eq(waybillLines.waybillId, input.id));

        for (let index = 0; index < input.payload.lines.length; index += 1) {
          const line = input.payload.lines[index]!;
          const [createdLine] = await db
            .insert(waybillLines)
            .values({
              waybillId: input.id,
              itemId: line.itemId,
              itemDescription: line.itemDescription,
              ctnId: line.ctnSources[0]!.ctnId,
              nbOfUnits: line.nbOfUnits,
              unitType: line.unitType,
              weightKg: line.weightKg ?? null,
              volumeM3: line.volumeM3 ?? null,
              requisitionLineId: line.requisitionLineId ?? null,
              remarks: line.remarks ?? null,
              lineOrder: index,
            })
            .returning();
          await db.insert(waybillLineCtnSources).values(
            line.ctnSources.map((source: z.infer<typeof waybillSourceSchema>, sourceIndex: number) => ({
              waybillLineId: createdLine.id,
              ctnId: source.ctnId,
              quantity: source.quantity,
              overrideByUserId: source.overrideByUserId ?? null,
              overrideReason: source.overrideReason ?? null,
              sourceOrder: sourceIndex,
            }))
          );
        }
        return { success: true as const };
      }),

    dispatch: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          overrideApprovals: z
            .array(
              z.object({
                ctnSourceId: z.number().int().positive(),
                overrideByUserId: z.number().int().positive(),
                overrideReason: z.string().min(1),
              })
            )
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        let dispatchCtx;
        try {
          dispatchCtx = await loadWaybillDispatchContext(db, input.id);
        } catch (error) {
          if (error instanceof Error && error.message === "Waybill not found.") {
            throw new TRPCError({ code: "NOT_FOUND", message: "Waybill not found." });
          }
          throw error;
        }
        assertRecordFacilityAccess(ctx.user, dispatchCtx.waybill.warehouseId);
        try {
          await validateWaybillDispatch(db, dispatchCtx, input.overrideApprovals ?? []);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Waybill dispatch validation failed.",
          });
        }

        const { lineItemIds } = await dispatchWaybillLedger(db, dispatchCtx, {
          createdBy: ctx.user.id,
          overrideApprovals: input.overrideApprovals,
        });
        const wb = dispatchCtx.waybill;
        const lines = dispatchCtx.lines;
        for (const itemId of lineItemIds) {
          await checkStockThreshold({
            catalogueId: itemId,
            warehouseId: wb.warehouseId,
            relatedEntityId: wb.id,
          });
        }
        if (process.env.WMS_WAYBILL_NOTIFY_TO) {
          const emailService = createEmailService();
          await emailService.send({
            type: "waybill_dispatched",
            to: process.env.WMS_WAYBILL_NOTIFY_TO,
            subject: `Shipment en route - WB ${wb.wbNumber} from warehouse ${wb.warehouseId}`,
            html: `<p>Waybill <strong>${wb.wbNumber}</strong> has been dispatched to ${wb.destinationBeneficiary}.</p>`,
          });
        }
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.INVENTORY_DISTRIBUTION,
          entityType: "waybill",
          entityId: wb.id,
          changes: {
            documentRef: wb.wbNumber,
            warehouseId: wb.warehouseId,
            destination: wb.destinationBeneficiary,
            lineCount: lines.length,
            totalUnits: lines.reduce((sum, line) => sum + Number(line.nbOfUnits), 0),
          },
          req: ctx.req,
        });
        return { success: true as const };
      }),

    previewDiscrepancy: protectedProcedure
      .input(z.object({ waybillId: z.number().int().positive(), grnDocumentId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const wbLines = await db.select().from(waybillLines).where(eq(waybillLines.waybillId, input.waybillId));
        const [grn] = await db
          .select()
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.id, input.grnDocumentId), eq(inventoryDocuments.documentType, "grn")))
          .limit(1);
        if (!grn) throw new TRPCError({ code: "NOT_FOUND", message: "GRN not found." });
        const grnItems = Array.isArray(grn.items) ? (grn.items as Array<{ catalogueId: number; quantity: number }>) : [];
        const wbByItem = new Map<number, number>();
        for (const line of wbLines) wbByItem.set(line.itemId, (wbByItem.get(line.itemId) ?? 0) + Number(line.nbOfUnits));
        const grnByItem = new Map<number, number>();
        for (const item of grnItems) grnByItem.set(item.catalogueId, (grnByItem.get(item.catalogueId) ?? 0) + Number(item.quantity));
        const allItemIds = new Set(Array.from(wbByItem.keys()).concat(Array.from(grnByItem.keys())));
        const discrepancies = Array.from(allItemIds.values())
          .map((itemId) => ({
            itemId,
            dispatched: wbByItem.get(itemId) ?? 0,
            received: grnByItem.get(itemId) ?? 0,
            delta: (grnByItem.get(itemId) ?? 0) - (wbByItem.get(itemId) ?? 0),
          }))
          .filter((row) => Math.abs(row.delta) > 0.0001);
        if (discrepancies.length > 0) {
          await db.update(waybills).set({ status: "claim_raised", updatedAt: new Date() }).where(eq(waybills.id, input.waybillId));
        }
        return { discrepancies, claimRaised: discrepancies.length > 0 };
      }),
  }),

  transfers: router({
    create: protectedProcedure
      .input(
        z.object({
          fromWarehouseId: z.number(),
          toWarehouseId: z.number(),
          referenceDocument: z.string().optional(),
          transportDetails: z.any().optional(),
          items: z.array(documentItemSchema).min(1),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        if (input.fromWarehouseId === input.toWarehouseId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Source and destination warehouses must differ." });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const tnNumber = await nextDocumentNumber("TN");
        const note = await insertTransferWithLines(db, {
          tnNumber,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          referenceDocument: input.referenceDocument,
          transportDetails: input.transportDetails ?? null,
          notes: input.notes,
          createdBy: ctx.user.id,
          items: input.items.map((item) => ({
            catalogueId: item.catalogueId,
            quantity: item.quantity,
          })),
        });
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.INVENTORY_TRANSFER_CREATED,
          entityType: "transfer_note",
          entityId: note.id,
          changes: {
            tnNumber: note.tnNumber,
            fromWarehouseId: note.fromWarehouseId,
            toWarehouseId: note.toWarehouseId,
            lineCount: input.items.length,
          },
          req: ctx.req,
        });
        return {
          id: note.id,
          source: "relational" as const,
          documentNumber: note.tnNumber,
          status: note.status,
        };
      }),

    approve: protectedProcedure
      .input(transferRefSchema)
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

        if (input.source === "legacy") {
          const doc = await resolveLegacyTransfer(db, input.id);
          if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer note not found." });
          if (doc.status !== "pending_approval") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer is not pending approval." });
          }
          await db
            .update(inventoryDocuments)
            .set({ status: "approved", approvedBy: ctx.user.id, approvedAt: new Date() })
            .where(eq(inventoryDocuments.id, doc.id));
          await logAuditEvent({
            userId: ctx.user.id,
            action: AUDIT_ACTIONS.INVENTORY_TRANSFER_APPROVED,
            entityType: "transfer_note",
            entityId: doc.id,
            changes: { source: "legacy", documentNumber: doc.documentNumber },
            req: ctx.req,
          });
          return { success: true as const };
        }

        const note = await resolveRelationalTransfer(db, input.id);
        if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer note not found." });
        if (note.status !== "pending_approval") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer is not pending approval." });
        }
        await db
          .update(transferNotes)
          .set({ status: "approved", approvedBy: ctx.user.id, approvedAt: new Date(), updatedAt: new Date() })
          .where(eq(transferNotes.id, note.id));
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.INVENTORY_TRANSFER_APPROVED,
          entityType: "transfer_note",
          entityId: note.id,
          changes: { source: "relational", tnNumber: note.tnNumber },
          req: ctx.req,
        });
        return { success: true as const };
      }),

    allocateDispatch: protectedProcedure
      .input(transferRefSchema)
      .query(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

        if (input.source === "legacy") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "CTN allocation preview is only available for relational transfers.",
          });
        }

        const note = await resolveRelationalTransfer(db, input.id);
        if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer note not found." });
        if (note.status !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer must be approved before dispatch." });
        }

        const lines = await loadRelationalTransferLines(db, note.id);
        const today = new Date().toISOString().slice(0, 10);
        const suggestedAllocations = [];

        for (const line of lines) {
          const candidates = await loadFefoCandidates(db, {
            itemId: line.catalogueId,
            warehouseId: note.fromWarehouseId,
          });
          let sources;
          try {
            sources = allocateFefoFromCandidates(candidates, Number(line.quantity), today);
          } catch (error) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error instanceof Error ? error.message : "FEFO allocation failed.",
            });
          }
          suggestedAllocations.push({
            lineId: line.id,
            catalogueId: line.catalogueId,
            quantity: Number(line.quantity),
            sources: sources.map((source) => {
              const candidate = candidates.find((row) => row.ctnId === source.ctnId);
              return {
                ctnId: source.ctnId,
                ctnCode: candidate?.ctnCode ?? null,
                quantity: source.quantity,
                expiryDate: candidate?.expiryDate ?? null,
                balance: candidate?.balance ?? null,
              };
            }),
          });
        }

        const existingSources = await loadRelationalTransferCtnSources(
          db,
          lines.map((line) => line.id)
        );
        const detail = await mapRelationalTransferToDetail(db, note, lines, existingSources);

        return { transfer: detail, suggestedAllocations };
      }),

    dispatch: protectedProcedure
      .input(
        transferRefSchema.extend({
          lineAllocations: z.array(transferLineAllocationSchema).optional(),
          expiredOverrides: z.array(transferExpiredOverrideSchema).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

        if (input.source === "legacy") {
          const doc = await resolveLegacyTransfer(db, input.id);
          if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer note not found." });
          if (doc.status !== "approved") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer must be approved before dispatch." });
          }
          await legacyTransferDispatch(db, doc, ctx.user.id);
          await logAuditEvent({
            userId: ctx.user.id,
            action: AUDIT_ACTIONS.INVENTORY_TRANSFER_DISPATCHED,
            entityType: "transfer_note",
            entityId: doc.id,
            changes: { source: "legacy", documentNumber: doc.documentNumber },
            req: ctx.req,
          });
          return { success: true as const };
        }

        const note = await resolveRelationalTransfer(db, input.id);
        if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer note not found." });
        if (note.status !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer must be approved before dispatch." });
        }

        const lines = await loadRelationalTransferLines(db, note.id);
        const today = new Date().toISOString().slice(0, 10);
        const allocationByLineId = new Map(
          (input.lineAllocations ?? []).map((entry) => [entry.lineId, entry.sources])
        );

        if (lines.length > 0) {
          await db.delete(transferNoteLineCtnSources).where(
            inArray(
              transferNoteLineCtnSources.transferNoteLineId,
              lines.map((line) => line.id)
            )
          );
        }

        const insertedSources: Array<{ id: number; transferNoteLineId: number; ctnId: number }> = [];
        for (const line of lines) {
          const sources =
            allocationByLineId.get(line.id) ??
            (await pickFefoCtnSources(db, {
              itemId: line.catalogueId,
              warehouseId: note.fromWarehouseId,
              quantity: Number(line.quantity),
              todayIso: today,
            }));

          const rows = await db
            .insert(transferNoteLineCtnSources)
            .values(
              sources.map((source, index) => ({
                transferNoteLineId: line.id,
                ctnId: source.ctnId,
                quantity: source.quantity,
                sourceOrder: index,
              }))
            )
            .returning({
              id: transferNoteLineCtnSources.id,
              transferNoteLineId: transferNoteLineCtnSources.transferNoteLineId,
              ctnId: transferNoteLineCtnSources.ctnId,
            });
          insertedSources.push(...rows);
        }

        const dispatchCtx = await loadTransferDispatchContext(db, note.id);
        const overrideApprovals: TransferDispatchOverride[] = [];
        for (const override of input.expiredOverrides ?? []) {
          const source = insertedSources.find(
            (row) => row.transferNoteLineId === override.lineId && row.ctnId === override.ctnId
          );
          if (!source) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `No CTN source found for line ${override.lineId} and CTN ${override.ctnId}.`,
            });
          }
          overrideApprovals.push({
            ctnSourceId: source.id,
            overrideByUserId: ctx.user.id,
            overrideReason: override.overrideReason,
          });
        }

        try {
          await validateTransferDispatch(db, dispatchCtx, overrideApprovals, today);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Transfer dispatch validation failed.",
          });
        }

        const { catalogueIds } = await dispatchTransferLedger(db, dispatchCtx, {
          createdBy: ctx.user.id,
          overrideApprovals,
        });
        for (const catalogueId of catalogueIds) {
          await checkStockThreshold({
            catalogueId,
            warehouseId: note.fromWarehouseId,
            relatedEntityId: note.id,
          });
        }
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.INVENTORY_TRANSFER_DISPATCHED,
          entityType: "transfer_note",
          entityId: note.id,
          changes: { source: "relational", tnNumber: note.tnNumber, lineCount: lines.length },
          req: ctx.req,
        });
        return { success: true as const };
      }),

    receive: protectedProcedure
      .input(transferRefSchema)
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

        if (input.source === "legacy") {
          const doc = await resolveLegacyTransfer(db, input.id);
          if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer note not found." });
          if (doc.status !== "dispatched") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer must be dispatched before receive." });
          }
          await legacyTransferReceive(db, doc, ctx.user.id);
          await logAuditEvent({
            userId: ctx.user.id,
            action: AUDIT_ACTIONS.INVENTORY_TRANSFER_RECEIVED,
            entityType: "transfer_note",
            entityId: doc.id,
            changes: { source: "legacy", documentNumber: doc.documentNumber },
            req: ctx.req,
          });
          return { success: true as const };
        }

        const note = await resolveRelationalTransfer(db, input.id);
        if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer note not found." });
        const dispatchCtx = await loadTransferDispatchContext(db, note.id);
        try {
          await validateTransferReceive(dispatchCtx);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Transfer receive validation failed.",
          });
        }
        const { catalogueIds } = await receiveTransferLedger(db, dispatchCtx, { createdBy: ctx.user.id });
        for (const catalogueId of catalogueIds) {
          await checkStockThreshold({
            catalogueId,
            warehouseId: note.toWarehouseId,
            relatedEntityId: note.id,
          });
        }
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.INVENTORY_TRANSFER_RECEIVED,
          entityType: "transfer_note",
          entityId: note.id,
          changes: { source: "relational", tnNumber: note.tnNumber },
          req: ctx.req,
        });
        return { success: true as const };
      }),

    list: protectedProcedure
      .input(z.object({ warehouseId: z.number().optional(), status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const statusFilter = input?.status as
          | "pending_approval"
          | "approved"
          | "dispatched"
          | "completed"
          | undefined;

        const relationalRows = await db
          .select()
          .from(transferNotes)
          .where(
            and(
              input?.warehouseId
                ? or(
                    eq(transferNotes.fromWarehouseId, input.warehouseId),
                    eq(transferNotes.toWarehouseId, input.warehouseId)
                  )
                : undefined,
              statusFilter ? eq(transferNotes.status, statusFilter) : undefined
            )
          )
          .orderBy(desc(transferNotes.createdAt));

        const legacyRows = await db
          .select()
          .from(inventoryDocuments)
          .where(
            and(
              eq(inventoryDocuments.documentType, "transfer_note"),
              input?.warehouseId
                ? or(
                    eq(inventoryDocuments.fromWarehouseId, input.warehouseId),
                    eq(inventoryDocuments.toWarehouseId, input.warehouseId)
                  )
                : undefined,
              input?.status ? eq(inventoryDocuments.status, input.status) : undefined
            )
          )
          .orderBy(desc(inventoryDocuments.createdAt));

        const relationalMapped = await Promise.all(
          relationalRows.map(async (note) => {
            const lines = await loadRelationalTransferLines(db, note.id);
            return mapRelationalTransferToListRow(note, lines.length);
          })
        );
        const legacyMapped = legacyRows.map(mapLegacyTransferToListRow);
        return [...relationalMapped, ...legacyMapped].sort((a, b) => {
          const aTime = a.createdAt?.getTime() ?? 0;
          const bTime = b.createdAt?.getTime() ?? 0;
          return bTime - aTime;
        });
      }),

    get: protectedProcedure
      .input(transferRefSchema)
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        if (input.source === "legacy") {
          const doc = await resolveLegacyTransfer(db, input.id);
          if (!doc) return null;
          const items = Array.isArray(doc.items) ? doc.items : [];
          return {
            id: doc.id,
            source: "legacy" as const,
            documentNumber: doc.documentNumber,
            status: doc.status,
            fromWarehouseId: doc.fromWarehouseId,
            toWarehouseId: doc.toWarehouseId,
            referenceDocument: doc.referenceDocument,
            notes: doc.notes,
            transportDetails: doc.transportDetails,
            createdAt: doc.createdAt ?? null,
            approvedAt: doc.approvedAt ?? null,
            dispatchedAt: null,
            completedAt: doc.completedAt ?? null,
            lines: items.map((item: Record<string, unknown>, index: number) => ({
              id: index,
              catalogueId: Number(item.catalogueId),
              quantity: Number(item.quantity),
              lineOrder: index,
              ctnSources: [],
            })),
          };
        }

        const note = await resolveRelationalTransfer(db, input.id);
        if (!note) return null;
        const lines = await loadRelationalTransferLines(db, note.id);
        const sources = await loadRelationalTransferCtnSources(
          db,
          lines.map((line) => line.id)
        );
        return mapRelationalTransferToDetail(db, note, lines, sources);
      }),
  }),

  documents: router({
    downloadTemplate: protectedProcedure
      .input(z.object({ type: z.enum(["grn", "waybill", "monthly_report", "stock_card"]) }))
      .query(async ({ input }) => {
        const wb = buildTemplateWorkbook(input.type as ImportDocumentType);
        const buf = await wb.xlsx.writeBuffer();
        const data = Buffer.from(buf).toString("base64");
        return {
          data,
          filename: `${input.type}-template.xlsx`,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }),

    parseExcelImport: protectedProcedure
      .input(z.object({ type: z.enum(["grn", "waybill", "monthly_report", "stock_card"]), base64File: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const parsed = await parseExcelRows(input.type as ImportDocumentType, input.base64File);
        return validateImportRows(db, parsed);
      }),

    parseTypedPdfImport: protectedProcedure
      .input(z.object({ type: z.enum(["grn", "waybill"]), base64File: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const buffer = Buffer.from(input.base64File, "base64");
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        try {
          const parsedPdf = await parser.getText();
          const text = String((parsedPdf as any)?.text ?? "").trim();
          if (!text) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This PDF appears to be a scanned image. Please enter the data manually via the Stock Card or Bin Card form.",
            });
          }
          const parsed = parseTypedPdfText(text, input.type as "grn" | "waybill");
          return validateImportRows(db, parsed);
        } finally {
          await parser.destroy();
        }
      }),

    drafts: router({
      list: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(inventoryImportDrafts)
          .orderBy(desc(inventoryImportDrafts.uploadedAt));
      }),

      get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [row] = await db.select().from(inventoryImportDrafts).where(eq(inventoryImportDrafts.id, input.id)).limit(1);
        return row ?? null;
      }),

      create: protectedProcedure
        .input(
          z.object({
            source: z.enum(["excel", "pdf"]),
            documentType: z.enum(["grn", "waybill", "monthly_report", "stock_card"]),
            fileName: z.string().optional(),
            rows: z.array(
              z.object({
                rowIndex: z.number(),
                status: z.enum(["valid", "warning", "error"]),
                errors: z.array(z.string()),
                data: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
                confidence: z.record(z.string(), z.number()).optional(),
              })
            ),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
          const validationStatus = input.rows.some((r) => r.status === "error")
            ? "invalid"
            : input.rows.some((r) => r.status === "warning")
              ? "warning"
              : "valid";
          const [draft] = await db
            .insert(inventoryImportDrafts)
            .values({
              source: input.source,
              documentType: input.documentType,
              fileName: input.fileName ?? null,
              rowCount: input.rows.length,
              status: "draft",
              validationStatus,
              rowsJson: input.rows as any,
              uploadedBy: ctx.user.id,
            })
            .returning();
          return draft;
        }),

      updateRows: protectedProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            rows: z.array(
              z.object({
                rowIndex: z.number(),
                status: z.enum(["valid", "warning", "error"]),
                errors: z.array(z.string()),
                data: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
                confidence: z.record(z.string(), z.number()).optional(),
              })
            ),
          })
        )
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
          const validated = await validateImportRows(db, input.rows as any);
          const validationStatus = validated.some((r) => r.status === "error")
            ? "invalid"
            : validated.some((r) => r.status === "warning")
              ? "warning"
              : "valid";
          await db
            .update(inventoryImportDrafts)
            .set({ rowsJson: validated as any, rowCount: validated.length, validationStatus, updatedAt: new Date() })
            .where(eq(inventoryImportDrafts.id, input.id));
          return { rows: validated, validationStatus };
        }),

      discard: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        await db.update(inventoryImportDrafts).set({ status: "discarded", updatedAt: new Date() }).where(eq(inventoryImportDrafts.id, input.id));
        return { success: true as const };
      }),

      finalize: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [draft] = await db.select().from(inventoryImportDrafts).where(eq(inventoryImportDrafts.id, input.id)).limit(1);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Import draft not found." });
        if (draft.status === "finalized") {
          return { success: true as const, alreadyFinalized: true as const };
        }
        const rows = Array.isArray(draft.rowsJson) ? (draft.rowsJson as any[]) : [];
        const validated = await validateImportRows(db, rows as any);
        const errorRows = validated.filter((r) => r.status === "error");
        if (errorRows.length > 0) {
          return { success: false as const, errors: errorRows };
        }

        for (const row of validated) {
          const itemCode = String(row.data.item_code ?? "").trim();
          const facilityCode = String(row.data.facility_code ?? "").trim();
          const ctnCode = String(row.data.ctn_code ?? "").trim();
          const donorCode = String(row.data.donor_code ?? "BLENDED").trim();
          const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.code, facilityCode)).limit(1);
          const [item] = await db.select({ id: inventoryCatalogue.id }).from(inventoryCatalogue).where(eq(inventoryCatalogue.itemCode, itemCode)).limit(1);
          const [donor] = await db.select({ id: donors.id }).from(donors).where(eq(donors.code, donorCode)).limit(1);
          if (!site || !item || !donor) continue;

          let [ctn] = await db.select({ id: commodityTrackingNumbers.id }).from(commodityTrackingNumbers).where(eq(commodityTrackingNumbers.ctnCode, ctnCode)).limit(1);
          if (!ctn) {
            [ctn] = await db
              .insert(commodityTrackingNumbers)
              .values({
                ctnCode,
                donorId: donor.id,
                itemId: item.id,
                unit: String(row.data.unit_type ?? "pieces"),
                originalQuantity: Math.max(0, safeNumber(row.data.quantity_in ?? row.data.quantity_out ?? 0)),
                status: "active",
                notes: "Created during import draft finalization",
              })
              .returning({ id: commodityTrackingNumbers.id });
          }
          const stockCardId = await ensureStockCardForCtnAtLocation(db, { ctnId: ctn.id, locationId: site.id });
          const prev = await stockCardNet(stockCardId);
          const qtyIn = Math.max(0, safeNumber(row.data.quantity_in));
          const qtyOut = Math.max(0, safeNumber(row.data.quantity_out));
          await db.insert(stockMovements).values({
            stockCardId,
            date: String(row.data.date ?? new Date().toISOString().slice(0, 10)),
            documentRef: String(row.data.document_ref ?? "IMPORT"),
            fromTo: row.data.from_to ? String(row.data.from_to) : null,
            quantityIn: qtyIn,
            quantityOut: qtyOut,
            balanceAfter: prev + qtyIn - qtyOut,
            remarks: row.data.remarks ? String(row.data.remarks) : "Imported from draft",
            sourceType: "import",
            createdBy: ctx.user.id,
          });
        }
        await db
          .update(inventoryImportDrafts)
          .set({ status: "finalized", validationStatus: "valid", updatedAt: new Date() })
          .where(eq(inventoryImportDrafts.id, input.id));
        return { success: true as const };
      }),
    }),
  }),

  requisitions: router({
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          priority: z.enum(["emergency", "urgent", "routine"]).default("routine"),
          requestingFacility: z.number(),
          justification: z.string().min(1),
          incidentReference: z.string().optional(),
          affectedPopulation: z.number().optional(),
          items: z.array(z.object({ catalogueId: z.number(), quantity: z.number().positive(), urgency: z.string().optional(), notes: z.string().optional() })).min(1),
          suggestedWarehouseId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const reqNumber = await nextRequisitionNumber();
        const [created] = await db
          .insert(requisitions)
          .values({
            reqNumber,
            title: input.title,
            priority: input.priority,
            requestedBy: ctx.user.id,
            requestingFacility: input.requestingFacility,
            justification: input.justification,
            incidentReference: input.incidentReference ?? null,
            affectedPopulation: input.affectedPopulation ?? null,
            items: input.items,
            suggestedWarehouseId: input.suggestedWarehouseId ?? null,
          })
          .returning();
        return created;
      }),

    submit: protectedProcedure.input(z.object({ requisitionId: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const [req] = await db.select().from(requisitions).where(eq(requisitions.id, input.requisitionId)).limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Requisition not found." });
      if (req.requestedBy !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await db.update(requisitions).set({ status: "submitted", updatedAt: new Date() }).where(eq(requisitions.id, req.id));
      return { success: true as const };
    }),

    approveBranch: protectedProcedure.input(z.object({ requisitionId: z.number() })).mutation(async ({ input, ctx }) => {
      requireRole(ctx, ["manager", "admin"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      await db
        .update(requisitions)
        .set({ status: "branch_approved", approvedBranchBy: ctx.user.id, approvedBranchAt: new Date(), updatedAt: new Date() })
        .where(eq(requisitions.id, input.requisitionId));
      await sendRequisitionStatusEmailToSubmitter({
        requisitionId: input.requisitionId,
        statusRaw: "branch_approved",
        approver: { name: ctx.user.name, email: ctx.user.email },
      });
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.REQUISITION_APPROVE_BRANCH,
        entityType: "requisition",
        entityId: input.requisitionId,
        changes: { status: "branch_approved", approverId: ctx.user.id },
        req: ctx.req,
      });
      return { success: true as const };
    }),

    approveHq: protectedProcedure.input(z.object({ requisitionId: z.number() })).mutation(async ({ input, ctx }) => {
      requireRole(ctx, ["admin"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      await db
        .update(requisitions)
        .set({ status: "hq_approved", approvedHqBy: ctx.user.id, approvedHqAt: new Date(), updatedAt: new Date() })
        .where(eq(requisitions.id, input.requisitionId));
      await sendRequisitionStatusEmailToSubmitter({
        requisitionId: input.requisitionId,
        statusRaw: "hq_approved",
        approver: { name: ctx.user.name, email: ctx.user.email },
      });
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.REQUISITION_APPROVE_HQ,
        entityType: "requisition",
        entityId: input.requisitionId,
        changes: { status: "hq_approved", approverId: ctx.user.id },
        req: ctx.req,
      });
      return { success: true as const };
    }),

    reject: protectedProcedure
      .input(z.object({ requisitionId: z.number(), reason: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        await db
          .update(requisitions)
          .set({ status: "rejected", rejectedBy: ctx.user.id, rejectionReason: input.reason, updatedAt: new Date() })
          .where(eq(requisitions.id, input.requisitionId));
        await sendRequisitionStatusEmailToSubmitter({
          requisitionId: input.requisitionId,
          statusRaw: "rejected",
          approver: { name: ctx.user.name, email: ctx.user.email },
        });
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.REQUISITION_REJECT,
          entityType: "requisition",
          entityId: input.requisitionId,
          changes: { status: "rejected", approverId: ctx.user.id, reason: input.reason },
          req: ctx.req,
        });
        return { success: true as const };
      }),

    fulfill: protectedProcedure
      .input(z.object({ requisitionId: z.number(), fromWarehouseId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [req] = await db.select().from(requisitions).where(eq(requisitions.id, input.requisitionId)).limit(1);
        if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Requisition not found." });
        assertRecordFacilityAccess(ctx.user, req.requestingFacility);
        assertFacilityAccess(ctx.user, input.fromWarehouseId);
        if (req.status !== "hq_approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Requisition must be HQ approved." });
        }

        const items = Array.isArray(req.items)
          ? (req.items as Array<{ catalogueId: number; quantity: number; notes?: string }>)
          : [];
        if (items.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Requisition has no line items." });
        }

        for (const item of items) {
          const onHand = await itemWarehouseNet(item.catalogueId, input.fromWarehouseId);
          if (Number(onHand) < Number(item.quantity)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Insufficient stock for catalogue item ${item.catalogueId}: need ${item.quantity}, have ${onHand}.`,
            });
          }
        }

        const [requestingSite] = await db
          .select({ name: sites.name, facilityType: sites.facilityType })
          .from(sites)
          .where(eq(sites.id, req.requestingFacility))
          .limit(1);
        if (!requestingSite) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Requesting facility not found." });
        }

        const today = new Date().toISOString().slice(0, 10);
        const fulfillerName = ctx.user.name || `User #${ctx.user.id}`;
        const wbNumber = await nextWaybillNumber(input.fromWarehouseId);
        const destinationType =
          requestingSite.facilityType === "warehouse" ? ("branch_store" as const) : ("other" as const);

        const [createdWaybill] = await db
          .insert(waybills)
          .values({
            wbNumber,
            docType: "waybill",
            date: today,
            warehouseId: input.fromWarehouseId,
            destinationType,
            destinationBeneficiary: requestingSite.name,
            destinationLocation: `${req.reqNumber} — ${req.title}`,
            requisitionId: req.id,
            loadedByName: fulfillerName,
            loadedByDate: today,
            transportedByName: fulfillerName,
            transportedByDate: today,
            comments: `Fulfillment for ${req.reqNumber}`,
            status: "draft",
            createdBy: ctx.user.id,
          })
          .returning();

        for (let index = 0; index < items.length; index += 1) {
          const item = items[index]!;
          const [cat] = await db
            .select({ name: inventoryCatalogue.name, unitOfMeasure: inventoryCatalogue.unitOfMeasure })
            .from(inventoryCatalogue)
            .where(eq(inventoryCatalogue.id, item.catalogueId))
            .limit(1);
          if (!cat) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Catalogue item ${item.catalogueId} not found.` });
          }

          let ctnSources: Array<{ ctnId: number; quantity: number }>;
          try {
            ctnSources = await pickFefoCtnSources(db, {
              itemId: item.catalogueId,
              warehouseId: input.fromWarehouseId,
              quantity: Number(item.quantity),
              todayIso: today,
            });
          } catch (error) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error instanceof Error ? error.message : "FEFO allocation failed.",
            });
          }

          const [createdLine] = await db
            .insert(waybillLines)
            .values({
              waybillId: createdWaybill.id,
              itemId: item.catalogueId,
              itemDescription: cat.name,
              ctnId: ctnSources[0]!.ctnId,
              nbOfUnits: Number(item.quantity),
              unitType: cat.unitOfMeasure || "pieces",
              requisitionLineId: String(index),
              remarks: item.notes ?? null,
              lineOrder: index,
            })
            .returning();

          await db.insert(waybillLineCtnSources).values(
            ctnSources.map((source, sourceIndex) => ({
              waybillLineId: createdLine.id,
              ctnId: source.ctnId,
              quantity: source.quantity,
              sourceOrder: sourceIndex,
            }))
          );
        }

        const dispatchCtx = await loadWaybillDispatchContext(db, createdWaybill.id);
        try {
          await validateWaybillDispatch(db, dispatchCtx);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Waybill dispatch validation failed.",
          });
        }

        const { lineItemIds } = await dispatchWaybillLedger(db, dispatchCtx, { createdBy: ctx.user.id });
        for (const itemId of lineItemIds) {
          await checkStockThreshold({
            catalogueId: itemId,
            warehouseId: input.fromWarehouseId,
            relatedEntityId: createdWaybill.id,
          });
        }

        await db
          .update(requisitions)
          .set({
            status: "fulfilled",
            fulfilledAt: new Date(),
            linkedWaybills: [createdWaybill.wbNumber],
            updatedAt: new Date(),
          })
          .where(eq(requisitions.id, req.id));

        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.REQUISITION_FULFILL,
          entityType: "requisition",
          entityId: req.id,
          changes: {
            waybillId: createdWaybill.id,
            wbNumber: createdWaybill.wbNumber,
            fromWarehouseId: input.fromWarehouseId,
            lineCount: items.length,
          },
          req: ctx.req,
        });

        await sendRequisitionStatusEmailToSubmitter({
          requisitionId: req.id,
          statusRaw: "fulfilled",
          approver: { name: ctx.user.name, email: ctx.user.email },
        });

        return {
          success: true as const,
          waybillNumber: createdWaybill.wbNumber,
          waybillId: createdWaybill.id,
        };
      }),

    cancel: protectedProcedure.input(z.object({ requisitionId: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const [req] = await db.select().from(requisitions).where(eq(requisitions.id, input.requisitionId)).limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Requisition not found." });
      if (req.requestedBy !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (["branch_approved", "hq_approved", "fulfilled"].includes(req.status ?? "")) throw new TRPCError({ code: "BAD_REQUEST" });
      await db.update(requisitions).set({ status: "cancelled", updatedAt: new Date() }).where(eq(requisitions.id, req.id));
      await sendRequisitionStatusEmailToSubmitter({
        requisitionId: req.id,
        statusRaw: "cancelled",
        approver: { name: ctx.user.name, email: ctx.user.email },
      });
      return { success: true as const };
    }),

    listMine: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(25) }).optional())
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        if (!database) return [];
        const lim = input?.limit ?? 25;
        return database
          .select()
          .from(requisitions)
          .where(eq(requisitions.requestedBy, ctx.user.id))
          .orderBy(desc(requisitions.createdAt))
          .limit(lim);
      }),

    list: protectedProcedure
      .input(
        z
          .object({
            status: z.string().optional(),
            priority: z.string().optional(),
            facilityId: z.number().optional(),
            search: z.string().optional(),
          })
          .merge(listPaginationInput)
          .optional()
      )
      .query(async ({ input, ctx }) => {
        const scopedFacilityId = enforceFacilityScope(ctx.user, input?.facilityId);
        if (scopedFacilityId === -1) return [];

        const db = await getDb();
        if (!db) return [];
        const filters = [];
        if (input?.status) filters.push(eq(requisitions.status, input.status));
        if (input?.priority) filters.push(eq(requisitions.priority, input.priority));
        if (scopedFacilityId != null && scopedFacilityId > 0) {
          filters.push(eq(requisitions.requestingFacility, scopedFacilityId));
        }
        if (input?.search?.trim()) filters.push(ilike(requisitions.title, `%${input.search.trim()}%`));
        const limit = resolveListLimit(input?.limit);
        const offset = resolveListOffset(input?.offset);
        return db
          .select()
          .from(requisitions)
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(desc(requisitions.createdAt))
          .limit(limit)
          .offset(offset);
      }),

    get: protectedProcedure.input(z.object({ requisitionId: z.number() })).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const [req] = await db.select().from(requisitions).where(eq(requisitions.id, input.requisitionId)).limit(1);
      if (!req) return null;
      assertRecordFacilityAccess(ctx.user, req.requestingFacility);
      return req;
    }),

    suggestWarehouse: protectedProcedure.input(z.object({ requisitionId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [req] = await db.select().from(requisitions).where(eq(requisitions.id, input.requisitionId)).limit(1);
      if (!req) return null;
      const items = Array.isArray(req.items) ? (req.items as Array<{ catalogueId: number; quantity: number }>) : [];
      const warehouses = await db.select().from(sites).where(eq(sites.facilityType, "warehouse"));
      for (const wh of warehouses) {
        let ok = true;
        for (const item of items) {
          const onHand = await itemWarehouseNet(item.catalogueId, wh.id);
          if (Number(onHand) < Number(item.quantity)) {
            ok = false;
            break;
          }
        }
        if (ok) return wh;
      }
      return null;
    }),
    downloadPdf: protectedProcedure
      .input(z.object({ requisitionId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [req] = await db.select().from(requisitions).where(eq(requisitions.id, input.requisitionId)).limit(1);
        if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Requisition not found." });
        const rows = [
          { label: "Requisition Number", value: req.reqNumber },
          { label: "Title", value: req.title },
          { label: "Status", value: req.status ?? "draft" },
          { label: "Priority", value: req.priority ?? "routine" },
          { label: "Justification", value: req.justification },
        ];
        const buffer = await generateRequisitionPdf({ rows });
        return {
          data: buffer.toString("base64"),
          filename: `${req.reqNumber}.pdf`,
          mimeType: "application/pdf",
        };
      }),
  }),

  distributions: router({
    create: protectedProcedure
      .input(
        z.object({
          waybillId: z.number().optional(),
          incidentReference: z.string().optional(),
          distributionDate: z.string(),
          location: z.string().min(1),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          locationType: z.string().optional(),
          beneficiaryCount: z.number().optional(),
          householdCount: z.number().optional(),
          maleCount: z.number().optional(),
          femaleCount: z.number().optional(),
          childrenCount: z.number().optional(),
          elderlyCount: z.number().optional(),
          pwdCount: z.number().optional(),
          itemsDistributed: z.array(z.object({ catalogueId: z.number(), quantityPerHousehold: z.number().optional(), totalQuantity: z.number().optional() })).optional(),
          teamMembers: z.array(z.number()).optional(),
          observers: z.string().optional(),
          photos: z.array(z.string()).optional(),
          notes: z.string().optional(),
          challenges: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const distributionNumber = await nextDistributionNumber();
        const [created] = await db.insert(distributions).values({ ...input, distributionNumber, conductedBy: ctx.user.id }).returning();
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.INVENTORY_DISTRIBUTION,
          entityType: "distribution",
          entityId: created.id,
          changes: {
            distributionNumber: created.distributionNumber,
            location: created.location,
            waybillId: created.waybillId ?? null,
            beneficiaryCount: created.beneficiaryCount ?? null,
          },
          req: ctx.req,
        });
        return created;
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), notes: z.string().optional(), challenges: z.string().optional(), beneficiaryList: z.any().optional(), photos: z.array(z.string()).optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const { id, ...updates } = input;
        const [updated] = await db.update(distributions).set(updates).where(eq(distributions.id, id)).returning();
        return updated ?? null;
      }),

    list: protectedProcedure
      .input(z.object({ incidentReference: z.string().optional(), location: z.string().optional(), conductedBy: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(distributions)
          .where(
            and(
              input?.incidentReference ? ilike(distributions.incidentReference, `%${input.incidentReference}%`) : undefined,
              input?.location ? ilike(distributions.location, `%${input.location}%`) : undefined,
              input?.conductedBy ? eq(distributions.conductedBy, input.conductedBy) : undefined
            )
          )
          .orderBy(desc(distributions.createdAt));
      }),

    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(distributions).where(eq(distributions.id, input.id)).limit(1);
      return row ?? null;
    }),

    report: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { totalDistributions: 0, beneficiaries: 0, households: 0 };
      const rows = await db.select().from(distributions);
      return {
        totalDistributions: rows.length,
        beneficiaries: rows.reduce((a, r) => a + Number(r.beneficiaryCount ?? 0), 0),
        households: rows.reduce((a, r) => a + Number(r.householdCount ?? 0), 0),
      };
    }),

    importBeneficiaries: protectedProcedure
      .input(z.object({ distributionId: z.number(), csvData: z.string() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const lines = input.csvData.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        const headers = parseCsvLine(lines[0]).map((x) => x.toLowerCase());
        const out = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            row[h] = cols[idx] ?? "";
          });
          out.push(row);
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        await db.update(distributions).set({ beneficiaryList: out }).where(eq(distributions.id, input.distributionId));
        return { imported: out.length };
      }),
    downloadPdf: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [row] = await db.select().from(distributions).where(eq(distributions.id, input.id)).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Distribution not found." });
        const rows = [
          { label: "Distribution Number", value: row.distributionNumber },
          { label: "Date", value: row.distributionDate },
          { label: "Location", value: row.location },
          { label: "Beneficiaries", value: row.beneficiaryCount ?? 0 },
          { label: "Households", value: row.householdCount ?? 0 },
          { label: "Incident", value: row.incidentReference ?? "—" },
        ];
        const buffer = await generateDistributionReportPdf({ rows });
        return {
          data: buffer.toString("base64"),
          filename: `${row.distributionNumber}.pdf`,
          mimeType: "application/pdf",
        };
      }),
  }),

  kits: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(inventoryKits).orderBy(asc(inventoryKits.name));
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(inventoryKits).where(eq(inventoryKits.id, input.id)).limit(1);
      return row ?? null;
    }),
    create: protectedProcedure
      .input(z.object({ kitCode: z.string().min(1), name: z.string().min(1), description: z.string().optional(), kitType: z.string().optional(), catalogueId: z.number().optional(), components: z.array(z.object({ catalogueId: z.number(), quantity: z.number().positive(), unit: z.string().optional(), isOptional: z.boolean().optional(), notes: z.string().optional() })), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [created] = await db.insert(inventoryKits).values(input).returning();
        return created;
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), kitType: z.string().optional(), catalogueId: z.number().optional(), components: z.array(z.object({ catalogueId: z.number(), quantity: z.number() })).optional(), isActive: z.boolean().optional(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const { id, ...updates } = input;
        const [updated] = await db.update(inventoryKits).set({ ...updates, updatedAt: new Date() }).where(eq(inventoryKits.id, id)).returning();
        return updated ?? null;
      }),
    assemble: protectedProcedure
      .input(z.object({ kitId: z.number(), warehouseId: z.number(), quantity: z.number().int().positive(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [kit] = await db.select().from(inventoryKits).where(eq(inventoryKits.id, input.kitId)).limit(1);
        if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Kit not found." });
        assertFacilityAccess(ctx.user, input.warehouseId);
        const components = Array.isArray(kit.components) ? (kit.components as Array<{ catalogueId: number; quantity: number }>) : [];
        const blendedDonorCode = "BLENDED";
        const [blendedDonor] = await db
          .select({ id: donors.id })
          .from(donors)
          .where(eq(donors.code, blendedDonorCode))
          .limit(1);
        if (!blendedDonor) throw new TRPCError({ code: "BAD_REQUEST", message: "BLENDED donor is missing." });

        const consumedContributors: Array<{ componentCtnId: number; componentDonorId: number; quantityConsumed: number; assemblyEventId: number }> = [];
        const distinctDonors = new Set<number>();

        for (const comp of components) {
          const required = Number(comp.quantity) * Number(input.quantity);
          const stockCardsForItem = await db
            .select({
              stockCardId: stockCards.id,
              ctnId: stockCards.ctnId,
              donorId: commodityTrackingNumbers.donorId,
            })
            .from(stockCards)
            .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
            .where(and(eq(stockCards.locationId, input.warehouseId), eq(commodityTrackingNumbers.itemId, comp.catalogueId)));

          let remaining = required;
          for (const card of stockCardsForItem) {
            if (remaining <= 0) break;
            const balance = await stockCardNet(card.stockCardId);
            if (balance <= 0) continue;
            const consume = Math.min(balance, remaining);
            const next = balance - consume;
            const [movement] = await db
              .insert(stockMovements)
              .values({
                stockCardId: card.stockCardId,
                date: new Date().toISOString().slice(0, 10),
                fromTo: `kit:${kit.kitCode}`,
                quantityIn: 0,
                quantityOut: consume,
                balanceAfter: next,
                sourceType: "kit_assembly",
                remarks: input.notes ?? null,
                createdBy: ctx.user.id,
              })
              .returning({ id: stockMovements.id });
            consumedContributors.push({
              componentCtnId: card.ctnId,
              componentDonorId: card.donorId,
              quantityConsumed: consume,
              assemblyEventId: movement.id,
            });
            distinctDonors.add(card.donorId);
            remaining -= consume;
          }
          if (remaining > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient components for kit assembly." });
        }

        if (kit.catalogueId) {
          const kitCtnCode = `KIT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
          const [kitCtn] = await db
            .insert(commodityTrackingNumbers)
            .values({
              ctnCode: kitCtnCode,
              donorId: distinctDonors.size === 1 ? Array.from(distinctDonors)[0]! : blendedDonor.id,
              itemId: kit.catalogueId,
              unit: "pieces",
              originalQuantity: input.quantity,
              notes: "Generated from kit assembly",
              status: "active",
            })
            .returning();
          const kitStockCardId = await ensureStockCardForCtnAtLocation(db, { ctnId: kitCtn.id, locationId: input.warehouseId });
          const prevKitBalance = await stockCardNet(kitStockCardId);
          const [kitInMovement] = await db
            .insert(stockMovements)
            .values({
              stockCardId: kitStockCardId,
              date: new Date().toISOString().slice(0, 10),
              fromTo: "kit_assembly",
              quantityIn: input.quantity,
              quantityOut: 0,
              balanceAfter: prevKitBalance + input.quantity,
              sourceType: "kit_assembly",
              remarks: input.notes ?? null,
              createdBy: ctx.user.id,
            })
            .returning({ id: stockMovements.id });

          await db.insert(kitCtnContributors).values(
            consumedContributors.map((row) => ({
              kitCtnId: kitCtn.id,
              componentCtnId: row.componentCtnId,
              componentDonorId: row.componentDonorId,
              quantityConsumed: row.quantityConsumed,
              assemblyEventId: row.assemblyEventId || kitInMovement.id,
            }))
          );
        }
        await db.insert(kitAssemblies).values({ kitId: kit.id, warehouseId: input.warehouseId, direction: "assemble", quantity: input.quantity, performedBy: ctx.user.id, notes: input.notes ?? null });
        return { success: true as const };
      }),
    disassemble: protectedProcedure
      .input(z.object({ kitId: z.number(), warehouseId: z.number(), quantity: z.number().int().positive(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [kit] = await db.select().from(inventoryKits).where(eq(inventoryKits.id, input.kitId)).limit(1);
        if (!kit || !kit.catalogueId) throw new TRPCError({ code: "NOT_FOUND", message: "Kit not found." });
        assertFacilityAccess(ctx.user, input.warehouseId);
        const [kitBalanceAgg] = await db
          .select({
            qty: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .where(and(eq(stockCards.locationId, input.warehouseId), eq(commodityTrackingNumbers.itemId, kit.catalogueId)));
        if (Number(kitBalanceAgg?.qty ?? 0) < input.quantity) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient kit stock." });
        }
        const components = Array.isArray(kit.components) ? (kit.components as Array<{ catalogueId: number; quantity: number }>) : [];
        const [blendedDonor] = await db.select({ id: donors.id }).from(donors).where(eq(donors.code, "BLENDED")).limit(1);
        if (!blendedDonor) throw new TRPCError({ code: "BAD_REQUEST", message: "BLENDED donor is missing." });
        for (const comp of components) {
          const add = Number(comp.quantity) * Number(input.quantity);
          const recoveredCtnCode = `RCV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}-${comp.catalogueId}`;
          const [recoveredCtn] = await db
            .insert(commodityTrackingNumbers)
            .values({
              ctnCode: recoveredCtnCode,
              donorId: blendedDonor.id,
              itemId: comp.catalogueId,
              unit: "pieces",
              originalQuantity: add,
              notes: "Recovered by kit disassembly",
              status: "active",
            })
            .returning();
          const stockCardId = await ensureStockCardForCtnAtLocation(db, { ctnId: recoveredCtn.id, locationId: input.warehouseId });
          const prev = await stockCardNet(stockCardId);
          await db.insert(stockMovements).values({
            stockCardId,
            date: new Date().toISOString().slice(0, 10),
            fromTo: `kit:${kit.kitCode}`,
            quantityIn: add,
            quantityOut: 0,
            balanceAfter: prev + add,
            sourceType: "kit_disassembly",
            remarks: input.notes ?? null,
            createdBy: ctx.user.id,
          });
        }
        await db.insert(kitAssemblies).values({ kitId: kit.id, warehouseId: input.warehouseId, direction: "disassemble", quantity: input.quantity, performedBy: ctx.user.id, notes: input.notes ?? null });
        return { success: true as const };
      }),
    issueAsKit: protectedProcedure
      .input(z.object({ kitId: z.number(), fromWarehouseId: z.number(), quantity: z.number().int().positive(), destination: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [kit] = await db.select().from(inventoryKits).where(eq(inventoryKits.id, input.kitId)).limit(1);
        if (!kit || !kit.catalogueId) throw new TRPCError({ code: "NOT_FOUND", message: "Kit not found." });
        const waybill = await nextDocumentNumber("WB");
        const [doc] = await db
          .insert(inventoryDocuments)
          .values({
            documentType: "waybill",
            documentNumber: waybill,
            status: "dispatched",
            fromWarehouseId: input.fromWarehouseId,
            items: [{ catalogueId: kit.catalogueId, quantity: input.quantity, notes: input.destination }],
            notes: `Issued as kit ${kit.kitCode}`,
            createdBy: ctx.user.id,
            approvedBy: ctx.user.id,
            completedAt: new Date(),
          })
          .returning();
        return { success: true as const, documentNumber: doc.documentNumber };
      }),
  }),

  parseExcelSheet: protectedProcedure
    .input(z.object({ base64: z.string() }))
    .mutation(async ({ input }) => {
      const wb = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(Buffer.from(input.base64, "base64") as any);
      const ws = wb.worksheets[0];
      if (!ws) return [] as Record<string, unknown>[];
      const headers: string[] = [];
      const rows: Record<string, unknown>[] = [];
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const values = (row.values as unknown[]).slice(1).map((c) => (c == null ? "" : c));
        if (rowNumber === 1) {
          values.forEach((v) => headers.push(String(v ?? "")));
        } else {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            obj[h] = values[i] ?? "";
          });
          rows.push(obj);
        }
      });
      return rows;
    }),

  reports: router({
    monthlyWarehouseReport: protectedProcedure
      .input(z.object({ warehouseId: z.number().int().positive(), year: z.number().int(), month: z.number().int().min(1).max(12) }))
      .query(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) return [];
        return buildMonthlyWarehouseReport(db, input);
      }),

    monthlyWarehouseReportPdf: protectedProcedure
      .input(z.object({ warehouseId: z.number().int().positive(), year: z.number().int(), month: z.number().int().min(1).max(12) }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [header, rows] = await Promise.all([
          monthlyReportHeader(db, input.warehouseId, input.year, input.month),
          buildMonthlyWarehouseReport(db, input),
        ]);
        const buffer = await generatePDFReport(
          "WAREHOUSE - MONTHLY REPORT",
          rows,
          monthlyReportColumns(),
          { subtitle: `${header.warehouseName} | MONTH: ${header.monthLabel}` }
        );
        return {
          data: buffer.toString("base64"),
          filename: `monthly-warehouse-report-${input.year}-${String(input.month).padStart(2, "0")}.pdf`,
          mimeType: "application/pdf",
        };
      }),

    monthlyWarehouseReportExcel: protectedProcedure
      .input(z.object({ warehouseId: z.number().int().positive(), year: z.number().int(), month: z.number().int().min(1).max(12) }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [header, rows] = await Promise.all([
          monthlyReportHeader(db, input.warehouseId, input.year, input.month),
          buildMonthlyWarehouseReport(db, input),
        ]);
        const buffer = await generateExcelReport(
          `WAREHOUSE - MONTHLY REPORT (${header.monthLabel})`,
          rows,
          monthlyReportColumns(),
          { sheetName: "Monthly Warehouse Report" }
        );
        return {
          data: buffer.toString("base64"),
          filename: `monthly-warehouse-report-${input.year}-${String(input.month).padStart(2, "0")}.xlsx`,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }),

    monthlyWarehouseReportEmail: protectedProcedure
      .input(
        z.object({
          warehouseId: z.number().int().positive(),
          year: z.number().int(),
          month: z.number().int().min(1).max(12),
          recipients: z.array(z.string().email()).min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [header] = await Promise.all([monthlyReportHeader(db, input.warehouseId, input.year, input.month)]);
        const emailService = createEmailService();
        const html = `
          <h2>NIGERIAN RED CROSS SOCIETY</h2>
          <p><strong>WAREHOUSE - MONTHLY REPORT</strong></p>
          <p>Warehouse: ${header.warehouseName}</p>
          <p>Month: ${header.monthLabel}</p>
          <p>The monthly warehouse report is ready in the system export actions.</p>
        `;
        let sent = 0;
        for (const to of input.recipients) {
          const ok = await emailService.send({
            type: "monthly_report_generated",
            to,
            subject: `NRCS Warehouse Monthly Report - ${header.monthLabel}`,
            html,
          });
          if (ok) sent += 1;
        }
        return { sent, failed: input.recipients.length - sent };
      }),

    wmsStockMovements: protectedProcedure
      .input(
        z.object({
          warehouseId: z.number().int().positive().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          search: z.string().optional(),
          sourceType: z.string().optional(),
          direction: z.enum(["in", "out", "all"]).default("all").optional(),
        }).optional()
      )
      .query(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) return [];
        return db
          .select({
            date: stockMovements.date,
            documentRef: stockMovements.documentRef,
            item: inventoryCatalogue.name,
            ctn: commodityTrackingNumbers.ctnCode,
            donor: donors.code,
            warehouse: sites.name,
            fromTo: stockMovements.fromTo,
            qtyIn: stockMovements.quantityIn,
            qtyOut: stockMovements.quantityOut,
            balanceAfter: stockMovements.balanceAfter,
            sourceType: stockMovements.sourceType,
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
          .innerJoin(donors, eq(commodityTrackingNumbers.donorId, donors.id))
          .innerJoin(sites, eq(stockCards.locationId, sites.id))
          .where(
            and(
              input?.warehouseId ? eq(stockCards.locationId, input.warehouseId) : undefined,
              input?.startDate ? gte(stockMovements.date, input.startDate) : undefined,
              input?.endDate ? lte(stockMovements.date, input.endDate) : undefined,
              input?.sourceType ? eq(stockMovements.sourceType, input.sourceType as any) : undefined,
              input?.search ? or(ilike(inventoryCatalogue.name, `%${input.search}%`), ilike(commodityTrackingNumbers.ctnCode, `%${input.search}%`)) : undefined,
              input?.direction === "in" ? sql`${stockMovements.quantityIn} > 0` : undefined,
              input?.direction === "out" ? sql`${stockMovements.quantityOut} > 0` : undefined
            )
          )
          .orderBy(desc(stockMovements.date), desc(stockMovements.id));
      }),

    ctnAging: protectedProcedure
      .query(async ({ ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) return [];
        const today = new Date();
        const rows = await db
          .select({
            ctnCode: commodityTrackingNumbers.ctnCode,
            item: inventoryCatalogue.name,
            donor: donors.code,
            warehouse: sites.name,
            expiryDate: stockCards.expiryDate,
            balance: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
          })
          .from(stockCards)
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
          .innerJoin(donors, eq(commodityTrackingNumbers.donorId, donors.id))
          .innerJoin(sites, eq(stockCards.locationId, sites.id))
          .leftJoin(stockMovements, eq(stockMovements.stockCardId, stockCards.id))
          .groupBy(commodityTrackingNumbers.ctnCode, inventoryCatalogue.name, donors.code, sites.name, stockCards.expiryDate);
        return rows.map((row) => {
          const daysUntilExpiry = row.expiryDate ? Math.ceil((new Date(row.expiryDate).getTime() - today.getTime()) / 86400000) : null;
          const color = daysUntilExpiry == null ? "green" : daysUntilExpiry > 90 ? "green" : daysUntilExpiry >= 30 ? "amber" : "red";
          return { ...row, daysUntilExpiry, color };
        });
      }),

    lossDamage: protectedProcedure
      .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
      .query(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) return [];
        return db
          .select({
            date: stockMovements.date,
            item: inventoryCatalogue.name,
            ctn: commodityTrackingNumbers.ctnCode,
            donor: donors.code,
            warehouse: sites.name,
            qty: stockMovements.quantityOut,
            sourceType: stockMovements.sourceType,
            documentRef: stockMovements.documentRef,
            reason: stockMovements.remarks,
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
          .innerJoin(donors, eq(commodityTrackingNumbers.donorId, donors.id))
          .innerJoin(sites, eq(stockCards.locationId, sites.id))
          .where(
            and(
              input?.startDate ? gte(stockMovements.date, input.startDate) : undefined,
              input?.endDate ? lte(stockMovements.date, input.endDate) : undefined,
              sql`(${stockMovements.sourceType} = 'expiry' or ${stockMovements.sourceType} = 'adjustment')`,
              sql`${stockMovements.quantityOut} > 0`
            )
          )
          .orderBy(desc(stockMovements.date), desc(stockMovements.id));
      }),

    donorContributionPreview: protectedProcedure
      .input(z.object({ kitCtnId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const totals = await expandKitDonorContribution(db, input.kitCtnId);
        return Array.from(totals.entries()).map(([donorId, totalUnits]) => ({ donorId, totalUnits }));
      }),

    donorContribution: protectedProcedure
      .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
      .query(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) return [];

        const donorMap = new Map<string, { donor: string; item: string; received: number; distributed: number; inStock: number }>();
        const movementRows = await db
          .select({
            stockCardId: stockMovements.stockCardId,
            sourceType: stockMovements.sourceType,
            quantityIn: stockMovements.quantityIn,
            quantityOut: stockMovements.quantityOut,
            date: stockMovements.date,
            ctnId: stockCards.ctnId,
            item: inventoryCatalogue.name,
            donorCode: donors.code,
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
          .innerJoin(donors, eq(commodityTrackingNumbers.donorId, donors.id))
          .where(
            and(
              input?.startDate ? gte(stockMovements.date, input.startDate) : undefined,
              input?.endDate ? lte(stockMovements.date, input.endDate) : undefined
            )
          );

        for (const row of movementRows) {
          const donorsExpanded = row.donorCode === "BLENDED"
            ? await expandKitDonorContribution(db, row.ctnId)
            : new Map<number, number>();

          if (donorsExpanded.size > 0) {
            for (const [donorId, units] of Array.from(donorsExpanded.entries())) {
              const [donor] = await db.select({ code: donors.code }).from(donors).where(eq(donors.id, donorId)).limit(1);
              const key = `${donor?.code ?? "UNKNOWN"}:${row.item}`;
              const entry = donorMap.get(key) ?? { donor: donor?.code ?? "UNKNOWN", item: row.item, received: 0, distributed: 0, inStock: 0 };
              if (row.sourceType === "grn") entry.received += Number(units);
              if (row.sourceType === "waybill") entry.distributed += Number(units);
              entry.inStock = Math.max(0, entry.received - entry.distributed);
              donorMap.set(key, entry);
            }
            continue;
          }

          const key = `${row.donorCode}:${row.item}`;
          const entry = donorMap.get(key) ?? { donor: row.donorCode, item: row.item, received: 0, distributed: 0, inStock: 0 };
          if (row.sourceType === "grn") entry.received += Number(row.quantityIn);
          if (row.sourceType === "waybill") entry.distributed += Number(row.quantityOut);
          entry.inStock = Math.max(0, entry.received - entry.distributed);
          donorMap.set(key, entry);
        }

        return Array.from(donorMap.values()).map((row) => ({
          ...row,
          percentDistributed: row.received > 0 ? (row.distributed / row.received) * 100 : 0,
        }));
      }),

    kitAssemblyAudit: protectedProcedure
      .query(async ({ ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) return [];
        const rows = await db
          .select({
            date: stockMovements.date,
            kitCtnCode: commodityTrackingNumbers.ctnCode,
            kitItem: inventoryCatalogue.name,
            qtyAssembled: stockMovements.quantityIn,
            componentCtnId: kitCtnContributors.componentCtnId,
            componentDonorId: kitCtnContributors.componentDonorId,
            createdBy: stockMovements.createdBy,
          })
          .from(kitCtnContributors)
          .innerJoin(commodityTrackingNumbers, eq(kitCtnContributors.kitCtnId, commodityTrackingNumbers.id))
          .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
          .innerJoin(stockCards, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .innerJoin(stockMovements, eq(stockMovements.stockCardId, stockCards.id))
          .where(eq(stockMovements.sourceType, "kit_assembly"))
          .orderBy(desc(stockMovements.date));

        const donorIds = Array.from(new Set(rows.map((row) => row.componentDonorId).filter((x): x is number => typeof x === "number")));
        const donorRows = donorIds.length
          ? await db.select({ id: donors.id, code: donors.code }).from(donors).where(inArray(donors.id, donorIds))
          : [];
        const donorById = new Map<number, string>(donorRows.map((d) => [d.id, d.code]));

        return rows.map((row) => ({
          date: row.date,
          kitItem: row.kitItem,
          kitCtn: row.kitCtnCode,
          qtyAssembled: Number(row.qtyAssembled),
          contributingCtnAndDonor: `${row.componentCtnId ?? "—"} / ${donorById.get(row.componentDonorId ?? -1) ?? "—"}`,
          assemblerName: row.createdBy,
        }));
      }),

    exportReport: protectedProcedure
      .input(
        z.object({
          rows: z.array(z.record(z.string(), z.unknown())),
          sheetName: z.string().default("Report"),
          filename: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet(input.sheetName);
        if (input.rows.length > 0) {
          ws.columns = Object.keys(input.rows[0]!).map((key) => ({ header: key, key }));
          ws.addRows(input.rows as any[]);
        }
        const buf = await wb.xlsx.writeBuffer();
        return { base64: Buffer.from(buf).toString("base64") };
      }),

    expiryWms: protectedProcedure
      .input(z.object({ days: z.number().default(365) }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const today = new Date();
        const until = new Date(today.getTime() + (input?.days ?? 365) * 86400000);
        const rows = await db
          .select({
            item: inventoryCatalogue.name,
            ctnCode: commodityTrackingNumbers.ctnCode,
            donor: donors.code,
            location: sites.name,
            balance: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
            expiryDate: stockCards.expiryDate,
          })
          .from(stockCards)
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
          .innerJoin(donors, eq(commodityTrackingNumbers.donorId, donors.id))
          .innerJoin(sites, eq(stockCards.locationId, sites.id))
          .leftJoin(stockMovements, eq(stockMovements.stockCardId, stockCards.id))
          .where(
            lte(stockCards.expiryDate, until.toISOString().slice(0, 10))
          )
          .groupBy(
            inventoryCatalogue.name,
            commodityTrackingNumbers.ctnCode,
            donors.code,
            sites.name,
            stockCards.expiryDate
          )
          .orderBy(asc(stockCards.expiryDate));
        return rows.map((row) => {
          const daysUntilExpiry = row.expiryDate
            ? Math.ceil((new Date(row.expiryDate).getTime() - today.getTime()) / 86400000)
            : null;
          return { ...row, daysUntilExpiry };
        });
      }),

    stockStatus: protectedProcedure
      .input(
        z
          .object({
            warehouseId: z.number().optional(),
            category: categoryEnum.optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) return [];
        const rows = await db
          .select({
            catalogueId: stockSettings.catalogueId,
            warehouseId: stockSettings.warehouseId,
            warehouseName: sites.name,
            category: inventoryCatalogue.category,
            minLevel: stockSettings.minLevel,
            maxLevel: stockSettings.maxLevel,
            safetyStockLevel: stockSettings.safetyStockLevel,
          })
          .from(stockSettings)
          .innerJoin(inventoryCatalogue, eq(stockSettings.catalogueId, inventoryCatalogue.id))
          .innerJoin(sites, eq(stockSettings.warehouseId, sites.id))
          .where(
            and(
              input?.warehouseId ? eq(stockSettings.warehouseId, input.warehouseId) : undefined,
              input?.category ? eq(inventoryCatalogue.category, input.category) : undefined
            )
          );
        const ledgerRows = await db
          .select({
            catalogueId: commodityTrackingNumbers.itemId,
            warehouseId: stockCards.locationId,
            quantityOnHand: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .groupBy(commodityTrackingNumbers.itemId, stockCards.locationId);
        const ledgerMap = new Map(ledgerRows.map((row) => [`${row.catalogueId}:${row.warehouseId}`, Number(row.quantityOnHand ?? 0)]));

        const grouped = new Map<string, any>();
        for (const row of rows) {
          const key = `${row.warehouseId}:${row.category}`;
          const current =
            grouped.get(key) ??
            {
              warehouseId: row.warehouseId,
              warehouseName: row.warehouseName,
              category: row.category,
              belowMinimumCount: 0,
              aboveMaximumCount: 0,
              atSafetyLevelCount: 0,
              outOfStockCount: 0,
              totalInventoryValue: 0,
            };
          const qty = safeNumber(ledgerMap.get(`${row.catalogueId}:${row.warehouseId}`) ?? 0);
          const min = safeNumber(row.minLevel);
          const max = row.maxLevel == null ? null : safeNumber(row.maxLevel);
          const safety = row.safetyStockLevel == null ? null : safeNumber(row.safetyStockLevel);
          const unitCost = 1;
          if (qty <= 0) current.outOfStockCount += 1;
          if (qty < min) current.belowMinimumCount += 1;
          if (max != null && qty > max) current.aboveMaximumCount += 1;
          if (safety != null && qty === safety) current.atSafetyLevelCount += 1;
          current.totalInventoryValue += qty * unitCost;
          grouped.set(key, current);
        }
        return Array.from(grouped.values());
      }),

    stockMovement: protectedProcedure
      .input(
        z.object({
          startDate: z.coerce.date(),
          endDate: z.coerce.date(),
          warehouseId: z.number().int().positive().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) return [];
        return db
          .select({
            id: stockMovements.id,
            date: stockMovements.date,
            stockCardId: stockMovements.stockCardId,
            warehouseId: stockCards.locationId,
            catalogueId: commodityTrackingNumbers.itemId,
            quantityIn: stockMovements.quantityIn,
            quantityOut: stockMovements.quantityOut,
            balanceAfter: stockMovements.balanceAfter,
            sourceType: stockMovements.sourceType,
            fromTo: stockMovements.fromTo,
            documentRef: stockMovements.documentRef,
            remarks: stockMovements.remarks,
            createdBy: stockMovements.createdBy,
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .where(
            and(
              gte(stockMovements.date, input.startDate.toISOString().slice(0, 10)),
              lte(stockMovements.date, input.endDate.toISOString().slice(0, 10)),
              input.warehouseId ? eq(stockCards.locationId, input.warehouseId) : undefined
            )
          )
          .orderBy(desc(stockMovements.date), desc(stockMovements.id));
      }),

    expiryForecast: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx, ["manager", "admin"]);
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          expiryDate: stockCards.expiryDate,
          itemId: commodityTrackingNumbers.itemId,
          warehouseId: stockCards.locationId,
          balance: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
        })
        .from(stockMovements)
        .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
        .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
        .where(sql`${stockCards.expiryDate} is not null`)
        .groupBy(stockCards.expiryDate, commodityTrackingNumbers.itemId, stockCards.locationId)
        .having(sql`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0) > 0`)
        .orderBy(asc(stockCards.expiryDate));
    }),

    distributionSummary: protectedProcedure
      .input(
        z
          .object({
            startDate: z.coerce.date().optional(),
            endDate: z.coerce.date().optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) return null;
        const rows = await db
          .select()
          .from(distributions)
          .where(
            and(
              input?.startDate ? gte(distributions.createdAt, input.startDate) : undefined,
              input?.endDate ? lte(distributions.createdAt, input.endDate) : undefined
            )
          );
        const totalBeneficiaries = rows.reduce((a, r) => a + safeNumber(r.beneficiaryCount), 0);
        const demographics = {
          male: rows.reduce((a, r) => a + safeNumber(r.maleCount), 0),
          female: rows.reduce((a, r) => a + safeNumber(r.femaleCount), 0),
          children: rows.reduce((a, r) => a + safeNumber(r.childrenCount), 0),
          elderly: rows.reduce((a, r) => a + safeNumber(r.elderlyCount), 0),
          pwd: rows.reduce((a, r) => a + safeNumber(r.pwdCount), 0),
        };
        const byLocation = new Map<string, number>();
        const byIncident = new Map<string, number>();
        for (const row of rows) {
          byLocation.set(row.location ?? "Unknown", (byLocation.get(row.location ?? "Unknown") ?? 0) + safeNumber(row.beneficiaryCount));
          byIncident.set(
            row.incidentReference ?? "Unspecified",
            (byIncident.get(row.incidentReference ?? "Unspecified") ?? 0) + safeNumber(row.beneficiaryCount)
          );
        }
        const requisitionRows = await db.select().from(requisitions).where(eq(requisitions.status, "fulfilled"));
        const responseTimeDays = requisitionRows
          .filter((r) => r.fulfilledAt && r.createdAt)
          .map((r) => (new Date(r.fulfilledAt as any).getTime() - new Date(r.createdAt as any).getTime()) / 86400000);
        return {
          totalBeneficiaries,
          demographics,
          distributionsByLocation: Array.from(byLocation.entries()).map(([location, beneficiaries]) => ({ location, beneficiaries })),
          distributionsByIncident: Array.from(byIncident.entries()).map(([incident, beneficiaries]) => ({ incident, beneficiaries })),
          responseTimeDaysAvg:
            responseTimeDays.length > 0
              ? responseTimeDays.reduce((a, b) => a + b, 0) / responseTimeDays.length
              : 0,
        };
      }),

    vedAnalysis: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx, ["manager", "admin"]);
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          ved: inventoryCatalogue.vedClassification,
          catalogueId: stockSettings.catalogueId,
          warehouseId: stockSettings.warehouseId,
          minLevel: stockSettings.minLevel,
          safety: stockSettings.safetyStockLevel,
        })
        .from(stockSettings)
        .innerJoin(inventoryCatalogue, eq(stockSettings.catalogueId, inventoryCatalogue.id));
      const ledgerRows = await db
        .select({
          catalogueId: commodityTrackingNumbers.itemId,
          warehouseId: stockCards.locationId,
          quantityOnHand: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
        })
        .from(stockMovements)
        .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
        .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
        .groupBy(commodityTrackingNumbers.itemId, stockCards.locationId);
      const ledgerMap = new Map(ledgerRows.map((row) => [`${row.catalogueId}:${row.warehouseId}`, Number(row.quantityOnHand ?? 0)]));
      const grouped = new Map<string, { ved: string; count: number; value: number; serviceLevel: number }>();
      for (const row of rows) {
        const key = row.ved ?? "unknown";
        const prev = grouped.get(key) ?? { ved: key, count: 0, value: 0, serviceLevel: 0 };
        const qty = Number(ledgerMap.get(`${row.catalogueId}:${row.warehouseId}`) ?? 0);
        prev.count += 1;
        prev.value += safeNumber(qty);
        const threshold = row.safety == null ? safeNumber(row.minLevel) : safeNumber(row.safety);
        if (safeNumber(qty) >= threshold) prev.serviceLevel += 1;
        grouped.set(key, prev);
      }
      return Array.from(grouped.values()).map((g) => ({
        ...g,
        serviceLevel: g.count > 0 ? (g.serviceLevel / g.count) * 100 : 0,
        recommendation:
          g.ved === "vital"
            ? "Keep higher safety stock"
            : g.ved === "essential"
              ? "Monitor reorder cadence"
              : "Consider lean stock policy",
      }));
    }),

    abcAnalysis: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx, ["manager", "admin"]);
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          itemId: inventoryCatalogue.id,
          itemCode: inventoryCatalogue.itemCode,
          itemName: inventoryCatalogue.name,
          category: inventoryCatalogue.category,
          vedClassification: inventoryCatalogue.vedClassification,
        })
        .from(inventoryCatalogue);
      const outboundRows = await db
        .select({
          itemId: commodityTrackingNumbers.itemId,
          consumed: sql<number>`coalesce(sum(${stockMovements.quantityOut}), 0)`.mapWith(Number),
        })
        .from(stockMovements)
        .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
        .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
        .groupBy(commodityTrackingNumbers.itemId);
      const outboundByItem = new Map<number, number>(outboundRows.map((row) => [row.itemId, safeNumber(row.consumed)]));
      const totals = rows
        .map((row) => ({
          ...row,
          annualConsumptionValue: safeNumber(outboundByItem.get(row.itemId) ?? 0),
        }))
        .sort((a, b) => b.annualConsumptionValue - a.annualConsumptionValue);
      const grandTotal = totals.reduce((sum, row) => sum + row.annualConsumptionValue, 0);
      let running = 0;
      return totals.map((row) => {
        running += row.annualConsumptionValue;
        const cumulativePercent = grandTotal > 0 ? (running / grandTotal) * 100 : 0;
        const abcClass = cumulativePercent <= 70 ? "A" : cumulativePercent <= 90 ? "B" : "C";
        return {
          itemId: row.itemId,
          itemCode: row.itemCode,
          itemName: row.itemName,
          annualConsumptionValue: row.annualConsumptionValue,
          cumulativePercent,
          abcClass,
          vedClassification: row.vedClassification ?? "desirable",
          category: row.category,
        };
      });
    }),

    fnsAnalysis: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx, ["manager", "admin"]);
      const db = await getDb();
      if (!db) return [];
      const movementRows = await db
        .select({
          itemId: commodityTrackingNumbers.itemId,
          itemCode: inventoryCatalogue.itemCode,
          itemName: inventoryCatalogue.name,
          movementCount: sql<number>`count(*)`.mapWith(Number),
          totalOut: sql<number>`coalesce(sum(${stockMovements.quantityOut}), 0)`.mapWith(Number),
        })
        .from(stockMovements)
        .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
        .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
        .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
        .where(sql`${stockMovements.quantityOut} > 0`)
        .groupBy(commodityTrackingNumbers.itemId, inventoryCatalogue.itemCode, inventoryCatalogue.name);
      return movementRows.map((row) => {
        const movementCount = safeNumber(row.movementCount);
        const classification = movementCount >= 12 ? "Fast" : movementCount >= 4 ? "Normal" : "Slow";
        return {
          itemId: row.itemId,
          itemCode: row.itemCode,
          itemName: row.itemName,
          count: movementCount,
          quantityOut: safeNumber(row.totalOut),
          classification,
        };
      });
    }),

    warehouseUtilization: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx, ["manager", "admin"]);
      const db = await getDb();
      if (!db) return [];
      const settingsRows = await db
        .select({
          warehouseId: stockSettings.warehouseId,
          warehouseName: sites.name,
          configuredItems: sql<number>`count(*)`.mapWith(Number),
        })
        .from(stockSettings)
        .innerJoin(sites, eq(stockSettings.warehouseId, sites.id))
        .groupBy(stockSettings.warehouseId, sites.name);
      const activeCardRows = await db
        .select({
          warehouseId: stockCards.locationId,
          activeStockCards: sql<number>`count(*)`.mapWith(Number),
        })
        .from(stockCards)
        .groupBy(stockCards.locationId);
      const activeCardsByWarehouse = new Map<number, number>(activeCardRows.map((row) => [row.warehouseId, safeNumber(row.activeStockCards)]));
      return settingsRows.map((row) => {
        const configuredItems = safeNumber(row.configuredItems);
        const activeStockCards = safeNumber(activeCardsByWarehouse.get(row.warehouseId) ?? 0);
        const stockAccuracy = configuredItems > 0 ? Math.min(100, (activeStockCards / configuredItems) * 100) : 0;
        return {
          warehouseId: row.warehouseId,
          warehouseName: row.warehouseName,
          configuredItems,
          activeStockCards,
          stockAccuracy,
        };
      });
    }),

    forecastDemand: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx, ["manager", "admin"]);
      const db = await getDb();
      if (!db) return [];
      const outboundRows = await db
        .select({
          itemId: commodityTrackingNumbers.itemId,
          itemCode: inventoryCatalogue.itemCode,
          itemName: inventoryCatalogue.name,
          warehouseId: stockCards.locationId,
          date: stockMovements.date,
          quantityOut: stockMovements.quantityOut,
        })
        .from(stockMovements)
        .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
        .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
        .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
        .where(sql`${stockMovements.quantityOut} > 0`)
        .orderBy(asc(stockMovements.date));
      const byItemWarehouse = new Map<string, {
        itemId: number;
        itemCode: string;
        itemName: string;
        warehouseId: number;
        monthly: Map<string, number>;
      }>();
      for (const row of outboundRows) {
        const key = `${row.itemId}:${row.warehouseId}`;
        const month = toMonthKey(row.date);
        const current = byItemWarehouse.get(key) ?? {
          itemId: row.itemId,
          itemCode: row.itemCode,
          itemName: row.itemName,
          warehouseId: row.warehouseId,
          monthly: new Map<string, number>(),
        };
        current.monthly.set(month, safeNumber(current.monthly.get(month) ?? 0) + safeNumber(row.quantityOut));
        byItemWarehouse.set(key, current);
      }
      const results: Array<{
        itemId: number;
        itemCode: string;
        itemName: string;
        warehouseId: number;
        period: string;
        demand: number;
        rolling3MonthAverage: number;
      }> = [];
      for (const value of Array.from(byItemWarehouse.values())) {
        const months = Array.from(value.monthly.entries() as Iterable<[string, number]>).sort((a, b) => a[0].localeCompare(b[0]));
        const demandValues = months.map(([, demand]) => safeNumber(demand));
        const rolling3MonthAverage =
          demandValues.length === 0
            ? 0
            : demandValues.slice(Math.max(0, demandValues.length - 3)).reduce((sum, demand) => sum + demand, 0) /
              Math.min(3, demandValues.length);
        for (const monthEntry of months) {
          const period = monthEntry[0];
          const demand = monthEntry[1];
          results.push({
            itemId: value.itemId,
            itemCode: value.itemCode,
            itemName: value.itemName,
            warehouseId: value.warehouseId,
            period,
            demand,
            rolling3MonthAverage,
          });
        }
      }
      return results;
    }),
  }),

  stockCards: router({
    list: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            locationId: z.number().int().positive().optional(),
            expiryWindow: z.enum(["all", "expiring-30", "expiring-90", "expired"]).default("all").optional(),
            lowStockOnly: z.boolean().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return listStockCards(db, {
          search: input?.search,
          locationId: input?.locationId,
          expiryWindow: input?.expiryWindow ?? "all",
          lowStockOnly: input?.lowStockOnly ?? false,
        });
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        return getStockCardDetail(db, input.id);
      }),

    addStockCheck: protectedProcedure
      .input(stockCheckInputSchema)
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

        const [card] = await db.select().from(stockCards).where(eq(stockCards.id, input.stockCardId)).limit(1);
        if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Stock card not found." });

        const todayIso = new Date().toISOString().slice(0, 10);
        const isRetroactive = requiresSupervisorForRetroactiveEntry(input.date, todayIso);
        if (isRetroactive && !input.supervisorId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Retroactive stock checks require supervisor_id." });
        }

        const currentBalance = await stockCardNet(card.id);
        const computed = computeStockCheckMovement(currentBalance, Number(input.countedQty));
        if (computed.variance === 0) {
          return { success: true as const, movementId: null, variance: 0, balanceAfter: currentBalance };
        }

        const actorName = ctx.user.name || `user#${ctx.user.id}`;
        const remarks = isRetroactive
          ? buildRetroactiveStockCheckRemark({
              original: input.notes,
              actorName,
              todayIso,
            })
          : input.notes ?? null;

        const [movement] = await db
          .insert(stockMovements)
          .values({
            stockCardId: card.id,
            date: input.date,
            documentRef: "— STOCK CHECK",
            fromTo: "STOCK CHECK",
            quantityIn: computed.quantityIn,
            quantityOut: computed.quantityOut,
            balanceAfter: computed.balanceAfter,
            remarks,
            sourceType: "stock_check",
            createdBy: input.storekeeperId,
          })
          .returning({ id: stockMovements.id });

        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.INVENTORY_ADJUSTMENT,
          entityType: "stock_card",
          entityId: card.id,
          changes: {
            documentRef: "— STOCK CHECK",
            variance: computed.variance,
            countedQty: input.countedQty,
            balanceAfter: computed.balanceAfter,
            retroactiveEntry: isRetroactive,
          },
          req: ctx.req,
        });

        return {
          success: true as const,
          movementId: movement.id,
          variance: computed.variance,
          balanceAfter: computed.balanceAfter,
          retroactiveEntry: isRetroactive,
        };
      }),
  }),

  binCards: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return listBinCards(db);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        return getBinCardDetail(db, input.id);
      }),

    close: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), closedById: z.number().int().positive(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [card] = await db.select().from(binCards).where(eq(binCards.id, input.id)).limit(1);
        if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Bin card not found." });
        try {
          assertBinCardLifecycleTransition(card.status, "close");
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Invalid lifecycle transition." });
        }
        const [updated] = await db
          .update(binCards)
          .set({
            status: "closed",
            closedAt: new Date(),
            stockLocation: input.notes ? `${card.stockLocation ?? ""} [closed by ${input.closedById}: ${input.notes}]` : card.stockLocation,
          })
          .where(eq(binCards.id, input.id))
          .returning();
        return updated;
      }),

    reopen: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), reopenedById: z.number().int().positive(), reason: z.string().min(3) }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [card] = await db.select().from(binCards).where(eq(binCards.id, input.id)).limit(1);
        if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Bin card not found." });
        try {
          assertBinCardLifecycleTransition(card.status, "reopen");
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Invalid lifecycle transition." });
        }
        const [updated] = await db
          .update(binCards)
          .set({
            status: "open",
            closedAt: null,
            stockLocation: `${card.stockLocation ?? ""} [reopened by ${input.reopenedById}: ${input.reason}]`,
          })
          .where(eq(binCards.id, input.id))
          .returning();
        return updated;
      }),
  }),

  adminData: router({
    exportFullInventoryZip: protectedProcedure.mutation(async ({ ctx }) => {
      requireRole(ctx, ["admin"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const [catalogue, stocks, moves, dists, kits, reqs] = await Promise.all([
        db.select().from(inventoryCatalogue),
        db
          .select({
            catalogueId: stockSettings.catalogueId,
            warehouseId: stockSettings.warehouseId,
            minLevel: stockSettings.minLevel,
            maxLevel: stockSettings.maxLevel,
            safetyStockLevel: stockSettings.safetyStockLevel,
            zoneLocation: stockSettings.zoneLocation,
            quantityOnHand: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
          })
          .from(stockSettings)
          .leftJoin(stockCards, eq(stockCards.locationId, stockSettings.warehouseId))
          .leftJoin(
            commodityTrackingNumbers,
            and(eq(stockCards.ctnId, commodityTrackingNumbers.id), eq(commodityTrackingNumbers.itemId, stockSettings.catalogueId))
          )
          .leftJoin(stockMovements, eq(stockMovements.stockCardId, stockCards.id))
          .groupBy(
            stockSettings.catalogueId,
            stockSettings.warehouseId,
            stockSettings.minLevel,
            stockSettings.maxLevel,
            stockSettings.safetyStockLevel,
            stockSettings.zoneLocation
          ),
        db
          .select({
            id: stockMovements.id,
            createdAt: stockMovements.createdAt,
            sourceType: stockMovements.sourceType,
            quantityIn: stockMovements.quantityIn,
            quantityOut: stockMovements.quantityOut,
            balanceAfter: stockMovements.balanceAfter,
            documentRef: stockMovements.documentRef,
            locationId: stockCards.locationId,
            itemId: commodityTrackingNumbers.itemId,
          })
          .from(stockMovements)
          .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .where(gte(stockMovements.createdAt, new Date(Date.now() - 365 * 86400000))),
        db.select().from(distributions),
        db.select().from(inventoryKits),
        db.select().from(requisitions),
      ]);
      const toCsv = (rows: Record<string, unknown>[]) => {
        if (!rows.length) return "";
        const keys = Object.keys(rows[0]);
        return [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
      };
      zip.file("catalogue.xlsx", toCsv(catalogue as any[]));
      zip.file("stock_levels.xlsx", toCsv(stocks as any[]));
      zip.file("movements_12_months.xlsx", toCsv(moves as any[]));
      zip.file("distributions.xlsx", toCsv(dists as any[]));
      zip.file("kits.xlsx", toCsv(kits as any[]));
      zip.file("requisitions.xlsx", toCsv(reqs as any[]));
      const out = await zip.generateAsync({ type: "nodebuffer" });
      return {
        data: out.toString("base64"),
        filename: `inventory-full-export-${Date.now()}.zip`,
        mimeType: "application/zip",
      };
    }),

    importCatalogueDryRun: protectedProcedure
      .input(z.object({ csvData: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["admin"]);
        const lines = input.csvData.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        if (lines.length < 2) return { validRows: 0, errors: ["No rows found"] };
        const headers = parseCsvLine(lines[0]).map((x) => x.toLowerCase());
        const required = ["itemcode", "name", "category", "unitofmeasure"];
        const missing = required.filter((r) => !headers.includes(r));
        if (missing.length) return { validRows: 0, errors: [`Missing columns: ${missing.join(", ")}`] };
        const errors: string[] = [];
        let validRows = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          if (!cols[headers.indexOf("itemcode")] || !cols[headers.indexOf("name")]) {
            errors.push(`Row ${i + 1}: itemCode/name required`);
            continue;
          }
          validRows += 1;
        }
        return { validRows, errors };
      }),

    importOpeningStockDryRun: protectedProcedure
      .input(z.object({ rows: z.array(openingStockRowSchema) }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const facilities = await db.select({ id: sites.id, code: sites.code }).from(sites);
        const catalogue = await db.select({ id: inventoryCatalogue.id, itemCode: inventoryCatalogue.itemCode }).from(inventoryCatalogue);
        const facilityMap = new Map(facilities.map((f) => [String(f.code ?? "").toLowerCase(), f.id]));
        const itemMap = new Map(catalogue.map((c) => [String(c.itemCode ?? "").toLowerCase(), c.id]));
        const preview = input.rows.map((row, idx) => {
          const warehouseId = facilityMap.get(row.warehouseCode.toLowerCase());
          const catalogueId = itemMap.get(row.itemCode.toLowerCase());
          const messages: string[] = [];
          if (!warehouseId) messages.push("Warehouse not found");
          if (!catalogueId) messages.push("Item not found");
          if (row.quantityOnHand < 0) messages.push("Quantity must be non-negative");
          const status = messages.length ? "error" : "ok";
          return { rowNumber: idx + 1, ...row, warehouseId: warehouseId ?? null, catalogueId: catalogueId ?? null, status, messages };
        });
        return {
          preview,
          summary: {
            ok: preview.filter((x) => x.status === "ok").length,
            errors: preview.filter((x) => x.status === "error").length,
          },
        };
      }),

    importOpeningStockConfirm: protectedProcedure
      .input(z.object({ rows: z.array(openingStockRowSchema) }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["admin"]);
        const dryRun = await inventoryV2Router.createCaller(ctx).adminData.importOpeningStockDryRun({ rows: input.rows });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];
        for (const row of dryRun.preview) {
          if (row.status !== "ok" || !row.warehouseId || !row.catalogueId) {
            skipped += 1;
            errors.push(`Row ${row.rowNumber}: ${row.messages.join(", ")}`);
            continue;
          }
          await ensureStockSettingsRecord(row.catalogueId, row.warehouseId);
          const [settings] = await db
            .select()
            .from(stockSettings)
            .where(and(eq(stockSettings.catalogueId, row.catalogueId), eq(stockSettings.warehouseId, row.warehouseId)))
            .limit(1);
          if (settings) {
            await db
              .update(stockSettings)
              .set({
                minLevel: row.minLevel ?? settings.minLevel,
                maxLevel: row.maxLevel ?? settings.maxLevel,
                safetyStockLevel: row.safetyLevel ?? settings.safetyStockLevel,
                updatedAt: new Date(),
              })
              .where(eq(stockSettings.id, settings.id));
          } else {
            await db.insert(stockSettings).values({
              catalogueId: row.catalogueId,
              warehouseId: row.warehouseId,
              minLevel: row.minLevel ?? 0,
              maxLevel: row.maxLevel ?? null,
              safetyStockLevel: row.safetyLevel ?? null,
            });
          }
          if (row.batchNumber || row.expiryDate) {
            const stockCardId = await ensureCountStockCardForItemLocation({
              itemId: row.catalogueId,
              locationId: row.warehouseId,
              expectedBalance: row.quantityOnHand,
              createdBy: ctx.user.id,
            });
            await db.insert(inventoryBatches).values({
              stockId: null,
              stockCardId,
              batchNumber: row.batchNumber ?? null,
              expiryDate: row.expiryDate ?? null,
              quantity: row.quantityOnHand,
              status: "active",
            });
          }
          imported += 1;
        }
        return { imported, skipped, errors };
      }),

    importHistoricalMovementsDryRun: protectedProcedure
      .input(z.object({ rows: z.array(historicalMovementRowSchema) }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const facilities = await db.select({ id: sites.id, code: sites.code }).from(sites);
        const catalogue = await db.select({ id: inventoryCatalogue.id, itemCode: inventoryCatalogue.itemCode }).from(inventoryCatalogue);
        const facilityMap = new Map(facilities.map((f) => [String(f.code ?? "").toLowerCase(), f.id]));
        const itemMap = new Map(catalogue.map((c) => [String(c.itemCode ?? "").toLowerCase(), c.id]));
        const preview = input.rows.map((row, idx) => {
          const warehouseId = facilityMap.get(row.warehouseCode.toLowerCase());
          const catalogueId = itemMap.get(row.itemCode.toLowerCase());
          const messages: string[] = [];
          if (!warehouseId) messages.push("Warehouse not found");
          if (!catalogueId) messages.push("Item not found");
          if (row.quantity < 0) messages.push("Quantity must be non-negative");
          const status = messages.length ? "error" : "ok";
          return { rowNumber: idx + 1, ...row, warehouseId: warehouseId ?? null, catalogueId: catalogueId ?? null, status, messages };
        });
        return {
          preview,
          summary: { ok: preview.filter((x) => x.status === "ok").length, errors: preview.filter((x) => x.status === "error").length },
        };
      }),

    importHistoricalMovementsConfirm: protectedProcedure
      .input(z.object({ rows: z.array(historicalMovementRowSchema) }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["admin"]);
        const dryRun = await inventoryV2Router.createCaller(ctx).adminData.importHistoricalMovementsDryRun({ rows: input.rows });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];
        for (const row of dryRun.preview) {
          if (row.status !== "ok" || !row.warehouseId || !row.catalogueId) {
            skipped += 1;
            errors.push(`Row ${row.rowNumber}: ${row.messages.join(", ")}`);
            continue;
          }
          await ensureStockSettingsRecord(row.catalogueId, row.warehouseId);
          const onHand = await itemWarehouseNet(row.catalogueId, row.warehouseId);
          const stockCardId = await ensureCountStockCardForItemLocation({
            itemId: row.catalogueId,
            locationId: row.warehouseId,
            expectedBalance: Number(onHand),
            createdBy: ctx.user.id,
          });
          const previousBalance = await stockCardNet(stockCardId);
          const movement = buildHistoricalStockMovement({
            movementType: row.movementType,
            quantity: row.quantity,
            previousBalance,
            documentRef: row.documentNumber ?? null,
            date: row.date,
            notes: row.notes ?? null,
            createdBy: ctx.user.id,
            stockCardId,
          });
          await db.insert(stockMovements).values(movement.row);
          if (row.movementType === "adjustment") {
            await logAuditEvent({
              userId: ctx.user.id,
              action: AUDIT_ACTIONS.INVENTORY_ADJUSTMENT,
              entityType: "stock_movement",
              entityId: stockCardId,
              changes: {
                documentRef: row.documentNumber ?? null,
                quantity: row.quantity,
                movementType: row.movementType,
                warehouseId: row.warehouseId,
                catalogueId: row.catalogueId,
              },
              req: ctx.req,
            });
          }
          imported += 1;
        }
        return { imported, skipped, errors };
      }),
  }),

  counts: router({
    create: protectedProcedure
      .input(
        z.object({
          warehouseId: z.number(),
          countType: z.enum(["full", "cycle", "spot_check"]),
          scope: z.any().optional(),
          plannedStartDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const countNumber = await nextCountNumber();
        const [count] = await db
          .insert(inventoryCounts)
          .values({
            countNumber,
            countType: input.countType,
            warehouseId: input.warehouseId,
            status: "draft",
            scope: input.scope ?? null,
            plannedStartDate: input.plannedStartDate ?? null,
            notes: input.notes ?? null,
            conductedBy: ctx.user.id,
          })
          .returning();
        return count;
      }),

    generateSheet: protectedProcedure
      .input(z.object({ countId: z.number(), catalogueIds: z.array(z.number()).optional() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [count] = await db.select().from(inventoryCounts).where(eq(inventoryCounts.id, input.countId)).limit(1);
        if (!count) throw new TRPCError({ code: "NOT_FOUND", message: "Count session not found." });
        const filters = [eq(stockSettings.warehouseId, count.warehouseId)];
        if (input.catalogueIds?.length) filters.push(inArray(stockSettings.catalogueId, input.catalogueIds));
        const settingsRows = await db.select().from(stockSettings).where(and(...filters));
        for (const settings of settingsRows) {
          const expectedQuantity = await itemWarehouseNet(settings.catalogueId, settings.warehouseId);
          await db.insert(inventoryCountLines).values({
            countId: count.id,
            stockId: null,
            catalogueId: settings.catalogueId,
            warehouseId: settings.warehouseId,
            expectedQuantity,
          });
        }
        await db.update(inventoryCounts).set({ status: "in_progress", actualStartedAt: new Date() }).where(eq(inventoryCounts.id, count.id));
        return { lines: settingsRows.length };
      }),

    enterCount: protectedProcedure
      .input(
        z.object({
          lineId: z.number(),
          actualQuantity: z.number().min(0),
          varianceReason: z.string().optional(),
          varianceNotes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [line] = await db.select().from(inventoryCountLines).where(eq(inventoryCountLines.id, input.lineId)).limit(1);
        if (!line) throw new TRPCError({ code: "NOT_FOUND", message: "Count line not found." });
        const expected = Number(line.expectedQuantity ?? 0);
        const varianceQuantity = Number(input.actualQuantity) - expected;
        const variancePercent = expected > 0 ? (varianceQuantity / expected) * 100 : 0;
        const [updated] = await db
          .update(inventoryCountLines)
          .set({
            actualQuantity: input.actualQuantity,
            varianceQuantity,
            variancePercent,
            varianceReason: input.varianceReason ?? null,
            varianceNotes: input.varianceNotes ?? null,
            countedBy: ctx.user.id,
            countedAt: new Date(),
          })
          .where(eq(inventoryCountLines.id, line.id))
          .returning();
        return updated;
      }),

    submitForReview: protectedProcedure
      .input(z.object({ countId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        await db.update(inventoryCounts).set({ status: "pending_review", completedAt: new Date() }).where(eq(inventoryCounts.id, input.countId));
        return { success: true as const };
      }),

    approve: protectedProcedure
      .input(z.object({ countId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [count] = await db.select().from(inventoryCounts).where(eq(inventoryCounts.id, input.countId)).limit(1);
        if (!count) throw new TRPCError({ code: "NOT_FOUND", message: "Count session not found." });
        const lines = await db.select().from(inventoryCountLines).where(eq(inventoryCountLines.countId, count.id));
        let varianceCount = 0;
        for (const line of lines) {
          if (line.actualQuantity == null) continue;
          if (!line.catalogueId || !line.warehouseId) continue;
          const expected = await itemWarehouseNet(line.catalogueId, line.warehouseId);
          const actual = Number(line.actualQuantity);
          if (actual !== expected) {
            varianceCount += 1;
            const stockCardId = await ensureCountStockCardForItemLocation({
              itemId: line.catalogueId,
              locationId: line.warehouseId,
              expectedBalance: expected,
              createdBy: ctx.user.id,
            });
            const cardBalance = await stockCardNet(stockCardId);
            const variance = actual - expected;
            await db.insert(stockMovements).values({
              stockCardId,
              date: new Date().toISOString().slice(0, 10),
              documentRef: "— STOCK CHECK",
              fromTo: "STOCK CHECK",
              quantityIn: variance > 0 ? Math.abs(variance) : 0,
              quantityOut: variance < 0 ? Math.abs(variance) : 0,
              balanceAfter: cardBalance + variance,
              remarks: line.varianceNotes ?? line.varianceReason ?? "Count variance adjustment",
              sourceType: "stock_check",
              createdBy: ctx.user.id,
            });
          }
        }
        await db
          .update(inventoryCounts)
          .set({
            status: "approved",
            approvedBy: ctx.user.id,
            varianceCount,
            totalItemsCounted: lines.length,
          })
          .where(eq(inventoryCounts.id, count.id));
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.INVENTORY_CYCLE_COUNT,
          entityType: "inventory_count",
          entityId: count.id,
          changes: {
            countNumber: count.countNumber,
            warehouseId: count.warehouseId,
            varianceCount,
            totalItemsCounted: lines.length,
          },
          req: ctx.req,
        });
        return { success: true as const, varianceCount };
      }),

    list: protectedProcedure
      .input(z.object({ warehouseId: z.number().optional(), status: z.string().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const scopedWarehouseId = enforceFacilityScope(ctx.user, input?.warehouseId);
        if (scopedWarehouseId === -1) return [];

        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(inventoryCounts)
          .where(
            and(
              scopedWarehouseId != null && scopedWarehouseId > 0
                ? eq(inventoryCounts.warehouseId, scopedWarehouseId)
                : undefined,
              input?.status ? eq(inventoryCounts.status, input.status) : undefined
            )
          )
          .orderBy(desc(inventoryCounts.createdAt));
      }),

    get: protectedProcedure
      .input(z.object({ countId: z.number() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return null;
        const [count] = await db.select().from(inventoryCounts).where(eq(inventoryCounts.id, input.countId)).limit(1);
        if (!count) return null;
        assertRecordFacilityAccess(ctx.user, count.warehouseId);
        const lines = await db
          .select({
            lineId: inventoryCountLines.id,
            countId: inventoryCountLines.countId,
            stockId: inventoryCountLines.stockId,
            catalogueId: inventoryCountLines.catalogueId,
            warehouseId: inventoryCountLines.warehouseId,
            expectedQuantity: inventoryCountLines.expectedQuantity,
            actualQuantity: inventoryCountLines.actualQuantity,
            varianceQuantity: inventoryCountLines.varianceQuantity,
            variancePercent: inventoryCountLines.variancePercent,
            varianceReason: inventoryCountLines.varianceReason,
            varianceNotes: inventoryCountLines.varianceNotes,
            countedBy: inventoryCountLines.countedBy,
            countedAt: inventoryCountLines.countedAt,
            quantityOnHand: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(Number),
            itemCode: inventoryCatalogue.itemCode,
            itemName: inventoryCatalogue.name,
          })
          .from(inventoryCountLines)
          .innerJoin(inventoryCatalogue, eq(inventoryCountLines.catalogueId, inventoryCatalogue.id))
          .leftJoin(commodityTrackingNumbers, eq(commodityTrackingNumbers.itemId, inventoryCountLines.catalogueId))
          .leftJoin(
            stockCards,
            and(eq(stockCards.locationId, inventoryCountLines.warehouseId), eq(stockCards.ctnId, commodityTrackingNumbers.id))
          )
          .leftJoin(stockMovements, eq(stockMovements.stockCardId, stockCards.id))
          .where(eq(inventoryCountLines.countId, count.id))
          .groupBy(
            inventoryCountLines.id,
            inventoryCountLines.countId,
            inventoryCountLines.stockId,
            inventoryCountLines.catalogueId,
            inventoryCountLines.warehouseId,
            inventoryCountLines.expectedQuantity,
            inventoryCountLines.actualQuantity,
            inventoryCountLines.varianceQuantity,
            inventoryCountLines.variancePercent,
            inventoryCountLines.varianceReason,
            inventoryCountLines.varianceNotes,
            inventoryCountLines.countedBy,
            inventoryCountLines.countedAt,
            inventoryCatalogue.itemCode,
            inventoryCatalogue.name
          );
        return { ...count, lines };
      }),
  }),

  expiry: router({
    upcoming: protectedProcedure
      .input(z.object({ days: z.number().default(90) }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const now = new Date();
        const until = new Date(now.getTime() + (input?.days ?? 90) * 24 * 60 * 60 * 1000);
        return db
          .select({
            batchId: inventoryBatches.id,
            batchNumber: inventoryBatches.batchNumber,
            expiryDate: inventoryBatches.expiryDate,
            quantity: inventoryBatches.quantity,
            status: inventoryBatches.status,
            stockCardId: inventoryBatches.stockCardId,
            warehouseName: sites.name,
            itemCode: inventoryCatalogue.itemCode,
            itemName: inventoryCatalogue.name,
          })
          .from(inventoryBatches)
          .innerJoin(stockCards, eq(inventoryBatches.stockCardId, stockCards.id))
          .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
          .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
          .innerJoin(sites, eq(stockCards.locationId, sites.id))
          .where(
            and(
              eq(inventoryBatches.status, "active"),
              gte(inventoryBatches.expiryDate, now.toISOString().slice(0, 10)),
              lte(inventoryBatches.expiryDate, until.toISOString().slice(0, 10))
            )
          )
          .orderBy(asc(inventoryBatches.expiryDate));
      }),

    expired: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const today = new Date().toISOString().slice(0, 10);
      return db
        .select()
        .from(inventoryBatches)
        .where(or(eq(inventoryBatches.status, "expired"), lte(inventoryBatches.expiryDate, today)));
    }),

    markExpired: protectedProcedure
      .input(z.object({ batchId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [batch] = await db.select().from(inventoryBatches).where(eq(inventoryBatches.id, input.batchId)).limit(1);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found." });
        if (!batch.stockCardId) throw new TRPCError({ code: "BAD_REQUEST", message: "Batch is not linked to a stock card." });
        await db.update(inventoryBatches).set({ status: "expired" }).where(eq(inventoryBatches.id, batch.id));
        const cardBalance = await stockCardNet(batch.stockCardId);
        await db.insert(stockMovements).values({
          stockCardId: batch.stockCardId,
          date: new Date().toISOString().slice(0, 10),
          documentRef: `EXP-${batch.id}`,
          fromTo: "EXPIRY",
          quantityIn: 0,
          quantityOut: Math.abs(Number(batch.quantity)),
          balanceAfter: Math.max(0, cardBalance - Math.abs(Number(batch.quantity))),
          remarks: `Expired batch ${batch.batchNumber ?? batch.id}`,
          sourceType: "expiry",
          createdBy: ctx.user.id,
        });
        return { success: true as const };
      }),

    runJob: protectedProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const today = input?.date ?? new Date().toISOString().slice(0, 10);
        const expiredBatches = await db
          .select()
          .from(inventoryBatches)
          .where(and(eq(inventoryBatches.status, "active"), lte(inventoryBatches.expiryDate, today)));
        let processed = 0;
        for (const batch of expiredBatches) {
          if (!batch.stockCardId) continue;
          await db.update(inventoryBatches).set({ status: "expired" }).where(eq(inventoryBatches.id, batch.id));
          const cardBalance = await stockCardNet(batch.stockCardId);
          await db.insert(stockMovements).values({
            stockCardId: batch.stockCardId,
            date: today,
            documentRef: `EXP-JOB-${batch.id}`,
            fromTo: "EXPIRY JOB",
            quantityIn: 0,
            quantityOut: Math.abs(Number(batch.quantity)),
            balanceAfter: Math.max(0, cardBalance - Math.abs(Number(batch.quantity))),
            remarks: `Automated expiry for batch ${batch.batchNumber ?? batch.id}`,
            sourceType: "expiry",
            createdBy: ctx.user.id,
          });
          processed += 1;
        }
        return { processed };
      }),

    disposeExpired: protectedProcedure
      .input(z.object({ batchIds: z.array(z.number()).min(1) }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const docNumber = await nextDocumentNumber("WB");
        const [doc] = await db
          .insert(inventoryDocuments)
          .values({
            documentType: "waybill",
            documentNumber: docNumber,
            status: "completed",
            notes: "Disposal waybill for expired inventory",
            createdBy: ctx.user.id,
            approvedBy: ctx.user.id,
            completedAt: new Date(),
          })
          .returning();
        for (const batchId of input.batchIds) {
          await db.update(inventoryBatches).set({ status: "disposed" }).where(eq(inventoryBatches.id, batchId));
        }
        return { success: true as const, documentNumber: doc.documentNumber };
      }),
  }),
});
