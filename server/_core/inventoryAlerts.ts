import { and, eq, gte, lte, sql } from "drizzle-orm";
import { createNotificationDeduped, hasRecentNotification } from "./notificationDedup";
import { getAllUsers, getDb } from "../db";
import {
  commodityTrackingNumbers,
  donors,
  inventoryBatches,
  inventoryCatalogue,
  notificationPreferences,
  stockSettings,
  sites,
  stockCards,
  stockMovements,
} from "../../drizzle/schema";

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

async function stockCardBalance(stockCardId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({
      balance: sql<number>`coalesce(sum(${stockMovements.quantityIn}) - sum(${stockMovements.quantityOut}), 0)`,
    })
    .from(stockMovements)
    .where(eq(stockMovements.stockCardId, stockCardId));
  return Number(rows[0]?.balance ?? 0);
}

async function itemWarehouseNet(catalogueId: number, warehouseId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({
      balance: sql<number>`coalesce(sum(${stockMovements.quantityIn}) - sum(${stockMovements.quantityOut}), 0)`,
    })
    .from(stockMovements)
    .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .where(and(eq(commodityTrackingNumbers.itemId, catalogueId), eq(stockCards.locationId, warehouseId)));
  return Number(rows[0]?.balance ?? 0);
}

async function ensureExpiryStockCard(params: { catalogueId: number; warehouseId: number; expectedBalance: number }) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db
    .select({ id: stockCards.id })
    .from(stockCards)
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .where(and(eq(stockCards.locationId, params.warehouseId), eq(commodityTrackingNumbers.itemId, params.catalogueId)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [donor] = await db.select({ id: donors.id }).from(donors).where(eq(donors.code, "BLENDED")).limit(1);
  const donorId = donor?.id ?? (await db.select({ id: donors.id }).from(donors).limit(1))[0]?.id;
  if (!donorId) return null;

  const code = `CTN-EXP-${params.warehouseId}-${params.catalogueId}-${Date.now()}`;
  const [ctn] = await db
    .insert(commodityTrackingNumbers)
    .values({
      ctnCode: code,
      donorId,
      itemId: params.catalogueId,
      unit: "pieces",
      originalQuantity: Math.max(0, params.expectedBalance),
      status: "active",
      notes: "Auto-generated for inventory alert expiry migration",
    })
    .returning({ id: commodityTrackingNumbers.id });
  const [card] = await db
    .insert(stockCards)
    .values({ ctnId: ctn.id, locationId: params.warehouseId })
    .returning({ id: stockCards.id });
  if (params.expectedBalance > 0) {
    await db.insert(stockMovements).values({
      stockCardId: card.id,
      date: new Date().toISOString().slice(0, 10),
      documentRef: "AUTO-EXPIRY-BOOTSTRAP",
      fromTo: null,
      quantityIn: params.expectedBalance,
      quantityOut: 0,
      balanceAfter: params.expectedBalance,
      remarks: "Bootstrap stock card for expiry automation",
      sourceType: "import",
      createdBy: null,
    });
  }
  return card.id;
}

export function buildInventoryAlertExpiryMovement(params: { previousBalance: number; expiryQty: number }) {
  const quantityOut = Math.min(Math.max(0, params.expiryQty), Math.max(0, params.previousBalance));
  return {
    quantityIn: 0,
    quantityOut,
    balanceAfter: Math.max(0, params.previousBalance - quantityOut),
    sourceType: "expiry" as const,
  };
}

export async function checkStockThreshold(params: { catalogueId: number; warehouseId: number; relatedEntityId?: number }) {
  const db = await getDb();
  if (!db) return;
  const [settings] = await db
    .select()
    .from(stockSettings)
    .where(and(eq(stockSettings.catalogueId, params.catalogueId), eq(stockSettings.warehouseId, params.warehouseId)))
    .limit(1);
  const quantityOnHand = await itemWarehouseNet(params.catalogueId, params.warehouseId);
  const minLevel = Number(settings?.minLevel ?? 0);
  const safetyStockLevel = settings?.safetyStockLevel == null ? null : Number(settings.safetyStockLevel);
  const [warehouse] = await db.select().from(sites).where(eq(sites.id, params.warehouseId)).limit(1);
  const users = await getAllUsers();
  for (const user of users) {
    if (!["manager", "admin"].includes(user.role)) continue;
    if ((safetyStockLevel ?? 0) > 0 && quantityOnHand < (safetyStockLevel ?? 0)) {
      await createNotificationDeduped({
        userId: user.id,
        type: "critical_stock",
        title: "Critical Stock Alert",
        message: `${warehouse?.name ?? "Warehouse"} stock is below safety level.`,
        relatedEntityType: "inventory",
        relatedEntityId: params.relatedEntityId ?? null,
      });
    } else if (quantityOnHand < minLevel) {
      await createNotificationDeduped({
        userId: user.id,
        type: "low_stock",
        title: "Low Stock Alert",
        message: `${warehouse?.name ?? "Warehouse"} stock is below minimum level.`,
        relatedEntityType: "inventory",
        relatedEntityId: params.relatedEntityId ?? null,
      });
    }
  }
}

export async function runDailyChecks() {
  const db = await getDb();
  if (!db) return { checked: 0, expiredMarked: 0, notificationsSkipped: 0 };
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const in90Iso = in90.toISOString().slice(0, 10);
  const batches = await db
    .select({
      batchId: inventoryBatches.id,
      expiryDate: inventoryBatches.expiryDate,
      quantity: inventoryBatches.quantity,
      status: inventoryBatches.status,
      stockCardId: inventoryBatches.stockCardId,
      warehouseId: stockCards.locationId,
      catalogueId: commodityTrackingNumbers.itemId,
      itemName: inventoryCatalogue.name,
    })
    .from(inventoryBatches)
    .innerJoin(stockCards, eq(inventoryBatches.stockCardId, stockCards.id))
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .innerJoin(inventoryCatalogue, eq(commodityTrackingNumbers.itemId, inventoryCatalogue.id))
    .where(and(eq(inventoryBatches.status, "active"), lte(inventoryBatches.expiryDate, in90Iso)));

  let expiredMarked = 0;
  let notificationsSkipped = 0;
  const users = await getAllUsers();
  for (const b of batches) {
    if (!b.expiryDate) continue;
    const days = daysBetween(now, new Date(b.expiryDate));
    const type = days <= 30 ? "expiry_warning_30" : days <= 60 ? "expiry_warning_60" : "expiry_warning_90";
    for (const user of users) {
      if (!["manager", "admin"].includes(user.role)) continue;
      const dup = await hasRecentNotification({
        userId: user.id,
        type,
        relatedEntityType: "inventory",
        relatedEntityId: b.stockCardId,
        withinHours: 24,
      });
      if (dup) {
        notificationsSkipped += 1;
        continue;
      }
      await createNotificationDeduped({
        userId: user.id,
        type,
        title: "Expiry warning",
        message: `${b.itemName} batch expires in ${Math.max(days, 0)} day(s).`,
        relatedEntityType: "inventory",
        relatedEntityId: b.stockCardId,
      });
    }
    if (days < 0 && b.status !== "expired") {
      await db.update(inventoryBatches).set({ status: "expired" }).where(eq(inventoryBatches.id, b.batchId));
      const stockCardId = await ensureExpiryStockCard({
        catalogueId: b.catalogueId,
        warehouseId: b.warehouseId,
        expectedBalance: Number(b.quantity),
      });
      if (stockCardId) {
        const previous = await stockCardBalance(stockCardId);
        const mapped = buildInventoryAlertExpiryMovement({
          previousBalance: previous > 0 ? previous : Number(b.quantity),
          expiryQty: Number(b.quantity),
        });
        await db.insert(stockMovements).values({
          stockCardId,
          date: new Date().toISOString().slice(0, 10),
          documentRef: "AUTO-EXPIRY",
          fromTo: null,
          quantityIn: mapped.quantityIn,
          quantityOut: mapped.quantityOut,
          balanceAfter: mapped.balanceAfter,
          remarks: "Auto-marked expired by daily check",
          sourceType: "expiry",
          createdBy: null,
        });
      }
      expiredMarked += 1;
    }
  }

  const { listCtnsEntering30DayBucketToday } = await import("../wms/expiryHorizon");
  const entering30 = await listCtnsEntering30DayBucketToday();
  if (entering30.length > 0) {
    const { sendEmail } = await import("../emailService");
    for (const user of users) {
      if (!["manager", "admin"].includes(user.role)) continue;
      const prefs = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, user.id))
        .limit(1);
      const expiryDigest = prefs[0]?.expiryDigest ?? true;
      if (!expiryDigest || !user.email) continue;
      const lines = entering30
        .map(
          (r) =>
            `<li>${r.itemName} (${r.ctnCode}) at ${r.warehouseName} — expires ${r.expiryDate}, qty ${r.balance}</li>`
        )
        .join("");
      await sendEmail({
        to: user.email,
        subject: "Daily expiry digest — items entering 30-day window",
        html: `<p>The following items entered the 30-day expiry window today:</p><ul>${lines}</ul>`,
      });
      await createNotificationDeduped({
        userId: user.id,
        type: "expiry_warning_30",
        title: "Expiry digest",
        message: `${entering30.length} item(s) entered the 30-day expiry window.`,
        relatedEntityType: "inventory",
        relatedEntityId: null,
      });
    }
  }

  return { checked: batches.length, expiredMarked, notificationsSkipped };
}

