import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  commodityTrackingNumbers,
  donors,
  binCards,
  distributions,
  inventoryKits,
  kitAssemblies,
  kitCtnContributors,
  requisitions,
  inventoryCountLines,
  inventoryCounts,
  inventoryBatches,
  inventoryCatalogue,
  inventoryDocuments,
  inventoryMovements,
  inventoryStock,
  stockCards,
  stockMovements,
  sites,
  users,
  waybillLineCtnSources,
  waybillLines,
  waybills,
} from "../../drizzle/schema";
import { getDb, getAllUsers, createNotification } from "../db";
import { protectedProcedure, requireRole, router } from "../_core/trpc";
import { checkStockThreshold } from "../_core/inventoryAlerts";
import {
  IFRC_CATALOGUE_SEED,
  INVENTORY_CATEGORIES,
  INVENTORY_VED_VALUES,
  type InventoryCatalogueSeedItem,
} from "../../shared/inventoryCatalogueSeed";
import { itemCategoryZod, type ItemCategory } from "../../shared/itemCategory";
import { generateGrnPdf } from "../_core/pdfTemplates/grnPdf";
import { generateWaybillPdf } from "../_core/pdfTemplates/waybillPdf";
import { generateRequisitionPdf } from "../_core/pdfTemplates/requisitionPdf";
import { generateDistributionReportPdf } from "../_core/pdfTemplates/distributionReport";
import {
  applyTransitionalInventoryStockReceipt,
  assertCtnMatchesCatalogue,
  ensureStockCardForCtnAtLocation,
  insertGrnReceiptMovement,
} from "../wms/grnStockLedger";
import { expandKitDonorContribution } from "../wms/kitDonorContribution";
import {
  buildRetroactiveStockCheckRemark,
  computeStockCheckMovement,
  getStockCardDetail,
  listStockCards,
  requiresSupervisorForRetroactiveEntry,
} from "../wms/stockCard";
import { assertBinCardLifecycleTransition, getBinCardDetail, listBinCards } from "../wms/binCard";

const vedEnum = z.enum(INVENTORY_VED_VALUES);
const categoryEnum = z.enum(INVENTORY_CATEGORIES);

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
  /** When set, GRN approval writes `stock_movements` (WMS Phase 2) instead of `inventory_movements`. */
  ctnId: z.number().int().positive().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

const grnDocumentItemSchema = documentItemSchema.extend({
  ctnId: z.number().int().positive(),
});

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

