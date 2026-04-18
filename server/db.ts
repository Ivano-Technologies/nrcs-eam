import {
  eq,
  and,
  desc,
  asc,
  gte,
  lte,
  sql,
  or,
  like,
  isNotNull,
  isNull,
  ilike,
  getTableColumns,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  appSettings,
  InsertUser, users, sites, InsertSite, assetCategories, assets, InsertAsset,
  workOrders, InsertWorkOrder, maintenanceSchedules, InsertMaintenanceSchedule,
  inventoryItems, InsertInventoryItem, inventoryTransactions, vendors, InsertVendor,
  financialTransactions, complianceRecords, auditLogs, documents,
  notifications, notificationPreferences, assetPhotos, InsertAssetPhoto,
  scheduledReports, InsertScheduledReport, assetTransfers, quickbooksConfig, InsertQuickBooksConfig,
  userPreferences, InsertUserPreferences, emailNotifications, InsertEmailNotification,
  workOrderTemplates, InsertWorkOrderTemplate
} from "../drizzle/schema";
import { getPostgresJsSslOption } from "../shared/mysqlSsl";
import { ENV } from './_core/env';
import type { InventoryTransaction } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = process.env.DATABASE_URL;
      const ssl = getPostgresJsSslOption();
      const options: Parameters<typeof postgres>[1] = {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 30,
        prepare: false,
      };
      if (ssl !== undefined && ssl !== false) {
        options.ssl = ssl;
      } else if (ssl === false) {
        options.ssl = false;
      }
      _sql = postgres(url, options);
      _db = drizzle(_sql);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _sql = null;
    }
  }
  return _db;
}

/** Close and clear the singleton pool (e.g. retry migrations after transient TLS/network errors). */
export async function resetDbConnection(): Promise<void> {
  if (_sql) {
    try {
      await _sql.end({ timeout: 10 });
    } catch {
      // ignore
    }
  }
  _sql = null;
  _db = null;
}

const OPEN_REGISTRATION_KEY = "openRegistration";

/** When no row exists, registration is open (default true). */
export async function getOpenRegistration(): Promise<boolean> {
  const database = await getDb();
  if (!database) return true;
  const rows = await database
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, OPEN_REGISTRATION_KEY))
    .limit(1);
  if (rows.length === 0) return true;
  const v = rows[0].value.trim().toLowerCase();
  return v === "true" || v === "1";
}

export async function setOpenRegistration(open: boolean): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const value = open ? "true" : "false";
  const existing = await database
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, OPEN_REGISTRATION_KEY))
    .limit(1);
  if (existing.length > 0) {
    await database
      .update(appSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(appSettings.key, OPEN_REGISTRATION_KEY));
  } else {
    await database.insert(appSettings).values({
      key: OPEN_REGISTRATION_KEY,
      value,
    });
  }
}

// ============= USER MANAGEMENT =============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    if (user.authUserId !== undefined) {
      values.authUserId = user.authUserId;
      updateSet.authUserId = user.authUserId;
    }
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (user.siteId !== undefined) {
      values.siteId = user.siteId;
      updateSet.siteId = user.siteId;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet as Record<string, unknown>,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "admin" | "manager" | "staff" | "user") {
  const db = await getDb();
  if (!db) return null;
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return await db.select().from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);
}

// ============= SITES MANAGEMENT =============

export async function createSite(site: InsertSite) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(sites).values(site).returning({ id: sites.id });
  const insertId = inserted?.id;
  if (!insertId || isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(sites).where(eq(sites.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllSites() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(sites).orderBy(asc(sites.name));
}

export async function getSiteById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.select().from(sites).where(eq(sites.id, id)).limit(1).then(r => r[0] || null);
}

export async function updateSite(id: number, data: Partial<InsertSite>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(sites).set(data).where(eq(sites.id, id));
  return await getSiteById(id);
}

// ============= ASSET CATEGORIES =============

export async function getAllAssetCategories() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assetCategories).orderBy(asc(assetCategories.name));
}

export async function createAssetCategory(name: string, description?: string) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(assetCategories).values({ name, description }).returning({ id: assetCategories.id });
  const insertId = inserted?.id;
  if (!insertId || isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(assetCategories).where(eq(assetCategories.id, insertId)).limit(1).then(r => r[0]);
}

// ============= ASSETS MANAGEMENT =============

