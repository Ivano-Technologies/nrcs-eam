import { and, eq, lte, gte } from "drizzle-orm";
import { createNotification, getAllUsers, getDb } from "../db";
import { inventoryBatches, inventoryCatalogue, inventoryMovements, inventoryStock, sites } from "../../drizzle/schema";

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export async function checkStockThreshold(stockId: number) {
  const db = await getDb();
  if (!db) return;
  const [stock] = await db.select().from(inventoryStock).where(eq(inventoryStock.id, stockId)).limit(1);
  if (!stock) return;
  const [warehouse] = await db.select().from(sites).where(eq(sites.id, stock.warehouseId)).limit(1);
  const users = await getAllUsers();
  for (const user of users) {
    if (!["manager", "admin"].includes(user.role)) continue;
    if ((stock.safetyStockLevel ?? 0) > 0 && stock.quantityOnHand < (stock.safetyStockLevel ?? 0)) {
      await createNotification({
        userId: user.id,
        type: "critical_stock",
        title: "Critical Stock Alert",
        message: `${warehouse?.name ?? "Warehouse"} stock is below safety level.`,
        relatedEntityType: "inventory",
        relatedEntityId: stock.id,
      });
    } else if (stock.quantityOnHand < (stock.minLevel ?? 0)) {
      await createNotification({
        userId: user.id,
        type: "low_stock",
        title: "Low Stock Alert",
        message: `${warehouse?.name ?? "Warehouse"} stock is below minimum level.`,
        relatedEntityType: "inventory",
        relatedEntityId: stock.id,
      });
    }
  }
}

export async function runDailyChecks() {
  const db = await getDb();
  if (!db) return { checked: 0, expiredMarked: 0 };
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const in90Iso = in90.toISOString().slice(0, 10);
  const batches = await db
    .select({
      batchId: inventoryBatches.id,
      expiryDate: inventoryBatches.expiryDate,
      quantity: inventoryBatches.quantity,
      status: inventoryBatches.status,
      stockId: inventoryBatches.stockId,
      warehouseId: inventoryStock.warehouseId,
      catalogueId: inventoryStock.catalogueId,
      itemName: inventoryCatalogue.name,
    })
    .from(inventoryBatches)
    .innerJoin(inventoryStock, eq(inventoryBatches.stockId, inventoryStock.id))
    .innerJoin(inventoryCatalogue, eq(inventoryStock.catalogueId, inventoryCatalogue.id))
    .where(and(eq(inventoryBatches.status, "active"), lte(inventoryBatches.expiryDate, in90Iso)));

  let expiredMarked = 0;
  const users = await getAllUsers();
  for (const b of batches) {
    if (!b.expiryDate) continue;
    const days = daysBetween(now, new Date(b.expiryDate));
    const type = days <= 30 ? "expiry_warning_30" : days <= 60 ? "expiry_warning_60" : "expiry_warning_90";
    for (const user of users) {
      if (!["manager", "admin"].includes(user.role)) continue;
      await createNotification({
        userId: user.id,
        type,
        title: "Expiry warning",
        message: `${b.itemName} batch expires in ${Math.max(days, 0)} day(s).`,
        relatedEntityType: "inventory",
        relatedEntityId: b.stockId,
      });
    }
    if (days < 0 && b.status !== "expired") {
      const [stock] = await db.select().from(inventoryStock).where(eq(inventoryStock.id, b.stockId)).limit(1);
      if (!stock) continue;
      const next = Math.max(0, Number(stock.quantityOnHand) - Number(b.quantity));
      await db.update(inventoryBatches).set({ status: "expired" }).where(eq(inventoryBatches.id, b.batchId));
      await db
        .update(inventoryStock)
        .set({ quantityOnHand: next, updatedAt: new Date(), lastMovementAt: new Date() })
        .where(eq(inventoryStock.id, b.stockId));
      await db.insert(inventoryMovements).values({
        movementType: "loss",
        catalogueId: b.catalogueId,
        stockId: b.stockId,
        fromWarehouseId: b.warehouseId,
        quantityChange: -Math.abs(Number(b.quantity)),
        balanceAfter: next,
        reason: "expired",
        notes: "Auto-marked expired by daily check",
      });
      expiredMarked += 1;
    }
  }
  return { checked: batches.length, expiredMarked };
}

export async function runWeeklyChecks() {
  const db = await getDb();
  if (!db) return { lowStockItems: 0, criticalStockItems: 0, reorderCandidates: 0 };
  const stocks = await db.select().from(inventoryStock);
  let lowStockItems = 0;
  let criticalStockItems = 0;
  for (const s of stocks) {
    if ((s.safetyStockLevel ?? 0) > 0 && Number(s.quantityOnHand) < Number(s.safetyStockLevel ?? 0)) {
      criticalStockItems += 1;
    } else if (Number(s.quantityOnHand) < Number(s.minLevel ?? 0)) {
      lowStockItems += 1;
    }
  }
  const reorderCandidates = lowStockItems + criticalStockItems;
  const users = await getAllUsers();
  for (const u of users) {
    if (!["manager", "admin"].includes(u.role)) continue;
    await createNotification({
      userId: u.id,
      type: "system_alert",
      title: "Weekly Inventory Insights",
      message: `Low stock: ${lowStockItems}, critical: ${criticalStockItems}, reorder candidates: ${reorderCandidates}.`,
      relatedEntityType: "inventory",
      relatedEntityId: null,
    });
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
    .select({ catalogueId: inventoryMovements.catalogueId })
    .from(inventoryMovements)
    .where(gte(inventoryMovements.createdAt, new Date(Date.now() - 90 * 86400000)));
  const forecastedItems = new Set(movementRows.map((m) => m.catalogueId)).size;
  const warehouses = await db.select().from(sites).where(eq(sites.facilityType, "warehouse"));
  const users = await getAllUsers();
  for (const u of users) {
    if (!["manager", "admin"].includes(u.role)) continue;
    await createNotification({
      userId: u.id,
      type: "system_alert",
      title: "Monthly Inventory Scorecard",
      message: `VED refresh rows: ${vedRows.length}, forecasted items: ${forecastedItems}, warehouses: ${warehouses.length}.`,
      relatedEntityType: "inventory",
      relatedEntityId: null,
    });
  }
  return { vedRefreshCount: vedRows.length, forecastedItems, warehouseScorecards: warehouses.length };
}