export async function runWeeklyChecks() {
  const db = await getDb();
  if (!db) return { lowStockItems: 0, criticalStockItems: 0, reorderCandidates: 0 };
  const settingsRows = await db.select().from(stockSettings);
  const balanceRows = await db
    .select({
      catalogueId: stockSettings.catalogueId,
      warehouseId: stockSettings.warehouseId,
      balance: sql<number>`coalesce(sum(${stockMovements.quantityIn}) - sum(${stockMovements.quantityOut}), 0)`.mapWith(Number),
    })
    .from(stockSettings)
    .innerJoin(stockCards, eq(stockCards.locationId, stockSettings.warehouseId))
    .innerJoin(
      commodityTrackingNumbers,
      and(eq(stockCards.ctnId, commodityTrackingNumbers.id), eq(commodityTrackingNumbers.itemId, stockSettings.catalogueId))
    )
    .leftJoin(stockMovements, eq(stockMovements.stockCardId, stockCards.id))
    .groupBy(stockSettings.catalogueId, stockSettings.warehouseId);

  const balanceByKey = new Map(
    balanceRows.map((r) => [`${r.catalogueId}:${r.warehouseId}`, Number(r.balance ?? 0)])
  );

  let lowStockItems = 0;
  let criticalStockItems = 0;
  for (const s of settingsRows) {
    const quantityOnHand = balanceByKey.get(`${s.catalogueId}:${s.warehouseId}`) ?? 0;
    if ((s.safetyStockLevel ?? 0) > 0 && quantityOnHand < Number(s.safetyStockLevel ?? 0)) {
      criticalStockItems += 1;
    } else if (quantityOnHand < Number(s.minLevel ?? 0)) {
      lowStockItems += 1;
    }
  }
  const reorderCandidates = lowStockItems + criticalStockItems;
  const users = await getAllUsers();
  for (const u of users) {
    if (!["manager", "admin"].includes(u.role)) continue;
    await createNotificationDeduped({
      userId: u.id,
      type: "system_alert",
      title: "Weekly Inventory Insights",
      message: `Low stock: ${lowStockItems}, critical: ${criticalStockItems}, reorder candidates: ${reorderCandidates}.`,
      relatedEntityType: "inventory",
      relatedEntityId: null,
    }, { withinHours: 168 });
  }
  return { lowStockItems, criticalStockItems, reorderCandidates };
}