export async function createAsset(asset: InsertAsset) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(assets).values(asset).returning({ id: assets.id });
  const insertId = inserted?.id;
  if (!insertId || isNaN(insertId)) {
    throw new Error("Failed to get insert ID");
  }
  return await db.select().from(assets).where(eq(assets.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllAssets(filters?: { siteId?: number; status?: string; categoryId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(assets);
  const conditions = [];
  
  if (filters?.siteId) conditions.push(eq(assets.siteId, filters.siteId));
  if (filters?.status) conditions.push(eq(assets.status, filters.status as any));
  if (filters?.categoryId) conditions.push(eq(assets.categoryId, filters.categoryId));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(assets.createdAt));
}

export async function getAssetById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.select().from(assets).where(eq(assets.id, id)).limit(1).then(r => r[0] || null);
}

export async function updateAsset(id: number, data: Partial<InsertAsset>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(assets).set(data).where(eq(assets.id, id));
  return await getAssetById(id);
}

export async function deleteAsset(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(assets).where(eq(assets.id, id));
  return true;
}

export async function searchAssets(searchTerm: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assets)
    .where(or(
      like(assets.name, `%${searchTerm}%`),
      like(assets.assetTag, `%${searchTerm}%`),
      like(assets.serialNumber, `%${searchTerm}%`)
    ))
    .orderBy(desc(assets.createdAt));
}

const ASSET_REGISTER_MAX_LIMIT = 50_000;

