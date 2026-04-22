/**
 * WMS (IFRC supply chain) — CTN registry and related procedures.
 * GRN lines with `ctnId` write to `stock_movements` on approval (Phase 2 — see `server/wms/grnStockLedger.ts`).
 */
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  commodityTrackingNumbers,
  donors,
  inventoryCatalogue,
  stockCards,
  stockMovements,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { itemCategoryZod } from "../../shared/itemCategory";

const listInput = z.object({
  donorId: z.number().int().positive().optional(),
  itemCategory: itemCategoryZod.optional(),
  expiryFrom: z.string().optional(),
  expiryTo: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

const createInput = z.object({
  ctnCode: z.string().min(1).max(64),
  donorId: z.number().int().positive(),
  itemId: z.number().int().positive(),
  receivedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  unit: z.string().min(1).max(50),
  originalQuantity: z.number().positive(),
  notes: z.string().optional(),
});

async function computeCtnBalance(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  ctnId: number,
  originalQuantity: number
): Promise<number> {
  const [movCount] = await db
    .select({ c: count() })
    .from(stockMovements)
    .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
    .where(eq(stockCards.ctnId, ctnId));

  const movementRows = Number(movCount?.c ?? 0);
  if (movementRows === 0) {
    return originalQuantity;
  }

  const [agg] = await db
    .select({
      net: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`.mapWith(
        Number
      ),
    })
    .from(stockMovements)
    .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
    .where(eq(stockCards.ctnId, ctnId));

  return Number(agg?.net ?? 0);
}

export const wmsRouter = router({
  ctn: router({
    list: protectedProcedure.input(listInput).query(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [];

      if (input.donorId) {
        conditions.push(eq(commodityTrackingNumbers.donorId, input.donorId));
      }
      if (input.itemCategory) {
        conditions.push(eq(inventoryCatalogue.itemCategory, input.itemCategory));
      }
      if (input.expiryFrom) {
        conditions.push(gte(commodityTrackingNumbers.expiryDate, input.expiryFrom));
      }
      if (input.expiryTo) {
        conditions.push(lte(commodityTrackingNumbers.expiryDate, input.expiryTo));
      }
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conditions.push(
          or(
            ilike(commodityTrackingNumbers.ctnCode, q),
            ilike(inventoryCatalogue.name, q),
            ilike(inventoryCatalogue.itemCode, q)
          )!
        );
      }

      const whereClause = conditions.length ? and(...conditions) : undefined;

      const rows = await database
        .select({
          id: commodityTrackingNumbers.id,
          ctnCode: commodityTrackingNumbers.ctnCode,
          donorId: commodityTrackingNumbers.donorId,
          donorName: donors.name,
          donorCode: donors.code,
          itemId: commodityTrackingNumbers.itemId,
          itemCode: inventoryCatalogue.itemCode,
          itemName: inventoryCatalogue.name,
          itemCategory: inventoryCatalogue.itemCategory,
          receivedDate: commodityTrackingNumbers.receivedDate,
          expiryDate: commodityTrackingNumbers.expiryDate,
          unit: commodityTrackingNumbers.unit,
          originalQuantity: commodityTrackingNumbers.originalQuantity,
          status: commodityTrackingNumbers.status,
          notes: commodityTrackingNumbers.notes,
        })
        .from(commodityTrackingNumbers)
        .innerJoin(donors, eq(commodityTrackingNumbers.donorId, donors.id))
        .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
        .where(whereClause)
        .orderBy(desc(commodityTrackingNumbers.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const withBalance = await Promise.all(
        rows.map(async (r) => ({
          ...r,
          currentBalance: await computeCtnBalance(database, r.id, Number(r.originalQuantity)),
        }))
      );

      const [totalRow] = await database
        .select({ c: count() })
        .from(commodityTrackingNumbers)
        .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
        .where(whereClause);

      return {
        items: withBalance,
        total: Number(totalRow?.c ?? 0),
      };
    }),

    create: protectedProcedure.input(createInput).mutation(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const donor = await database.select().from(donors).where(eq(donors.id, input.donorId)).limit(1);
      if (!donor.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Donor not found" });
      }

      const item = await database
        .select()
        .from(inventoryCatalogue)
        .where(eq(inventoryCatalogue.id, input.itemId))
        .limit(1);
      if (!item.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Catalogue item not found" });
      }

      const existing = await database
        .select({ id: commodityTrackingNumbers.id })
        .from(commodityTrackingNumbers)
        .where(eq(commodityTrackingNumbers.ctnCode, input.ctnCode.trim()))
        .limit(1);
      if (existing.length) {
        throw new TRPCError({ code: "CONFLICT", message: "CTN code already exists" });
      }

      const [row] = await database
        .insert(commodityTrackingNumbers)
        .values({
          ctnCode: input.ctnCode.trim(),
          donorId: input.donorId,
          itemId: input.itemId,
          receivedDate: input.receivedDate ?? null,
          expiryDate: input.expiryDate ?? null,
          unit: input.unit,
          originalQuantity: input.originalQuantity,
          notes: input.notes ?? null,
          status: "active",
        })
        .returning();

      return row;
    }),

    donors: protectedProcedure.query(async () => {
      const database = await getDb();
      if (!database) return [];
      return database.select().from(donors).orderBy(donors.name);
    }),
  }),
});