export async function runMonthlyChecks() {
  const db = await getDb();
  if (!db) return { vedRefreshCount: 0, forecastedItems: 0, warehouseScorecards: 0 };
  const vedRows = await db
    .select({ id: inventoryCatalogue.id })
    .from(inventoryCatalogue)
    .where(gte(inventoryCatalogue.updatedAt, new Date(Date.now() - 365 * 86400000)));
  const movementRows = await db
    .select({ catalogueId: commodityTrackingNumbers.itemId })
    .from(stockMovements)
    .innerJoin(stockCards, eq(stockMovements.stockCardId, stockCards.id))
    .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
    .where(gte(stockMovements.createdAt, new Date(Date.now() - 90 * 86400000)));
  const forecastedItems = new Set(movementRows.map((m) => m.catalogueId)).size;
  const warehouses = await db.select().from(sites).where(eq(sites.facilityType, "warehouse"));
  const users = await getAllUsers();
  for (const u of users) {
    if (!["manager", "admin"].includes(u.role)) continue;
    await createNotificationDeduped({
      userId: u.id,
      type: "system_alert",
      title: "Monthly Inventory Scorecard",
      message: `VED refresh rows: ${vedRows.length}, forecasted items: ${forecastedItems}, warehouses: ${warehouses.length}.`,
      relatedEntityType: "inventory",
      relatedEntityId: null,
    }, { withinHours: 720 });
  }
  return { vedRefreshCount: vedRows.length, forecastedItems, warehouseScorecards: warehouses.length };
}