async function getOrCreateStock(catalogueId: number, warehouseId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const [existing] = await db
    .select()
    .from(inventoryStock)
    .where(and(eq(inventoryStock.catalogueId, catalogueId), eq(inventoryStock.warehouseId, warehouseId)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(inventoryStock).values({ catalogueId, warehouseId }).returning();
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
    remarks: "Auto-created from inventory_stock during count migration (bootstrap)",
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
            stockId: inventoryStock.id,
            warehouseId: inventoryStock.warehouseId,
            warehouseName: sites.name,
            quantityOnHand: inventoryStock.quantityOnHand,
            quantityReserved: inventoryStock.quantityReserved,
            quantityInTransit: inventoryStock.quantityInTransit,
            minLevel: inventoryStock.minLevel,
            maxLevel: inventoryStock.maxLevel,
            safetyStockLevel: inventoryStock.safetyStockLevel,
            zoneLocation: inventoryStock.zoneLocation,
          })
          .from(inventoryStock)
          .innerJoin(sites, eq(inventoryStock.warehouseId, sites.id))
          .where(eq(inventoryStock.catalogueId, input.id))
          .orderBy(asc(sites.name));
        return { ...item, stock: stockRows };
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
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const warehouses = await db
          .select()
          .from(sites)
          .where(
            and(
              eq(sites.facilityType, "warehouse"),
              input?.warehouseId ? eq(sites.id, input.warehouseId) : undefined
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
          .from(inventoryStock)
          .where(
            and(
              inArray(inventoryStock.catalogueId, catalogueRows.map((c) => c.id)),
              inArray(inventoryStock.warehouseId, warehouses.map((w) => w.id))
            )
          );
        const stockMap = new Map(stockRows.map((s) => [`${s.catalogueId}:${s.warehouseId}`, s]));

        const overview = [];
        for (const item of catalogueRows) {
          for (const warehouse of warehouses) {
            const stock = stockMap.get(`${item.id}:${warehouse.id}`);
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
              quantityOnHand: stock?.quantityOnHand ?? 0,
              minLevel: stock?.minLevel ?? 0,
              maxLevel: stock?.maxLevel ?? null,
              safetyStockLevel: stock?.safetyStockLevel ?? null,
              quantityReserved: stock?.quantityReserved ?? 0,
              quantityInTransit: stock?.quantityInTransit ?? 0,
              zoneLocation: stock?.zoneLocation ?? null,
              status: deriveStockStatus({
                quantityOnHand: stock?.quantityOnHand ?? 0,
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
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select({
            stockId: inventoryStock.id,
            catalogueId: inventoryCatalogue.id,
            itemCode: inventoryCatalogue.itemCode,
            itemName: inventoryCatalogue.name,
            category: inventoryCatalogue.category,
            itemCategory: inventoryCatalogue.itemCategory,
            vedClassification: inventoryCatalogue.vedClassification,
            unitOfMeasure: inventoryCatalogue.unitOfMeasure,
            quantityOnHand: inventoryStock.quantityOnHand,
            minLevel: inventoryStock.minLevel,
            maxLevel: inventoryStock.maxLevel,
            safetyStockLevel: inventoryStock.safetyStockLevel,
            zoneLocation: inventoryStock.zoneLocation,
          })
          .from(inventoryStock)
          .innerJoin(inventoryCatalogue, eq(inventoryStock.catalogueId, inventoryCatalogue.id))
          .where(eq(inventoryStock.warehouseId, input.warehouseId))
          .orderBy(asc(inventoryCatalogue.name));
      }),

    byItem: protectedProcedure
      .input(z.object({ catalogueId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select({
            stockId: inventoryStock.id,
            warehouseId: sites.id,
            warehouseName: sites.name,
            zoneLocation: inventoryStock.zoneLocation,
            quantityOnHand: inventoryStock.quantityOnHand,
            minLevel: inventoryStock.minLevel,
            maxLevel: inventoryStock.maxLevel,
            safetyStockLevel: inventoryStock.safetyStockLevel,
          })
          .from(inventoryStock)
          .innerJoin(sites, eq(inventoryStock.warehouseId, sites.id))
          .where(eq(inventoryStock.catalogueId, input.catalogueId))
          .orderBy(asc(sites.name));
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
          .from(inventoryStock)
          .where(and(eq(inventoryStock.catalogueId, input.catalogueId), eq(inventoryStock.warehouseId, input.warehouseId)))
          .limit(1);
        if (existing.length) {
          const [updated] = await db
            .update(inventoryStock)
            .set({
              minLevel: input.minLevel,
              maxLevel: input.maxLevel ?? null,
              safetyStockLevel: input.safetyStockLevel ?? null,
              updatedAt: new Date(),
            })
            .where(eq(inventoryStock.id, existing[0].id))
            .returning();
          return updated;
        }
        const [created] = await db
          .insert(inventoryStock)
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
          .from(inventoryStock)
          .where(and(eq(inventoryStock.catalogueId, input.catalogueId), eq(inventoryStock.warehouseId, input.warehouseId)))
          .limit(1);
        if (existing.length) {
          const [updated] = await db
            .update(inventoryStock)
            .set({ zoneLocation: input.zoneLocation, updatedAt: new Date() })
            .where(eq(inventoryStock.id, existing[0].id))
            .returning();
          return updated;
        }
        const [created] = await db
          .insert(inventoryStock)
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
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const filters = [];
        if (input?.warehouseId) {
          filters.push(
            or(eq(inventoryMovements.fromWarehouseId, input.warehouseId), eq(inventoryMovements.toWarehouseId, input.warehouseId))!
          );
        }
        if (input?.itemId) filters.push(eq(inventoryMovements.catalogueId, input.itemId));
        if (input?.type) filters.push(eq(inventoryMovements.movementType, input.type));
        if (input?.dateFrom) filters.push(gte(inventoryMovements.createdAt, input.dateFrom));
        if (input?.dateTo) filters.push(lte(inventoryMovements.createdAt, input.dateTo));
        return db
          .select({
            id: inventoryMovements.id,
            createdAt: inventoryMovements.createdAt,
            movementType: inventoryMovements.movementType,
            quantityChange: inventoryMovements.quantityChange,
            balanceAfter: inventoryMovements.balanceAfter,
            documentNumber: inventoryMovements.documentNumber,
            documentType: inventoryMovements.documentType,
            fromWarehouseId: inventoryMovements.fromWarehouseId,
            toWarehouseId: inventoryMovements.toWarehouseId,
            itemCode: inventoryCatalogue.itemCode,
            itemName: inventoryCatalogue.name,
          })
          .from(inventoryMovements)
          .innerJoin(inventoryCatalogue, eq(inventoryMovements.catalogueId, inventoryCatalogue.id))
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(desc(inventoryMovements.createdAt));
      }),

    byDocument: protectedProcedure
      .input(z.object({ documentNumber: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(inventoryMovements)
          .where(eq(inventoryMovements.documentNumber, input.documentNumber))
          .orderBy(asc(inventoryMovements.id));
      }),

    byItem: protectedProcedure
      .input(z.object({ catalogueId: z.number(), warehouseId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const filters = [eq(inventoryMovements.catalogueId, input.catalogueId)];
        if (input.warehouseId) {
          filters.push(
            or(eq(inventoryMovements.fromWarehouseId, input.warehouseId), eq(inventoryMovements.toWarehouseId, input.warehouseId))!
          );
        }
        return db
          .select()
          .from(inventoryMovements)
          .where(and(...filters))
          .orderBy(desc(inventoryMovements.createdAt));
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
        const rows = await db
          .select({ documentNumber: inventoryDocuments.documentNumber })
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.documentType, "grn"), ilike(inventoryDocuments.documentNumber, `${prefix}%`)));
        const max = rows.reduce((acc, row) => {
          const tail = Number(row.documentNumber.split("-").at(-1));
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
      const [dupe] = await db
        .select({ id: inventoryDocuments.id })
        .from(inventoryDocuments)
        .where(eq(inventoryDocuments.documentNumber, input.grnNumber))
        .limit(1);
      if (dupe) {
        throw new TRPCError({ code: "CONFLICT", message: "GRN number already exists." });
      }
      const [doc] = await db
        .insert(inventoryDocuments)
        .values({
          documentType: "grn",
          documentNumber: input.grnNumber,
          status: "draft",
          toWarehouseId: input.delegationLocationId,
          items: input.items,
          referenceDocument: input.receivedFrom,
          transportDetails: {
            countryCode: input.countryCode ?? "NG",
            dateOfArrival: input.dateOfArrival,
            documentWellReceived: input.documentWellReceived,
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
            deliveredByDate: input.deliveredByDate ?? null,
            deliveredBySignature: input.deliveredBySignature ?? null,
            receivedByName: input.receivedByName ?? null,
            receivedByFunction: input.receivedByFunction ?? null,
            receivedByDate: input.receivedByDate ?? null,
            receivedBySignature: input.receivedBySignature ?? null,
          },
          notes: input.comments ?? null,
          createdBy: ctx.user.id,
        })
        .returning();
      return doc;
    }),

    updateDraft: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          payload: grnDraftInputSchema,
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [doc] = await db
          .select()
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "grn")))
          .limit(1);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "GRN not found." });
        if (doc.status !== "draft" && doc.status !== "pending_approval") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft GRNs can be edited." });
        }
        const [dupe] = await db
          .select({ id: inventoryDocuments.id })
          .from(inventoryDocuments)
          .where(
            and(
              eq(inventoryDocuments.documentNumber, input.payload.grnNumber),
              sql`${inventoryDocuments.id} <> ${input.documentId}`
            )
          )
          .limit(1);
        if (dupe) {
          throw new TRPCError({ code: "CONFLICT", message: "GRN number already exists." });
        }
        const [updated] = await db
          .update(inventoryDocuments)
          .set({
            documentNumber: input.payload.grnNumber,
            toWarehouseId: input.payload.delegationLocationId,
            referenceDocument: input.payload.receivedFrom,
            items: input.payload.items,
            transportDetails: {
              countryCode: input.payload.countryCode ?? "NG",
              dateOfArrival: input.payload.dateOfArrival,
              documentWellReceived: input.payload.documentWellReceived,
              incompleteDocumentsNotes: input.payload.incompleteDocumentsNotes ?? null,
              meansOfTransport: input.payload.meansOfTransport ?? null,
              awbNumber: input.payload.awbNumber ?? null,
              waybillCmrNumber: input.payload.waybillCmrNumber ?? null,
              blNumber: input.payload.blNumber ?? null,
              flightNumber: input.payload.flightNumber ?? null,
              registrationNumber: input.payload.registrationNumber ?? null,
              vesselName: input.payload.vesselName ?? null,
              comments: input.payload.comments ?? null,
              deliveredByName: input.payload.deliveredByName ?? null,
              deliveredByFunction: input.payload.deliveredByFunction ?? null,
              deliveredByDate: input.payload.deliveredByDate ?? null,
              deliveredBySignature: input.payload.deliveredBySignature ?? null,
              receivedByName: input.payload.receivedByName ?? null,
              receivedByFunction: input.payload.receivedByFunction ?? null,
              receivedByDate: input.payload.receivedByDate ?? null,
              receivedBySignature: input.payload.receivedBySignature ?? null,
            },
            notes: input.payload.comments ?? null,
            status: "draft",
          })
          .where(eq(inventoryDocuments.id, input.documentId))
          .returning();
        return updated;
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
        const [doc] = await db
          .insert(inventoryDocuments)
          .values({
            documentType: "grn",
            documentNumber,
            status: "pending_approval",
            toWarehouseId: input.warehouseId,
            items: input.items,
            referenceDocument: input.referenceDocument ?? null,
            transportDetails: input.transportDetails ?? null,
            notes: input.notes ?? null,
            createdBy: ctx.user.id,
          })
          .returning();
        return doc;
      }),

    approve: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
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
          await applyTransitionalInventoryStockReceipt(db, {
            catalogueId: line.catalogueId,
            warehouseId: Number(doc.toWarehouseId),
            quantity: line.quantity,
          });
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
        return { success: true as const };
      }),

    list: protectedProcedure
      .input(
        z
          .object({
            warehouseId: z.number().optional(),
            status: z.enum(["draft", "finalized", "claim_raised"]).optional(),
            search: z.string().optional(),
            receivedFrom: z.string().optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const statusFilter =
          input?.status === "draft"
            ? "pending_approval"
            : input?.status === "finalized"
              ? "completed"
              : input?.status === "claim_raised"
                ? "claim_raised"
                : undefined;
        const search = input?.search?.trim();
        const receivedFrom = input?.receivedFrom?.trim();
        return db
          .select()
          .from(inventoryDocuments)
          .where(
            and(
              eq(inventoryDocuments.documentType, "grn"),
              input?.warehouseId ? eq(inventoryDocuments.toWarehouseId, input.warehouseId) : undefined,
              statusFilter ? eq(inventoryDocuments.status, statusFilter) : undefined,
              search
                ? or(
                    ilike(inventoryDocuments.documentNumber, `%${search}%`),
                    ilike(inventoryDocuments.referenceDocument, `%${search}%`)
                  )
                : undefined,
              receivedFrom ? ilike(inventoryDocuments.referenceDocument, `%${receivedFrom}%`) : undefined,
              input?.dateFrom ? gte(inventoryDocuments.createdAt, new Date(`${input.dateFrom}T00:00:00.000Z`)) : undefined,
              input?.dateTo ? lte(inventoryDocuments.createdAt, new Date(`${input.dateTo}T23:59:59.999Z`)) : undefined
            )
          )
          .orderBy(desc(inventoryDocuments.createdAt));
      }),

    get: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [doc] = await db
          .select()
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "grn")))
          .limit(1);
        return doc ?? null;
      }),
    downloadPdf: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [doc] = await db
          .select()
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "grn")))
          .limit(1);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "GRN not found." });
        const rows = [
          { label: "Document Number", value: doc.documentNumber },
          { label: "Status", value: doc.status ?? "draft" },
          { label: "Reference", value: doc.referenceDocument ?? "—" },
          { label: "Created At", value: doc.createdAt ? new Date(doc.createdAt).toISOString() : "—" },
          { label: "Notes", value: doc.notes ?? "—" },
        ];
        const buffer = await generateGrnPdf({ rows });
        return {
          data: buffer.toString("base64"),
          filename: `${doc.documentNumber}.pdf`,
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
          .optional()
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const filters = [];
        if (input?.warehouseId) filters.push(eq(waybills.warehouseId, input.warehouseId));
        if (input?.status) filters.push(eq(waybills.status, input.status));
        if (input?.destinationType) filters.push(eq(waybills.destinationType, input.destinationType));
        if (input?.dateFrom) filters.push(gte(waybills.date, input.dateFrom));
        if (input?.dateTo) filters.push(lte(waybills.date, input.dateTo));
        if (input?.search?.trim()) {
          const q = `%${input.search.trim()}%`;
          filters.push(or(ilike(waybills.wbNumber, q), ilike(waybills.destinationBeneficiary, q))!);
        }
        const rows = await db.select().from(waybills).where(filters.length ? and(...filters) : undefined).orderBy(desc(waybills.createdAt));
        const withCounts = await Promise.all(
          rows.map(async (row) => {
            const lineRows = await db.select().from(waybillLines).where(eq(waybillLines.waybillId, row.id));
            const totalUnits = lineRows.reduce((sum, line) => sum + Number(line.nbOfUnits), 0);
            return {
              ...row,
              lineCount: lineRows.length,
              totalUnits,
            };
          })
        );
        return withCounts;
      }),

    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [wb] = await db.select().from(waybills).where(eq(waybills.id, input.id)).limit(1);
      if (!wb) return null;
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
        const [wb] = await db.select().from(waybills).where(eq(waybills.id, input.id)).limit(1);
        if (!wb) throw new TRPCError({ code: "NOT_FOUND", message: "Waybill not found." });
        if (wb.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Waybill is not in draft state." });
        if (!wb.loadedByName || !wb.transportedByName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Loaded by and transported by signatures are required." });
        }

        const lines = await db.select().from(waybillLines).where(eq(waybillLines.waybillId, wb.id));
        const lineIds = lines.map((line) => line.id);
        const sources =
          lineIds.length > 0
            ? await db.select().from(waybillLineCtnSources).where(inArray(waybillLineCtnSources.waybillLineId, lineIds))
            : [];
        const overrideBySourceId = new Map((input.overrideApprovals ?? []).map((entry) => [entry.ctnSourceId, entry]));
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
            const stockCardId = await ensureStockCard(source.ctnId, wb.warehouseId);
            const balance = await stockCardNet(stockCardId);
            if (balance < Number(source.quantity)) {
              errors.push(`Line ${line.id}: CTN ${source.ctnId} balance ${balance} is below requested ${source.quantity}.`);
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
                continue;
              }
            }
          }
        }

        if (errors.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: errors.join(" ") });
        }

        const today = new Date().toISOString().slice(0, 10);
        for (const source of sources) {
          const line = lines.find((l) => l.id === source.waybillLineId)!;
          const stockCardId = await ensureStockCard(source.ctnId, wb.warehouseId);
          const prev = await stockCardNet(stockCardId);
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
            createdBy: ctx.user.id,
          });
          await applyTransitionalInventoryStockReceipt(db, {
            catalogueId: (
              await db
                .select({ itemId: commodityTrackingNumbers.itemId })
                .from(commodityTrackingNumbers)
                .where(eq(commodityTrackingNumbers.id, source.ctnId))
                .limit(1)
            )[0]!.itemId,
            warehouseId: wb.warehouseId,
            quantity: -Math.abs(Number(source.quantity)),
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

  issues: router({
    create: protectedProcedure
      .input(
        z.object({
          fromWarehouseId: z.number(),
          destinationName: z.string().optional(),
          issueType: z.enum(["distribution", "transfer_out", "return", "loss"]),
          referenceDocument: z.string().optional(),
          transportDetails: z.any().optional(),
          items: z.array(documentItemSchema).min(1),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const documentNumber = await nextDocumentNumber("WB");
        const [doc] = await db
          .insert(inventoryDocuments)
          .values({
            documentType: "waybill",
            documentNumber,
            status: "pending_approval",
            fromWarehouseId: input.fromWarehouseId,
            items: input.items,
            referenceDocument: input.referenceDocument ?? input.destinationName ?? null,
            transportDetails: input.transportDetails ?? null,
            notes: input.notes ?? null,
            createdBy: ctx.user.id,
          })
          .returning();
        return doc;
      }),

    approve: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        await db
          .update(inventoryDocuments)
          .set({ status: "approved", approvedBy: ctx.user.id, approvedAt: new Date() })
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "waybill")));
        return { success: true as const };
      }),

    dispatch: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [doc] = await db
          .select()
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "waybill")))
          .limit(1);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Waybill not found." });
        const lines = Array.isArray(doc.items) ? (doc.items as z.infer<typeof documentItemSchema>[]) : [];
        for (const line of lines) {
          const stock = await getOrCreateStock(line.catalogueId, Number(doc.fromWarehouseId));
          if (Number(stock.quantityOnHand) < Number(line.quantity)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Insufficient stock for catalogue item ${line.catalogueId}.`,
            });
          }
          const nextOnHand = Number(stock.quantityOnHand) - Number(line.quantity);
          await db
            .update(inventoryStock)
            .set({ quantityOnHand: nextOnHand, lastMovementAt: new Date(), updatedAt: new Date() })
            .where(eq(inventoryStock.id, stock.id));
          const batches = await db
            .select()
            .from(inventoryBatches)
            .where(and(eq(inventoryBatches.stockId, stock.id), eq(inventoryBatches.status, "active")))
            .orderBy(asc(inventoryBatches.expiryDate), asc(inventoryBatches.receivedDate));
          let remaining = Number(line.quantity);
          for (const batch of batches) {
            if (remaining <= 0) break;
            const consume = Math.min(remaining, Number(batch.quantity));
            remaining -= consume;
            await db
              .update(inventoryBatches)
              .set({ quantity: Number(batch.quantity) - consume, status: Number(batch.quantity) - consume <= 0 ? "disposed" : "active" })
              .where(eq(inventoryBatches.id, batch.id));
          }
          await db.insert(inventoryMovements).values({
            movementType: "issue",
            catalogueId: line.catalogueId,
            stockId: stock.id,
            fromWarehouseId: doc.fromWarehouseId,
            quantityChange: -Math.abs(line.quantity),
            balanceAfter: nextOnHand,
            documentType: "waybill",
            documentId: doc.id,
            documentNumber: doc.documentNumber,
            performedBy: ctx.user.id,
            approvedBy: doc.approvedBy,
            reason: "Waybill dispatch",
            notes: line.notes ?? null,
          });
        }
        await db
          .update(inventoryDocuments)
          .set({ status: "dispatched", completedAt: new Date() })
          .where(eq(inventoryDocuments.id, doc.id));
        return { success: true as const };
      }),

    complete: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        await db
          .update(inventoryDocuments)
          .set({ status: "completed", completedAt: new Date(), approvedBy: ctx.user.id })
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "waybill")));
        return { success: true as const };
      }),

    list: protectedProcedure
      .input(z.object({ warehouseId: z.number().optional(), status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(inventoryDocuments)
          .where(
            and(
              eq(inventoryDocuments.documentType, "waybill"),
              input?.warehouseId ? eq(inventoryDocuments.fromWarehouseId, input.warehouseId) : undefined,
              input?.status ? eq(inventoryDocuments.status, input.status) : undefined
            )
          )
          .orderBy(desc(inventoryDocuments.createdAt));
      }),

    get: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [doc] = await db
          .select()
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "waybill")))
          .limit(1);
        return doc ?? null;
      }),
    downloadPdf: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [doc] = await db
          .select()
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "waybill")))
          .limit(1);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Waybill not found." });
        const rows = [
          { label: "Document Number", value: doc.documentNumber },
          { label: "Status", value: doc.status ?? "draft" },
          { label: "From Warehouse", value: doc.fromWarehouseId ?? "—" },
          { label: "Created At", value: doc.createdAt ? new Date(doc.createdAt).toISOString() : "—" },
          { label: "Notes", value: doc.notes ?? "—" },
        ];
        const buffer = await generateWaybillPdf({ rows });
        return {
          data: buffer.toString("base64"),
          filename: `${doc.documentNumber}.pdf`,
          mimeType: "application/pdf",
        };
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
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const documentNumber = await nextDocumentNumber("TN");
        const [doc] = await db
          .insert(inventoryDocuments)
          .values({
            documentType: "transfer_note",
            documentNumber,
            status: "pending_approval",
            fromWarehouseId: input.fromWarehouseId,
            toWarehouseId: input.toWarehouseId,
            items: input.items,
            referenceDocument: input.referenceDocument ?? null,
            transportDetails: input.transportDetails ?? null,
            notes: input.notes ?? null,
            createdBy: ctx.user.id,
          })
          .returning();
        return doc;
      }),

    approve: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        await db
          .update(inventoryDocuments)
          .set({ status: "approved", approvedBy: ctx.user.id, approvedAt: new Date() })
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "transfer_note")));
        return { success: true as const };
      }),

    dispatch: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [doc] = await db
          .select()
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "transfer_note")))
          .limit(1);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer note not found." });
        const lines = Array.isArray(doc.items) ? (doc.items as z.infer<typeof documentItemSchema>[]) : [];
        for (const line of lines) {
          const source = await getOrCreateStock(line.catalogueId, Number(doc.fromWarehouseId));
          const dest = await getOrCreateStock(line.catalogueId, Number(doc.toWarehouseId));
          if (Number(source.quantityOnHand) < Number(line.quantity)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient stock for item ${line.catalogueId}.` });
          }
          await db
            .update(inventoryStock)
            .set({ quantityOnHand: Number(source.quantityOnHand) - Number(line.quantity), updatedAt: new Date() })
            .where(eq(inventoryStock.id, source.id));
          await checkStockThreshold(source.id);
          await db
            .update(inventoryStock)
            .set({ quantityInTransit: Number(dest.quantityInTransit ?? 0) + Number(line.quantity), updatedAt: new Date() })
            .where(eq(inventoryStock.id, dest.id));
          await db.insert(inventoryMovements).values({
            movementType: "transfer_out",
            catalogueId: line.catalogueId,
            stockId: source.id,
            fromWarehouseId: doc.fromWarehouseId,
            toWarehouseId: doc.toWarehouseId,
            quantityChange: -Math.abs(line.quantity),
            balanceAfter: Number(source.quantityOnHand) - Number(line.quantity),
            documentType: "transfer_note",
            documentId: doc.id,
            documentNumber: doc.documentNumber,
            performedBy: ctx.user.id,
            approvedBy: doc.approvedBy,
            reason: "Transfer dispatch",
          });
        }
        await db.update(inventoryDocuments).set({ status: "dispatched" }).where(eq(inventoryDocuments.id, doc.id));
        return { success: true as const };
      }),

    receive: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx, ["staff", "manager", "admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
        const [doc] = await db
          .select()
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "transfer_note")))
          .limit(1);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer note not found." });
        const lines = Array.isArray(doc.items) ? (doc.items as z.infer<typeof documentItemSchema>[]) : [];
        for (const line of lines) {
          const dest = await getOrCreateStock(line.catalogueId, Number(doc.toWarehouseId));
          await db
            .update(inventoryStock)
            .set({
              quantityInTransit: Math.max(0, Number(dest.quantityInTransit ?? 0) - Number(line.quantity)),
              quantityOnHand: Number(dest.quantityOnHand) + Number(line.quantity),
              lastMovementAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(inventoryStock.id, dest.id));
          await checkStockThreshold(dest.id);
          await db.insert(inventoryMovements).values({
            movementType: "transfer_in",
            catalogueId: line.catalogueId,
            stockId: dest.id,
            fromWarehouseId: doc.fromWarehouseId,
            toWarehouseId: doc.toWarehouseId,
            quantityChange: Math.abs(line.quantity),
            balanceAfter: Number(dest.quantityOnHand) + Number(line.quantity),
            documentType: "transfer_note",
            documentId: doc.id,
            documentNumber: doc.documentNumber,
            performedBy: ctx.user.id,
            approvedBy: doc.approvedBy,
            reason: "Transfer receive",
          });
        }
        await db
          .update(inventoryDocuments)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(inventoryDocuments.id, doc.id));
        return { success: true as const };
      }),

    list: protectedProcedure
      .input(z.object({ warehouseId: z.number().optional(), status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
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
      }),

    get: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [doc] = await db
          .select()
          .from(inventoryDocuments)
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "transfer_note")))
          .limit(1);
        return doc ?? null;
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
        if (req.status !== "hq_approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Requisition must be HQ approved." });
        const items = Array.isArray(req.items) ? (req.items as Array<{ catalogueId: number; quantity: number; notes?: string }>) : [];
        const documentNumber = await nextDocumentNumber("WB");
        const [doc] = await db
          .insert(inventoryDocuments)
          .values({
            documentType: "waybill",
            documentNumber,
            status: "dispatched",
            fromWarehouseId: input.fromWarehouseId,
            items: items.map((x) => ({ catalogueId: x.catalogueId, quantity: x.quantity, notes: x.notes })),
            notes: `Fulfillment for ${req.reqNumber}`,
            createdBy: ctx.user.id,
            approvedBy: ctx.user.id,
            completedAt: new Date(),
          })
          .returning();
        await db
          .update(requisitions)
          .set({ status: "fulfilled", fulfilledAt: new Date(), linkedWaybills: [doc.documentNumber], updatedAt: new Date() })
          .where(eq(requisitions.id, req.id));
        return { success: true as const, waybillNumber: doc.documentNumber };
      }),

    cancel: protectedProcedure.input(z.object({ requisitionId: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const [req] = await db.select().from(requisitions).where(eq(requisitions.id, input.requisitionId)).limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Requisition not found." });
      if (req.requestedBy !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (["branch_approved", "hq_approved", "fulfilled"].includes(req.status ?? "")) throw new TRPCError({ code: "BAD_REQUEST" });
      await db.update(requisitions).set({ status: "cancelled", updatedAt: new Date() }).where(eq(requisitions.id, req.id));
      return { success: true as const };
    }),

    list: protectedProcedure
      .input(z.object({ status: z.string().optional(), priority: z.string().optional(), facilityId: z.number().optional(), search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const filters = [];
        if (input?.status) filters.push(eq(requisitions.status, input.status));
        if (input?.priority) filters.push(eq(requisitions.priority, input.priority));
        if (input?.facilityId) filters.push(eq(requisitions.requestingFacility, input.facilityId));
        if (input?.search?.trim()) filters.push(ilike(requisitions.title, `%${input.search.trim()}%`));
        return db.select().from(requisitions).where(filters.length ? and(...filters) : undefined).orderBy(desc(requisitions.createdAt));
      }),

    get: protectedProcedure.input(z.object({ requisitionId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [req] = await db.select().from(requisitions).where(eq(requisitions.id, input.requisitionId)).limit(1);
      return req ?? null;
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
          const [stock] = await db
            .select()
            .from(inventoryStock)
            .where(and(eq(inventoryStock.catalogueId, item.catalogueId), eq(inventoryStock.warehouseId, wh.id)))
            .limit(1);
          if (!stock || Number(stock.quantityOnHand) < Number(item.quantity)) {
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
          const stock = await getOrCreateStock(comp.catalogueId, input.warehouseId);
          // TODO(Phase 5): TRANSITIONAL: inventory_stock is written alongside stock_movements.
          await db
            .update(inventoryStock)
            .set({ quantityOnHand: Number(stock.quantityOnHand) - required, updatedAt: new Date(), lastMovementAt: new Date() })
            .where(eq(inventoryStock.id, stock.id));
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
          const kitStock = await getOrCreateStock(kit.catalogueId, input.warehouseId);
          // TODO(Phase 5): TRANSITIONAL: inventory_stock is written alongside stock_movements.
          await db
            .update(inventoryStock)
            .set({ quantityOnHand: Number(kitStock.quantityOnHand) + Number(input.quantity), updatedAt: new Date(), lastMovementAt: new Date() })
            .where(eq(inventoryStock.id, kitStock.id));
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
        const kitStock = await getOrCreateStock(kit.catalogueId, input.warehouseId);
        if (Number(kitStock.quantityOnHand) < input.quantity) throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient kit stock." });
        // TODO(Phase 5): TRANSITIONAL: inventory_stock is written alongside stock_movements.
        await db.update(inventoryStock).set({ quantityOnHand: Number(kitStock.quantityOnHand) - input.quantity, updatedAt: new Date(), lastMovementAt: new Date() }).where(eq(inventoryStock.id, kitStock.id));
        const components = Array.isArray(kit.components) ? (kit.components as Array<{ catalogueId: number; quantity: number }>) : [];
        const [blendedDonor] = await db.select({ id: donors.id }).from(donors).where(eq(donors.code, "BLENDED")).limit(1);
        if (!blendedDonor) throw new TRPCError({ code: "BAD_REQUEST", message: "BLENDED donor is missing." });
        for (const comp of components) {
          const stock = await getOrCreateStock(comp.catalogueId, input.warehouseId);
          const add = Number(comp.quantity) * Number(input.quantity);
          const next = Number(stock.quantityOnHand) + add;
          // TODO(Phase 5): TRANSITIONAL: inventory_stock is written alongside stock_movements.
          await db.update(inventoryStock).set({ quantityOnHand: next, updatedAt: new Date(), lastMovementAt: new Date() }).where(eq(inventoryStock.id, stock.id));
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

  reports: router({
    donorContributionPreview: protectedProcedure
      .input(z.object({ kitCtnId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const totals = await expandKitDonorContribution(db, input.kitCtnId);
        return Array.from(totals.entries()).map(([donorId, totalUnits]) => ({ donorId, totalUnits }));
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
            warehouseId: inventoryStock.warehouseId,
            warehouseName: sites.name,
            category: inventoryCatalogue.category,
            quantityOnHand: inventoryStock.quantityOnHand,
            minLevel: inventoryStock.minLevel,
            maxLevel: inventoryStock.maxLevel,
            safetyStockLevel: inventoryStock.safetyStockLevel,
          })
          .from(inventoryStock)
          .innerJoin(inventoryCatalogue, eq(inventoryStock.catalogueId, inventoryCatalogue.id))
          .innerJoin(sites, eq(inventoryStock.warehouseId, sites.id))
          .where(
            and(
              input?.warehouseId ? eq(inventoryStock.warehouseId, input.warehouseId) : undefined,
              input?.category ? eq(inventoryCatalogue.category, input.category) : undefined
            )
          );

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
          const qty = safeNumber(row.quantityOnHand);
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
        })
      )
      .query(async ({ input, ctx }) => {
        requireRole(ctx, ["manager", "admin"]);
        const db = await getDb();
        if (!db) return null;
        const rows = await db
          .select({
            movementType: inventoryMovements.movementType,
            quantityChange: inventoryMovements.quantityChange,
            createdAt: inventoryMovements.createdAt,
            fromWarehouseId: inventoryMovements.fromWarehouseId,
            toWarehouseId: inventoryMovements.toWarehouseId,
            category: inventoryCatalogue.category,
            itemCode: inventoryCatalogue.itemCode,
          })
          .from(inventoryMovements)
          .innerJoin(inventoryCatalogue, eq(inventoryMovements.catalogueId, inventoryCatalogue.id))
          .where(and(gte(inventoryMovements.createdAt, input.startDate), lte(inventoryMovements.createdAt, input.endDate)));

        let receiptsVolume = 0;
        let issuesVolume = 0;
        const byCategory = new Map<string, number>();
        const byWarehouse = new Map<string, number>();
        const byType = new Map<string, number>();
        const itemMovements = new Map<string, number>();
        for (const row of rows) {
          const qty = Math.abs(safeNumber(row.quantityChange));
          if (["receipt", "transfer_in"].includes(String(row.movementType))) receiptsVolume += qty;
          if (["issue", "transfer_out", "distribution", "loss"].includes(String(row.movementType))) issuesVolume += qty;
          byCategory.set(String(row.category), (byCategory.get(String(row.category)) ?? 0) + qty);
          const wh = String(row.fromWarehouseId ?? row.toWarehouseId ?? "unknown");
          byWarehouse.set(wh, (byWarehouse.get(wh) ?? 0) + qty);
          byType.set(String(row.movementType), (byType.get(String(row.movementType)) ?? 0) + qty);
          itemMovements.set(row.itemCode, (itemMovements.get(row.itemCode) ?? 0) + qty);
        }
        const turnoverRows = Array.from(itemMovements.entries()).map(([itemCode, volume]) => ({
          itemCode,
          turnoverRatio: volume / Math.max(1, (rows.length || 1)),
          volume,
        }));
        turnoverRows.sort((a, b) => b.volume - a.volume);
        return {
          totalReceipts: { volume: receiptsVolume, value: receiptsVolume },
          totalIssues: { volume: issuesVolume, value: issuesVolume },
          byCategory: Array.from(byCategory.entries()).map(([category, volume]) => ({ category, volume })),
          byWarehouse: Array.from(byWarehouse.entries()).map(([warehouseId, volume]) => ({ warehouseId, volume })),
          byMovementType: Array.from(byType.entries()).map(([movementType, volume]) => ({ movementType, volume })),
          turnoverRatio: turnoverRows,
          fastMovingItems: turnoverRows.slice(0, 10),
          slowMovingItems: turnoverRows.slice(-10).reverse(),
        };
      }),

    expiryForecast: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx, ["manager", "admin"]);
      const db = await getDb();
      if (!db) return null;
      const days = [30, 60, 90, 180];
      const today = new Date();
      const upcomingByWindow: Record<string, number> = {};
      for (const d of days) {
        const until = new Date(today.getTime() + d * 86400000).toISOString().slice(0, 10);
        const rows = await db
          .select({ qty: inventoryBatches.quantity })
          .from(inventoryBatches)
          .where(
            and(
              eq(inventoryBatches.status, "active"),
              gte(inventoryBatches.expiryDate, today.toISOString().slice(0, 10)),
              lte(inventoryBatches.expiryDate, until)
            )
          );
        upcomingByWindow[`${d}d`] = rows.reduce((acc, r) => acc + safeNumber(r.qty), 0);
      }
      const pastYear = new Date(today.getTime() - 365 * 86400000);
      const losses = await db
        .select({
          month: inventoryMovements.createdAt,
          qty: inventoryMovements.quantityChange,
        })
        .from(inventoryMovements)
        .where(and(eq(inventoryMovements.reason, "expired"), gte(inventoryMovements.createdAt, pastYear)));
      const historicalLosses = losses.reduce<Record<string, number>>((acc, row) => {
        const key = toMonthKey(row.month);
        acc[key] = (acc[key] ?? 0) + Math.abs(safeNumber(row.qty));
        return acc;
      }, {});
      const riskRows = await db
        .select({
          itemCode: inventoryCatalogue.itemCode,
          itemName: inventoryCatalogue.name,
          qty: inventoryBatches.quantity,
          expiryDate: inventoryBatches.expiryDate,
        })
        .from(inventoryBatches)
        .innerJoin(inventoryStock, eq(inventoryBatches.stockId, inventoryStock.id))
        .innerJoin(inventoryCatalogue, eq(inventoryStock.catalogueId, inventoryCatalogue.id))
        .where(eq(inventoryBatches.status, "active"))
        .orderBy(asc(inventoryBatches.expiryDate));
      return {
        upcomingByWindow,
        historicalLosses,
        highestRiskItems: riskRows.slice(0, 20),
      };
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
          qty: inventoryStock.quantityOnHand,
          minLevel: inventoryStock.minLevel,
          safety: inventoryStock.safetyStockLevel,
        })
        .from(inventoryStock)
        .innerJoin(inventoryCatalogue, eq(inventoryStock.catalogueId, inventoryCatalogue.id));
      const grouped = new Map<string, { ved: string; count: number; value: number; serviceLevel: number }>();
      for (const row of rows) {
        const key = row.ved ?? "unknown";
        const prev = grouped.get(key) ?? { ved: key, count: 0, value: 0, serviceLevel: 0 };
        prev.count += 1;
        prev.value += safeNumber(row.qty);
        const threshold = row.safety == null ? safeNumber(row.minLevel) : safeNumber(row.safety);
        if (safeNumber(row.qty) >= threshold) prev.serviceLevel += 1;
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
          itemCode: inventoryCatalogue.itemCode,
          itemName: inventoryCatalogue.name,
          qty: inventoryMovements.quantityChange,
        })
        .from(inventoryMovements)
        .innerJoin(inventoryCatalogue, eq(inventoryMovements.catalogueId, inventoryCatalogue.id))
        .where(inArray(inventoryMovements.movementType, ["issue", "distribution"] as any));
      const byItem = new Map<string, { itemCode: string; itemName: string; consumptionValue: number }>();
      for (const row of rows) {
        const prev = byItem.get(row.itemCode) ?? { itemCode: row.itemCode, itemName: row.itemName, consumptionValue: 0 };
        prev.consumptionValue += Math.abs(safeNumber(row.qty));
        byItem.set(row.itemCode, prev);
      }
      const sorted = Array.from(byItem.values()).sort((a, b) => b.consumptionValue - a.consumptionValue);
      const total = sorted.reduce((a, b) => a + b.consumptionValue, 0) || 1;
      let cum = 0;
      return sorted.map((row) => {
        cum += row.consumptionValue;
        const pct = (cum / total) * 100;
        const abcClass = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
        return { ...row, cumulativePercent: pct, abcClass };
      });
    }),

    fnsAnalysis: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx, ["manager", "admin"]);
      const db = await getDb();
      if (!db) return [];
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000);
      const rows = await db
        .select({
          catalogueId: inventoryMovements.catalogueId,
          itemCode: inventoryCatalogue.itemCode,
          itemName: inventoryCatalogue.name,
          createdAt: inventoryMovements.createdAt,
        })
        .from(inventoryMovements)
        .innerJoin(inventoryCatalogue, eq(inventoryMovements.catalogueId, inventoryCatalogue.id))
        .where(inArray(inventoryMovements.movementType, ["issue", "distribution"] as any));
      const frequencyMap = new Map<number, { itemCode: string; itemName: string; count: number; lastMovementAt: Date | null }>();
      for (const row of rows) {
        const prev = frequencyMap.get(row.catalogueId) ?? { itemCode: row.itemCode, itemName: row.itemName, count: 0, lastMovementAt: null };
        prev.count += 1;
        const d = row.createdAt ? new Date(row.createdAt as any) : null;
        if (!prev.lastMovementAt || (d && d > prev.lastMovementAt)) prev.lastMovementAt = d;
        frequencyMap.set(row.catalogueId, prev);
      }
      return Array.from(frequencyMap.values()).map((row) => {
        const fnsClass = row.count >= 20 ? "fast" : row.count >= 8 ? "normal" : "slow";
        const deadStock = !row.lastMovementAt || row.lastMovementAt < sixMonthsAgo;
        return { ...row, fnsClass, deadStock };
      });
    }),

    warehouseUtilization: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx, ["manager", "admin"]);
      const db = await getDb();
      if (!db) return [];
      const warehouses = await db.select().from(sites).where(eq(sites.facilityType, "warehouse"));
      const out = [];
      for (const wh of warehouses) {
        const stocks = await db.select().from(inventoryStock).where(eq(inventoryStock.warehouseId, wh.id));
        const stockIds = stocks.map((s) => s.id);
        const movements = stockIds.length
          ? await db.select().from(inventoryMovements).where(inArray(inventoryMovements.stockId, stockIds))
          : [];
        const totalValue = stocks.reduce((a, s) => a + safeNumber(s.quantityOnHand), 0);
        const counts = stockIds.length
          ? await db
              .select()
              .from(inventoryCountLines)
              .where(inArray(inventoryCountLines.stockId, stockIds))
          : [];
        const accuracy =
          counts.length > 0
            ? (counts.filter((c) => safeNumber(c.varianceQuantity) === 0).length / counts.length) * 100
            : 100;
        out.push({
          warehouseId: wh.id,
          warehouseName: wh.name,
          itemCount: stocks.length,
          totalValue,
          movementCount: movements.length,
          stockAccuracy: accuracy,
        });
      }
      return out;
    }),

    forecastDemand: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx, ["manager", "admin"]);
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          warehouseId: inventoryMovements.fromWarehouseId,
          catalogueId: inventoryMovements.catalogueId,
          itemCode: inventoryCatalogue.itemCode,
          itemName: inventoryCatalogue.name,
          qty: inventoryMovements.quantityChange,
          createdAt: inventoryMovements.createdAt,
        })
        .from(inventoryMovements)
        .innerJoin(inventoryCatalogue, eq(inventoryMovements.catalogueId, inventoryCatalogue.id))
        .where(inArray(inventoryMovements.movementType, ["issue", "distribution"] as any));
      const monthMap = new Map<string, number>();
      for (const row of rows) {
        const key = `${row.catalogueId}:${row.warehouseId ?? 0}:${toMonthKey(row.createdAt as any)}`;
        monthMap.set(key, (monthMap.get(key) ?? 0) + Math.abs(safeNumber(row.qty)));
      }
      const grouped = new Map<string, { catalogueId: number; warehouseId: number; itemCode: string; itemName: string; monthly: number[] }>();
      for (const row of rows) {
        const gk = `${row.catalogueId}:${row.warehouseId ?? 0}`;
        const current =
          grouped.get(gk) ?? {
            catalogueId: row.catalogueId,
            warehouseId: row.warehouseId ?? 0,
            itemCode: row.itemCode,
            itemName: row.itemName,
            monthly: [],
          };
        grouped.set(gk, current);
      }
      for (const [gk, g] of Array.from(grouped.entries())) {
        const months = Array.from(monthMap.entries())
          .filter(([k]) => k.startsWith(`${g.catalogueId}:${g.warehouseId}:`))
          .map(([, v]) => v)
          .sort((a, b) => a - b);
        g.monthly = months;
        grouped.set(gk, g);
      }
      return Array.from(grouped.values()).map((g) => {
        const avg = g.monthly.length ? g.monthly.reduce((a, b) => a + b, 0) / g.monthly.length : 0;
        const rolling3 = g.monthly.slice(-3);
        const rollingAvg = rolling3.length ? rolling3.reduce((a, b) => a + b, 0) / rolling3.length : avg;
        const seasonalAdjustment = g.monthly.length >= 12 ? 1.05 : 1;
        const forecast = rollingAvg * seasonalAdjustment;
        return {
          ...g,
          monthlyAverageConsumption: avg,
          rolling3MonthAverage: rollingAvg,
          seasonalAdjustment,
          recommendedReorderQty: Math.ceil(forecast * 1.5),
          recommendedReorderTimingDays: Math.max(7, Math.round(30 - Math.min(20, forecast))),
        };
      });
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
        db.select().from(inventoryStock),
        db
          .select()
          .from(inventoryMovements)
          .where(gte(inventoryMovements.createdAt, new Date(Date.now() - 365 * 86400000))),
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
          const stock = await getOrCreateStock(row.catalogueId, row.warehouseId);
          await db
            .update(inventoryStock)
            .set({
              quantityOnHand: row.quantityOnHand,
              minLevel: row.minLevel ?? stock.minLevel,
              maxLevel: row.maxLevel ?? stock.maxLevel,
              safetyStockLevel: row.safetyLevel ?? stock.safetyStockLevel,
              updatedAt: new Date(),
            })
            .where(eq(inventoryStock.id, stock.id));
          if (row.batchNumber || row.expiryDate) {
            await db.insert(inventoryBatches).values({
              stockId: stock.id,
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
          const stock = await getOrCreateStock(row.catalogueId, row.warehouseId);
          const nextBalance =
            row.movementType === "issue" || row.movementType === "transfer_out" || row.movementType === "loss"
              ? Number(stock.quantityOnHand) - row.quantity
              : Number(stock.quantityOnHand) + row.quantity;
          await db.insert(inventoryMovements).values({
            movementType: row.movementType,
            catalogueId: row.catalogueId,
            stockId: stock.id,
            fromWarehouseId: row.warehouseId,
            quantityChange: ["issue", "transfer_out", "loss"].includes(row.movementType) ? -Math.abs(row.quantity) : Math.abs(row.quantity),
            balanceAfter: nextBalance,
            documentNumber: row.documentNumber ?? null,
            notes: row.notes ?? null,
            createdAt: new Date(row.date),
            performedBy: ctx.user.id,
          });
          await db.update(inventoryStock).set({ quantityOnHand: nextBalance, updatedAt: new Date() }).where(eq(inventoryStock.id, stock.id));
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
        const filters = [eq(inventoryStock.warehouseId, count.warehouseId)];
        if (input.catalogueIds?.length) filters.push(inArray(inventoryStock.catalogueId, input.catalogueIds));
        const stocks = await db.select().from(inventoryStock).where(and(...filters));
        for (const stock of stocks) {
          await db.insert(inventoryCountLines).values({
            countId: count.id,
            stockId: stock.id,
            expectedQuantity: stock.quantityOnHand,
          });
        }
        await db.update(inventoryCounts).set({ status: "in_progress", actualStartedAt: new Date() }).where(eq(inventoryCounts.id, count.id));
        return { lines: stocks.length };
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
          const [stock] = await db.select().from(inventoryStock).where(eq(inventoryStock.id, line.stockId)).limit(1);
          if (!stock) continue;
          const expected = Number(stock.quantityOnHand);
          const actual = Number(line.actualQuantity);
          if (actual !== expected) {
            varianceCount += 1;
            const stockCardId = await ensureCountStockCardForItemLocation({
              itemId: stock.catalogueId,
              locationId: stock.warehouseId,
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
          await db
            .update(inventoryStock)
            .set({ quantityOnHand: actual, lastCountedAt: new Date(), updatedAt: new Date() })
            .where(eq(inventoryStock.id, stock.id));
          await checkStockThreshold(stock.id);
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
        return { success: true as const, varianceCount };
      }),

    list: protectedProcedure
      .input(z.object({ warehouseId: z.number().optional(), status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(inventoryCounts)
          .where(
            and(
              input?.warehouseId ? eq(inventoryCounts.warehouseId, input.warehouseId) : undefined,
              input?.status ? eq(inventoryCounts.status, input.status) : undefined
            )
          )
          .orderBy(desc(inventoryCounts.createdAt));
      }),

    get: protectedProcedure
      .input(z.object({ countId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [count] = await db.select().from(inventoryCounts).where(eq(inventoryCounts.id, input.countId)).limit(1);
        if (!count) return null;
        const lines = await db
          .select({
            lineId: inventoryCountLines.id,
            countId: inventoryCountLines.countId,
            stockId: inventoryCountLines.stockId,
            expectedQuantity: inventoryCountLines.expectedQuantity,
            actualQuantity: inventoryCountLines.actualQuantity,
            varianceQuantity: inventoryCountLines.varianceQuantity,
            variancePercent: inventoryCountLines.variancePercent,
            varianceReason: inventoryCountLines.varianceReason,
            varianceNotes: inventoryCountLines.varianceNotes,
            countedBy: inventoryCountLines.countedBy,
            countedAt: inventoryCountLines.countedAt,
            warehouseId: inventoryStock.warehouseId,
            quantityOnHand: inventoryStock.quantityOnHand,
            itemCode: inventoryCatalogue.itemCode,
            itemName: inventoryCatalogue.name,
          })
          .from(inventoryCountLines)
          .innerJoin(inventoryStock, eq(inventoryCountLines.stockId, inventoryStock.id))
          .innerJoin(inventoryCatalogue, eq(inventoryStock.catalogueId, inventoryCatalogue.id))
          .where(eq(inventoryCountLines.countId, count.id));
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
            stockId: inventoryStock.id,
            warehouseName: sites.name,
            itemCode: inventoryCatalogue.itemCode,
            itemName: inventoryCatalogue.name,
          })
          .from(inventoryBatches)
          .innerJoin(inventoryStock, eq(inventoryBatches.stockId, inventoryStock.id))
          .innerJoin(inventoryCatalogue, eq(inventoryStock.catalogueId, inventoryCatalogue.id))
          .innerJoin(sites, eq(inventoryStock.warehouseId, sites.id))
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
        const [stock] = await db.select().from(inventoryStock).where(eq(inventoryStock.id, batch.stockId)).limit(1);
        if (!stock) throw new TRPCError({ code: "NOT_FOUND", message: "Stock not found." });
        const next = Math.max(0, Number(stock.quantityOnHand) - Number(batch.quantity));
        await db.update(inventoryBatches).set({ status: "expired" }).where(eq(inventoryBatches.id, batch.id));
        await db.update(inventoryStock).set({ quantityOnHand: next, updatedAt: new Date(), lastMovementAt: new Date() }).where(eq(inventoryStock.id, stock.id));
        const stockCardId = await ensureCountStockCardForItemLocation({
          itemId: stock.catalogueId,
          locationId: stock.warehouseId,
          expectedBalance: Number(stock.quantityOnHand),
          createdBy: ctx.user.id,
        });
        const cardBalance = await stockCardNet(stockCardId);
        await db.insert(stockMovements).values({
          stockCardId,
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
        await checkStockThreshold(stock.id);
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
          const [stock] = await db.select().from(inventoryStock).where(eq(inventoryStock.id, batch.stockId)).limit(1);
          if (!stock) continue;
          const next = Math.max(0, Number(stock.quantityOnHand) - Number(batch.quantity));
          await db.update(inventoryBatches).set({ status: "expired" }).where(eq(inventoryBatches.id, batch.id));
          await db.update(inventoryStock).set({ quantityOnHand: next, updatedAt: new Date(), lastMovementAt: new Date() }).where(eq(inventoryStock.id, stock.id));
          const stockCardId = await ensureCountStockCardForItemLocation({
            itemId: stock.catalogueId,
            locationId: stock.warehouseId,
            expectedBalance: Number(stock.quantityOnHand),
            createdBy: ctx.user.id,
          });
          const cardBalance = await stockCardNet(stockCardId);
          await db.insert(stockMovements).values({
            stockCardId,
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