export type AssetRegisterListParams = {
  siteId?: number;
  categoryId?: number;
  registerStatus?: string;
  itemType?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

function assetRegisterWhere(params: AssetRegisterListParams) {
  const conditions = [];
  if (params.siteId) conditions.push(eq(assets.siteId, params.siteId));
  if (params.categoryId) conditions.push(eq(assets.categoryId, params.categoryId));
  if (params.registerStatus && params.registerStatus !== "all") {
    conditions.push(eq(assets.registerStatus, params.registerStatus));
  }
  if (params.itemType && params.itemType !== "all") {
    conditions.push(eq(assets.itemType, params.itemType));
  }
  const q = params.search?.trim();
  if (q) {
    const term = `%${q}%`;
    conditions.push(
      or(
        ilike(assets.name, term),
        ilike(assets.description, term),
        ilike(assets.assetTag, term),
        ilike(assets.serialNumber, term)
      )!
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function assetRegisterOrderBy(sortBy: string | undefined, sortDir: "asc" | "desc" | undefined) {
  const dir = sortDir === "asc" ? asc : desc;
  switch (sortBy) {
    case "itemType":
      return [dir(assets.itemType)];
    case "categoryName":
      return [dir(assetCategories.name)];
    case "subCategory":
      return [dir(assets.subCategory)];
    case "name":
      return [dir(assets.name)];
    case "assetTag":
      return [dir(assets.assetTag)];
    case "serialNumber":
      return [dir(assets.serialNumber)];
    case "acquisitionCost":
      return [dir(assets.acquisitionCost)];
    case "currentDepreciatedValue":
      return [dir(sql`coalesce(${assets.currentDepreciatedValue}, ${assets.currentValue})`)];
    case "acquisitionMethod":
      return [dir(assets.acquisitionMethod)];
    case "projectRef":
      return [dir(assets.projectRef)];
    case "yearAcquired":
      return [dir(sql`extract(year from ${assets.acquisitionDate})`)];
    case "acquisitionCondition":
      return [dir(assets.acquisitionCondition)];
    case "registerStatus":
      return [dir(assets.registerStatus)];
    case "assignedToName":
      return [dir(assets.assignedToName)];
    case "department":
      return [dir(assets.department)];
    case "siteName":
      return [dir(sites.name)];
    case "physicalCondition":
      return [dir(assets.physicalCondition)];
    case "lastCheckedAt":
      return [dir(assets.lastCheckedAt)];
    case "notes":
      return [dir(assets.notes)];
    default:
      return [dir(assets.createdAt)];
  }
}

export async function getAssetRegisterList(params: AssetRegisterListParams) {
  const database = await getDb();
  if (!database) return { rows: [], total: 0 };

  const whereClause = assetRegisterWhere(params);
  const countRows = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(assets)
    .where(whereClause);
  const total = Number(countRows[0]?.count ?? 0);

  const limit = Math.min(
    params.limit ?? 50,
    ASSET_REGISTER_MAX_LIMIT
  );
  const offset = params.offset ?? 0;

  const orderBy = assetRegisterOrderBy(params.sortBy, params.sortDir ?? "desc");

  const rows = await database
    .select({
      ...getTableColumns(assets),
      siteName: sites.name,
      categoryName: assetCategories.name,
      assignedUserName: users.name,
    })
    .from(assets)
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(users, eq(assets.assignedTo, users.id))
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  return { rows, total };
}

/** Filtered list for Excel export (no pagination). */
export async function getAssetRegisterExportRows(params: Omit<AssetRegisterListParams, "limit" | "offset">) {
  return getAssetRegisterList({
    ...params,
    limit: ASSET_REGISTER_MAX_LIMIT,
    offset: 0,
    sortBy: params.sortBy ?? "assetTag",
    sortDir: params.sortDir ?? "asc",
  });
}

// ============= WORK ORDERS =============

export async function createWorkOrder(workOrder: InsertWorkOrder) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(workOrders).values(workOrder).returning({ id: workOrders.id });
  const insertId = inserted?.id;
  if (!insertId || isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(workOrders).where(eq(workOrders.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllWorkOrders(filters?: { siteId?: number; status?: string; assignedTo?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(workOrders);
  const conditions = [];
  
  if (filters?.siteId) conditions.push(eq(workOrders.siteId, filters.siteId));
  if (filters?.status) conditions.push(eq(workOrders.status, filters.status as any));
  if (filters?.assignedTo) conditions.push(eq(workOrders.assignedTo, filters.assignedTo));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(workOrders.createdAt));
}

export async function getWorkOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1).then(r => r[0] || null);
}

export async function updateWorkOrder(id: number, data: Partial<InsertWorkOrder>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(workOrders).set(data).where(eq(workOrders.id, id));
  return await getWorkOrderById(id);
}

// ============= MAINTENANCE SCHEDULES =============

export async function createMaintenanceSchedule(schedule: InsertMaintenanceSchedule) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(maintenanceSchedules).values(schedule).returning({ id: maintenanceSchedules.id });
  const insertId = inserted?.id;
  if (!insertId || isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllMaintenanceSchedules(filters?: { assetId?: number; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(maintenanceSchedules);
  const conditions = [];
  
  if (filters?.assetId) conditions.push(eq(maintenanceSchedules.assetId, filters.assetId));
  if (filters?.isActive !== undefined) conditions.push(eq(maintenanceSchedules.isActive, filters.isActive));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(asc(maintenanceSchedules.nextDue));
}

export async function getUpcomingMaintenance(days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return await db.select().from(maintenanceSchedules)
    .where(and(
      eq(maintenanceSchedules.isActive, true),
      lte(maintenanceSchedules.nextDue, futureDate)
    ))
    .orderBy(asc(maintenanceSchedules.nextDue));
}

export async function updateMaintenanceSchedule(id: number, data: Partial<InsertMaintenanceSchedule>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(maintenanceSchedules).set(data).where(eq(maintenanceSchedules.id, id));
  return await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.id, id)).limit(1).then(r => r[0] || null);
}

// ============= INVENTORY =============

export async function createInventoryItem(item: InsertInventoryItem) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(inventoryItems).values(item).returning({ id: inventoryItems.id });
  const insertId = inserted?.id;
  if (!insertId || isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(inventoryItems).where(eq(inventoryItems.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllInventoryItems(siteId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (siteId) {
    return await db.select().from(inventoryItems).where(eq(inventoryItems.siteId, siteId)).orderBy(asc(inventoryItems.name));
  }
  
  return await db.select().from(inventoryItems).orderBy(asc(inventoryItems.name));
}

/** Items where on-hand quantity is below the configured minimum (includes zero stock). */
export async function getLowStockItems(siteId?: number) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [sql`${inventoryItems.currentStock} < ${inventoryItems.minStockLevel}`];
  if (siteId) conditions.push(eq(inventoryItems.siteId, siteId));

  return await db.select().from(inventoryItems)
    .where(and(...conditions))
    .orderBy(asc(inventoryItems.currentStock));
}

export async function getInventoryItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1).then((r) => r[0] ?? null);
}

export async function updateInventoryItem(id: number, data: Partial<InsertInventoryItem>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(inventoryItems).set(data).where(eq(inventoryItems.id, id));
  return await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1).then(r => r[0] || null);
}

export async function deleteInventoryItem(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(inventoryTransactions).where(eq(inventoryTransactions.itemId, id));
  await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  return true;
}

export async function deleteSite(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(sites).where(eq(sites.id, id));
  return true;
}

export async function createInventoryTransaction(transaction: typeof inventoryTransactions.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(inventoryTransactions).values(transaction).returning({ id: inventoryTransactions.id });
  const insertId = inserted?.id;
  if (!insertId) return null;
  return await db.select().from(inventoryTransactions).where(eq(inventoryTransactions.id, insertId)).limit(1).then(r => r[0]);
}

export async function deleteInventoryTransaction(id: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.delete(inventoryTransactions).where(eq(inventoryTransactions.id, id)).returning({ id: inventoryTransactions.id });
  return result.length > 0;
}

export async function getInventoryTransactions(itemId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inventoryTransactions)
    .where(eq(inventoryTransactions.itemId, itemId))
    .orderBy(desc(inventoryTransactions.transactionDate));
}

export type InventoryMovementRow = {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  siteId: number;
  type: string;
  quantity: number;
  transactionDate: Date;
  notes: string | null;
  performedById: number;
  performedByName: string | null;
  performedByEmail: string | null;
  balanceAfter: number;
};

/**
 * All inventory transactions with item + performer info and running balance per item (chronological replay from 0).
 */
export async function getInventoryMovements(filters: {
  siteId?: number;
  itemId?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<InventoryMovementRow[]> {
  const db = await getDb();
  if (!db) return [];

  const items = await getAllInventoryItems(filters.siteId);
  const itemById = Object.fromEntries(items.map((i) => [i.id, i]));
  const users = await getAllUsers();
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  const conds = [];
  if (filters.itemId) conds.push(eq(inventoryTransactions.itemId, filters.itemId));
  if (filters.startDate) conds.push(gte(inventoryTransactions.transactionDate, filters.startDate));
  if (filters.endDate) conds.push(lte(inventoryTransactions.transactionDate, filters.endDate));

  const allTx = conds.length
    ? await db
        .select()
        .from(inventoryTransactions)
        .where(and(...conds))
        .orderBy(asc(inventoryTransactions.transactionDate), asc(inventoryTransactions.id))
    : await db
        .select()
        .from(inventoryTransactions)
        .orderBy(asc(inventoryTransactions.transactionDate), asc(inventoryTransactions.id));

  const relevant = allTx.filter((t) => itemById[t.itemId]);
  const byItem = new Map<number, InventoryTransaction[]>();
  for (const t of relevant) {
    const list = byItem.get(t.itemId) ?? [];
    list.push(t);
    byItem.set(t.itemId, list);
  }

  const balanceByTxId = new Map<number, number>();
  for (const [, list] of Array.from(byItem.entries())) {
    let bal = 0;
    for (const t of list) {
      if (t.type === "in") bal += t.quantity;
      else if (t.type === "out") bal -= t.quantity;
      else if (t.type === "adjustment") bal = t.quantity;
      else if (t.type === "transfer") {
        /* stock not updated in addTransaction for transfer */
      }
      balanceByTxId.set(t.id, bal);
    }
  }

  const rows: InventoryMovementRow[] = relevant
    .slice()
    .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime() || b.id - a.id)
    .map((t) => {
      const item = itemById[t.itemId];
      const u = userById[t.performedBy];
      return {
        id: t.id,
        itemId: t.itemId,
        itemCode: item?.itemCode ?? "",
        itemName: item?.name ?? "",
        siteId: item?.siteId ?? 0,
        type: t.type,
        quantity: t.quantity,
        transactionDate: t.transactionDate,
        notes: t.notes ?? null,
        performedById: t.performedBy,
        performedByName: u?.name ?? null,
        performedByEmail: u?.email ?? null,
        balanceAfter: balanceByTxId.get(t.id) ?? 0,
      };
    });

  return rows;
}

// ============= VENDORS =============

export async function createVendor(vendor: InsertVendor) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(vendors).values(vendor).returning({ id: vendors.id });
  const insertId = inserted?.id;
  if (!insertId || isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(vendors).where(eq(vendors.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllVendors() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(vendors).orderBy(asc(vendors.name));
}

export async function updateVendor(id: number, data: Partial<InsertVendor>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(vendors).set(data).where(eq(vendors.id, id));
  return await db.select().from(vendors).where(eq(vendors.id, id)).limit(1).then(r => r[0] || null);
}

// ============= FINANCIAL TRANSACTIONS =============

export async function createFinancialTransaction(transaction: typeof financialTransactions.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(financialTransactions).values(transaction).returning({ id: financialTransactions.id });
  const insertId = inserted?.id;
  if (!insertId) return null;
  return await db.select().from(financialTransactions).where(eq(financialTransactions.id, insertId)).limit(1).then(r => r[0]);
}

export async function getFinancialTransactions(filters?: { assetId?: number; workOrderId?: number; startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(financialTransactions);
  const conditions = [];
  
  if (filters?.assetId) conditions.push(eq(financialTransactions.assetId, filters.assetId));
  if (filters?.workOrderId) conditions.push(eq(financialTransactions.workOrderId, filters.workOrderId));
  if (filters?.startDate) conditions.push(gte(financialTransactions.transactionDate, filters.startDate));
  if (filters?.endDate) conditions.push(lte(financialTransactions.transactionDate, filters.endDate));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(financialTransactions.transactionDate));
}

// ============= COMPLIANCE =============

export async function createComplianceRecord(record: typeof complianceRecords.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(complianceRecords).values(record).returning({ id: complianceRecords.id });
  const insertId = inserted?.id;
  if (!insertId) return null;
  return await db.select().from(complianceRecords).where(eq(complianceRecords.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllComplianceRecords(filters?: { assetId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(complianceRecords);
  const conditions = [];
  
  if (filters?.assetId) conditions.push(eq(complianceRecords.assetId, filters.assetId));
  if (filters?.status) conditions.push(eq(complianceRecords.status, filters.status as any));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(complianceRecords.createdAt));
}

export async function updateComplianceRecord(id: number, data: Partial<typeof complianceRecords.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(complianceRecords).set(data).where(eq(complianceRecords.id, id));
  return await db.select().from(complianceRecords).where(eq(complianceRecords.id, id)).limit(1).then(r => r[0] || null);
}

// ============= AUDIT LOGS =============

export async function createAuditLog(log: typeof auditLogs.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(auditLogs).values(log);
}

export async function getAuditLogs(filters?: { userId?: number; entityType?: string; entityId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(auditLogs);
  const conditions = [];
  
  if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
  if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const result = query.orderBy(desc(auditLogs.timestamp));
  
  if (filters?.limit) {
    return await result.limit(filters.limit);
  }
  
  return await result;
}

// ============= DOCUMENTS =============

export async function createDocument(doc: typeof documents.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(documents).values(doc).returning({ id: documents.id });
  const insertId = inserted?.id;
  if (!insertId) return null;
  return await db.select().from(documents).where(eq(documents.id, insertId)).limit(1).then(r => r[0]);
}

export async function getDocuments(entityType?: string, entityId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (entityType && entityId) {
    return await db.select().from(documents)
      .where(and(eq(documents.entityType, entityType), eq(documents.entityId, entityId)))
      .orderBy(desc(documents.createdAt));
  }
  
  return await db.select().from(documents).orderBy(desc(documents.createdAt));
}

// ============= DASHBOARD STATISTICS =============

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;
  
  const [totalAssets] = await db.select({ count: sql<number>`count(*)` }).from(assets);
  const [operationalAssets] = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.status, 'operational'));
  const [maintenanceAssets] = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.status, 'maintenance'));
  const [pendingWorkOrders] = await db.select({ count: sql<number>`count(*)` }).from(workOrders).where(eq(workOrders.status, 'pending'));
  const [inProgressWorkOrders] = await db.select({ count: sql<number>`count(*)` }).from(workOrders).where(eq(workOrders.status, 'in_progress'));
  const [lowStockCount] = await db.select({ count: sql<number>`count(*)` }).from(inventoryItems)
    .where(sql`${inventoryItems.currentStock} < ${inventoryItems.minStockLevel}`);
  
  return {
    totalAssets: Number(totalAssets?.count ?? 0),
    operationalAssets: Number(operationalAssets?.count ?? 0),
    maintenanceAssets: Number(maintenanceAssets?.count ?? 0),
    pendingWorkOrders: Number(pendingWorkOrders?.count ?? 0),
    inProgressWorkOrders: Number(inProgressWorkOrders?.count ?? 0),
    lowStockItems: Number(lowStockCount?.count ?? 0),
  };
}

// ============= NOTIFICATIONS =============

export async function createNotification(notification: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(notifications).values(notification).returning({ id: notifications.id });
  return inserted?.id ?? 0;
}

export async function getUserNotifications(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
  return Number(result[0]?.count ?? 0);
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.id, id));
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
}

export async function deleteNotification(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.delete(notifications).where(eq(notifications.id, id));
}

// ============= NOTIFICATION PREFERENCES =============

export async function getUserNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  return result[0] || null;
}

export async function upsertNotificationPreferences(userId: number, prefs: Partial<typeof notificationPreferences.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await getUserNotificationPreferences(userId);
  
  if (existing) {
    return await db.update(notificationPreferences)
      .set(prefs)
      .where(eq(notificationPreferences.userId, userId));
  } else {
    return await db.insert(notificationPreferences).values({
      userId,
      ...prefs,
    });
  }
}


// ===== Asset Photos =====
export async function createAssetPhoto(data: InsertAssetPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [inserted] = await db.insert(assetPhotos).values(data).returning({ id: assetPhotos.id });
  return inserted?.id ?? 0;
}

export async function getAssetPhotos(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(assetPhotos).where(eq(assetPhotos.assetId, assetId));
}

export async function getWorkOrderPhotos(workOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(assetPhotos).where(eq(assetPhotos.workOrderId, workOrderId));
}

export async function deleteAssetPhoto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(assetPhotos).where(eq(assetPhotos.id, id));
}

// ===== Scheduled Reports =====
export async function createScheduledReport(data: InsertScheduledReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [inserted] = await db.insert(scheduledReports).values(data).returning({ id: scheduledReports.id });
  return inserted?.id ?? 0;
}

export async function getScheduledReports() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(scheduledReports);
}

