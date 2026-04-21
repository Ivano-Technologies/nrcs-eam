import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  distributions,
  inventoryKits,
  kitAssemblies,
  requisitions,
  inventoryCountLines,
  inventoryCounts,
  inventoryBatches,
  inventoryCatalogue,
  inventoryDocuments,
  inventoryMovements,
  inventoryStock,
  sites,
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
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
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
          items: z.array(documentItemSchema).min(1),
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
        const lines = Array.isArray(doc.items) ? (doc.items as z.infer<typeof documentItemSchema>[]) : [];
        for (const line of lines) {
          const stock = await getOrCreateStock(line.catalogueId, Number(doc.toWarehouseId));
          const nextOnHand = Number(stock.quantityOnHand) + Number(line.quantity);
          await db
            .update(inventoryStock)
            .set({ quantityOnHand: nextOnHand, lastMovementAt: new Date(), updatedAt: new Date() })
            .where(eq(inventoryStock.id, stock.id));
          let createdBatchId: number | null = null;
          if (line.batchNumber || line.expiryDate) {
            const [batch] = await db
              .insert(inventoryBatches)
              .values({
                stockId: stock.id,
                batchNumber: line.batchNumber ?? null,
                expiryDate: line.expiryDate ?? null,
                quantity: line.quantity,
                supplierName: doc.referenceDocument ?? null,
                notes: line.notes ?? null,
              })
              .returning();
            createdBatchId = batch.id;
          }
          await db.insert(inventoryMovements).values({
            movementType: "receipt",
            catalogueId: line.catalogueId,
            stockId: stock.id,
            batchId: createdBatchId,
            toWarehouseId: doc.toWarehouseId,
            quantityChange: line.quantity,
            balanceAfter: nextOnHand,
            documentType: "grn",
            documentId: doc.id,
            documentNumber: doc.documentNumber,
            performedBy: doc.createdBy,
            approvedBy: ctx.user.id,
            reason: "GRN approval",
            notes: line.notes ?? null,
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
      .input(z.object({ warehouseId: z.number().optional(), status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(inventoryDocuments)
          .where(
            and(
              eq(inventoryDocuments.documentType, "grn"),
              input?.warehouseId ? eq(inventoryDocuments.toWarehouseId, input.warehouseId) : undefined,
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
          .where(and(eq(inventoryDocuments.id, input.documentId), eq(inventoryDocuments.documentType, "grn")))
          .limit(1);
        return doc ?? null;
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
        for (const comp of components) {
          const stock = await getOrCreateStock(comp.catalogueId, input.warehouseId);
          const required = Number(comp.quantity) * Number(input.quantity);
          if (Number(stock.quantityOnHand) < required) throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient components." });
        }
        for (const comp of components) {
          const stock = await getOrCreateStock(comp.catalogueId, input.warehouseId);
          const used = Number(comp.quantity) * Number(input.quantity);
          const next = Number(stock.quantityOnHand) - used;
          await db.update(inventoryStock).set({ quantityOnHand: next, updatedAt: new Date() }).where(eq(inventoryStock.id, stock.id));
          await db.insert(inventoryMovements).values({
            movementType: "adjustment",
            catalogueId: comp.catalogueId,
            stockId: stock.id,
            fromWarehouseId: input.warehouseId,
            quantityChange: -used,
            balanceAfter: next,
            reason: "kit_assembly",
            performedBy: ctx.user.id,
          });
        }
        if (kit.catalogueId) {
          const kitStock = await getOrCreateStock(kit.catalogueId, input.warehouseId);
          const nextKit = Number(kitStock.quantityOnHand) + Number(input.quantity);
          await db.update(inventoryStock).set({ quantityOnHand: nextKit, updatedAt: new Date() }).where(eq(inventoryStock.id, kitStock.id));
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
        await db.update(inventoryStock).set({ quantityOnHand: Number(kitStock.quantityOnHand) - input.quantity, updatedAt: new Date() }).where(eq(inventoryStock.id, kitStock.id));
        const components = Array.isArray(kit.components) ? (kit.components as Array<{ catalogueId: number; quantity: number }>) : [];
        for (const comp of components) {
          const stock = await getOrCreateStock(comp.catalogueId, input.warehouseId);
          const add = Number(comp.quantity) * Number(input.quantity);
          const next = Number(stock.quantityOnHand) + add;
          await db.update(inventoryStock).set({ quantityOnHand: next, updatedAt: new Date() }).where(eq(inventoryStock.id, stock.id));
          await db.insert(inventoryMovements).values({
            movementType: "adjustment",
            catalogueId: comp.catalogueId,
            stockId: stock.id,
            toWarehouseId: input.warehouseId,
            quantityChange: add,
            balanceAfter: next,
            reason: "kit_disassembly",
            performedBy: ctx.user.id,
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
            await db.insert(inventoryMovements).values({
              movementType: "adjustment",
              catalogueId: stock.catalogueId,
              stockId: stock.id,
              fromWarehouseId: stock.warehouseId,
              quantityChange: actual - expected,
              balanceAfter: actual,
              reason: line.varianceReason ?? "count_variance",
              notes: line.varianceNotes ?? null,
              approvedBy: ctx.user.id,
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
        await db.update(inventoryStock).set({ quantityOnHand: next, updatedAt: new Date() }).where(eq(inventoryStock.id, stock.id));
        await db.insert(inventoryMovements).values({
          movementType: "loss",
          catalogueId: stock.catalogueId,
          stockId: stock.id,
          fromWarehouseId: stock.warehouseId,
          batchId: batch.id,
          quantityChange: -Math.abs(Number(batch.quantity)),
          balanceAfter: next,
          reason: "expired",
          approvedBy: ctx.user.id,
        });
        await checkStockThreshold(stock.id);
        return { success: true as const };
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