export async function getScheduledReportById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(scheduledReports).where(eq(scheduledReports.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateScheduledReport(id: number, data: Partial<InsertScheduledReport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(scheduledReports).set(data).where(eq(scheduledReports.id, id));
}

export async function deleteScheduledReport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(scheduledReports).where(eq(scheduledReports.id, id));
}

export async function getActiveScheduledReports() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(scheduledReports).where(eq(scheduledReports.isActive, true));
}


// ===== Additional User Management Functions =====
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set(data).where(eq(users.id, id));
  return { success: true };
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(users).where(eq(users.id, id));
  return { success: true };
}


export async function getAssetByBarcode(barcode: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(assets).where(eq(assets.barcode, barcode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}


export async function getAssetWorkOrders(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(workOrders).where(eq(workOrders.assetId, assetId));
}


// ============= ASSET TRANSFERS =============

export async function createAssetTransfer(transfer: typeof assetTransfers.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(assetTransfers).values(transfer).returning({ id: assetTransfers.id });
  const insertId = inserted?.id;
  if (!insertId || isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(assetTransfers).where(eq(assetTransfers.id, insertId)).limit(1).then(r => r[0]);
}

export async function getAllAssetTransfers(filters?: { status?: string; assetId?: number; siteId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.status) conditions.push(eq(assetTransfers.status, filters.status as any));
  if (filters?.assetId) conditions.push(eq(assetTransfers.assetId, filters.assetId));
  if (filters?.siteId) conditions.push(
    or(eq(assetTransfers.fromSiteId, filters.siteId), eq(assetTransfers.toSiteId, filters.siteId))
  );
  
  if (conditions.length > 0) {
    return await db.select().from(assetTransfers)
      .where(and(...conditions))
      .orderBy(desc(assetTransfers.requestDate));
  }
  
  return await db.select().from(assetTransfers).orderBy(desc(assetTransfers.requestDate));
}

export async function getAssetTransferById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(assetTransfers).where(eq(assetTransfers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAssetTransfer(id: number, data: Partial<typeof assetTransfers.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(assetTransfers).set(data).where(eq(assetTransfers.id, id));
  return await db.select().from(assetTransfers).where(eq(assetTransfers.id, id)).limit(1).then(r => r[0] || null);
}

export async function getPendingTransferRequests() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(assetTransfers)
    .where(eq(assetTransfers.status, 'pending'))
    .orderBy(asc(assetTransfers.requestDate));
}


export async function getAssetByTag(assetTag: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(assets).where(eq(assets.assetTag, assetTag)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}


export async function getFinancialTransactionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(financialTransactions).where(eq(financialTransactions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateFinancialTransaction(id: number, data: Partial<typeof financialTransactions.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(financialTransactions).set(data).where(eq(financialTransactions.id, id));
  return await getFinancialTransactionById(id);
}


// ============= QuickBooks Configuration =============
export async function getQuickBooksConfig() {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(quickbooksConfig).where(eq(quickbooksConfig.isActive, 1)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function saveQuickBooksConfig(config: InsertQuickBooksConfig) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Deactivate all existing configs
  await db.update(quickbooksConfig).set({ isActive: 0 });
  
  // Insert new config
  const [inserted] = await db.insert(quickbooksConfig).values(config).returning({ id: quickbooksConfig.id });
  const insertId = inserted?.id;
  if (!insertId) return undefined;
  return await db.select().from(quickbooksConfig).where(eq(quickbooksConfig.id, insertId)).limit(1).then(r => r[0]);
}

export async function updateQuickBooksTokens(id: number, accessToken: string, refreshToken: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(quickbooksConfig)
    .set({ 
      accessToken, 
      refreshToken, 
      tokenExpiresAt: expiresAt 
    })
    .where(eq(quickbooksConfig.id, id));
  
  return true;
}

export async function updateQuickBooksLastSync(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(quickbooksConfig)
    .set({ lastSyncAt: new Date() })
    .where(eq(quickbooksConfig.id, id));
  
  return true;
}


// ============= User Preferences =============
export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (result.length > 0) {
    return result[0];
  }
  // Return default preferences with wide sidebar width (360px)
  return {
    userId,
    sidebarWidth: 360,
    sidebarCollapsed: 0,
    dashboardWidgets: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

export async function upsertUserPreferences(prefs: InsertUserPreferences) {
  const db = await getDb();
  if (!db) return null;

  const existingRow = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, prefs.userId))
    .limit(1);

  if (existingRow.length > 0) {
    await db
      .update(userPreferences)
      .set({ ...prefs, updatedAt: new Date() })
      .where(eq(userPreferences.userId, prefs.userId));
  } else {
    await db.insert(userPreferences).values({
      userId: prefs.userId,
      sidebarWidth: prefs.sidebarWidth ?? 280,
      sidebarCollapsed: prefs.sidebarCollapsed ?? 0,
      dashboardWidgets: prefs.dashboardWidgets ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return await getUserPreferences(prefs.userId);
}


// ============= Email Notifications =============
export async function createEmailNotification(notification: InsertEmailNotification) {
  const db = await getDb();
  if (!db) return null;
  
  const [inserted] = await db.insert(emailNotifications).values(notification).returning({ id: emailNotifications.id });
  const insertId = inserted?.id;
  if (!insertId || Number.isNaN(insertId)) {
    throw new Error("Failed to get insert ID for email notification");
  }
  return await db.select().from(emailNotifications).where(eq(emailNotifications.id, insertId)).limit(1).then(r => r[0]);
}

export async function getEmailNotificationHistory(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(emailNotifications).orderBy(desc(emailNotifications.sentAt)).limit(limit);
}

export async function getEmailNotificationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(emailNotifications).where(eq(emailNotifications.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserByEmail(email: string) {
  const database = await getDb();
  if (!database) return null;
  
  const result = await database
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/** Case-insensitive email lookup (Supabase session linking). */
export async function getUserByEmailLowercase(email: string) {
  const normalized = email.trim().toLowerCase();
  const maxAttempts = Number(process.env.AUTH_LOGIN_DB_MAX_ATTEMPTS ?? "4");
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const database = await getDb();
      if (!database) return undefined;
      try {
        const result = await database
          .select()
          .from(users)
          .where(sql`LOWER(${users.email}) = ${normalized}`)
          .limit(1);
        return result.length > 0 ? result[0] : undefined;
      } catch (primaryError) {
        const fallbackText =
          primaryError instanceof Error ? primaryError.message : String(primaryError);
        if (!/openId|column .*openId/i.test(fallbackText)) {
          throw primaryError;
        }
        const fallback = await database
          .select()
          .from(users)
          .where(sql`LOWER(${users.email}) = ${normalized}`)
          .limit(1);
        return fallback.length > 0 ? fallback[0] : undefined;
      }
    } catch (e) {
      lastError = e;
      const text = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
      const transient = /ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|TLS|SSL|timeout|socket/i.test(
        text
      );
      if (!transient || attempt === maxAttempts) {
        throw e;
      }
      await resetDbConnection();
      const delayMs = 500 * attempt;
      console.warn(
        `[auth/login] transient DB lookup failure (${attempt}/${maxAttempts}), retrying in ${delayMs}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "getUserByEmailLowercase failed"));
}

/** Minimal user shape for auth login to avoid depending on optional legacy columns. */
export async function getLoginUserByEmailLowercase(email: string): Promise<{
  id: number;
  email: string | null;
  authUserId: string | null;
} | undefined> {
  const normalized = email.trim().toLowerCase();
  const database = await getDb();
  if (!database) return undefined;
  try {
    const result = await database
      .select({
        id: users.id,
        email: users.email,
        authUserId: users.authUserId,
      })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${normalized}`)
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    const e = error as { message?: string; code?: string };
    console.error("[auth.login] getLoginUserByEmailLowercase query failed", {
      message: e?.message,
      code: e?.code,
    });
    throw error;
  }
}

export async function touchUserLastSignedInById(userId: number) {
  const database = await getDb();
  if (!database) return null;
  return await database
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

export async function getUserByAuthUserId(authUserId: string) {
  const database = await getDb();
  if (!database) return undefined;
  const result = await database
    .select()
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}



// ============= WORK ORDER TEMPLATES =============

export async function createWorkOrderTemplate(data: InsertWorkOrderTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [inserted] = await db.insert(workOrderTemplates).values(data).returning({ id: workOrderTemplates.id });
  const insertId = inserted?.id;
  if (!insertId || Number.isNaN(insertId)) {
    throw new Error("Failed to get insert ID for work order template");
  }
  return insertId;
}

export async function getWorkOrderTemplates(filters?: {
  isActive?: boolean;
  type?: string;
  categoryId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.isActive !== undefined) {
    conditions.push(eq(workOrderTemplates.isActive, filters.isActive));
  }
  if (filters?.type) {
    conditions.push(eq(workOrderTemplates.type, filters.type as any));
  }
  if (filters?.categoryId) {
    conditions.push(eq(workOrderTemplates.categoryId, filters.categoryId));
  }
  
  if (conditions.length > 0) {
    return await db.select().from(workOrderTemplates).where(and(...conditions));
  }
  
  return await db.select().from(workOrderTemplates);
}

export async function getWorkOrderTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(workOrderTemplates).where(eq(workOrderTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateWorkOrderTemplate(id: number, data: Partial<InsertWorkOrderTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(workOrderTemplates).set(data).where(eq(workOrderTemplates.id, id));
}

export async function deleteWorkOrderTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(workOrderTemplates).set({ isActive: false }).where(eq(workOrderTemplates.id, id));
}


// ============= WARRANTY ALERTS =============

export async function getExpiringWarranties() {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  
  return await db
    .select()
    .from(assets)
    .where(
      and(
        isNotNull(assets.warrantyExpiry),
        lte(assets.warrantyExpiry, ninetyDaysFromNow),
        gte(assets.warrantyExpiry, now)
      )
    )
    .orderBy(asc(assets.warrantyExpiry));
}

// ============= AUDIT TRAIL =============

export async function logAuditEntry(entry: {
  userId: number;
  action: string;
  entityType?: string;
  entityId?: number;
  changes?: string;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType || null,
    entityId: entry.entityId || null,
    changes: entry.changes || null,
    ipAddress: null,
    userAgent: null,
  });
}

export async function getAssetAuditHistory(assetId: number) {
  return await getAuditLogs({ entityType: 'asset', entityId: assetId });
}


// ============= COST ANALYTICS =============

export async function getCostAnalytics(days: number) {
  const db = await getDb();
  if (!db) return null;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get all transactions in date range
  const transactions = await db
    .select()
    .from(financialTransactions)
    .where(gte(financialTransactions.transactionDate, startDate));
  
  // Calculate totals
  const totalCost = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const maintenanceCost = transactions
    .filter(t => t.transactionType === 'maintenance')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const repairCost = transactions
    .filter(t => t.transactionType === 'repair')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  // Group by category
  const assetIds = Array.from(new Set(transactions.map(t => t.assetId).filter(Boolean)));
  const assetsList = await Promise.all(
    assetIds.map(id => getAssetById(id!))
  );
  
  const byCategory: Record<number, { categoryId: number; categoryName: string; total: number }> = {};
  for (const transaction of transactions) {
    if (transaction.assetId) {
      const asset = assetsList.find(a => a?.id === transaction.assetId);
      if (asset && asset.categoryId) {
        if (!byCategory[asset.categoryId]) {
          const category = await getAssetCategoryById(asset.categoryId);
          byCategory[asset.categoryId] = {
            categoryId: asset.categoryId,
            categoryName: category?.name || 'Unknown',
            total: 0,
          };
        }
        byCategory[asset.categoryId].total += parseFloat(transaction.amount);
      }
    }
  }
  
  // Group by site
  const bySite: Record<number, { siteId: number; siteName: string; total: number }> = {};
  for (const transaction of transactions) {
    if (transaction.assetId) {
      const asset = assetsList.find(a => a?.id === transaction.assetId);
      if (asset && asset.siteId) {
        if (!bySite[asset.siteId]) {
          const site = await getSiteById(asset.siteId);
          bySite[asset.siteId] = {
            siteId: asset.siteId,
            siteName: site?.name || 'Unknown',
            total: 0,
          };
        }
        bySite[asset.siteId].total += parseFloat(transaction.amount);
      }
    }
  }
  
  // Group by vendor
  const byVendor: Record<number, { vendorId: number; vendorName: string; total: number; transactionCount: number }> = {};
  for (const transaction of transactions) {
    if (transaction.vendorId) {
      if (!byVendor[transaction.vendorId]) {
        const vendor = await getVendorById(transaction.vendorId);
        byVendor[transaction.vendorId] = {
          vendorId: transaction.vendorId,
          vendorName: vendor?.name || 'Unknown',
          total: 0,
          transactionCount: 0,
        };
      }
      byVendor[transaction.vendorId].total += parseFloat(transaction.amount);
      byVendor[transaction.vendorId].transactionCount += 1;
    }
  }
  
  return {
    totalCost,
    maintenanceCost,
    repairCost,
    byCategory: Object.values(byCategory),
    bySite: Object.values(bySite),
    byVendor: Object.values(byVendor).sort((a, b) => b.total - a.total).slice(0, 10),
  };
}

export async function getAssetCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(assetCategories).where(eq(assetCategories.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getVendorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
