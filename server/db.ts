import { eq, and, desc, asc, gte, lte, sql, or, like, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, sites, InsertSite, assetCategories, assets, InsertAsset,
  workOrders, InsertWorkOrder, maintenanceSchedules, InsertMaintenanceSchedule,
  inventoryItems, InsertInventoryItem, inventoryTransactions, vendors, InsertVendor,
  financialTransactions, complianceRecords, auditLogs, documents,
  notifications, notificationPreferences, assetPhotos, InsertAssetPhoto,
  scheduledReports, InsertScheduledReport, assetTransfers, quickbooksConfig, InsertQuickBooksConfig,
  userPreferences, InsertUserPreferences, emailNotifications, InsertEmailNotification,
  workOrderTemplates, InsertWorkOrderTemplate
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
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

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
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

export async function updateUserRole(userId: number, role: "admin" | "manager" | "technician" | "user") {
  const db = await getDb();
  if (!db) return null;
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return await db.select().from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);
}

// ============= SITES MANAGEMENT =============

export async function createSite(site: InsertSite) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(sites).values(site);
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId);
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
  const result = await db.insert(assetCategories).values({ name, description });
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId);
  if (!insertId || isNaN(insertId)) throw new Error("Failed to get insert ID");
  return await db.select().from(assetCategories).where(eq(assetCategories.id, insertId)).limit(1).then(r => r[0]);
}

// ============= ASSETS MANAGEMENT =============

export async function createAsset(asset: InsertAsset) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(assets).values(asset);
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId);
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

// ============= WORK ORDERS =============

export async function createWorkOrder(workOrder: InsertWorkOrder) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(workOrders).values(workOrder);
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId);
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
  const result = await db.insert(maintenanceSchedules).values(schedule);
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId);
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
  const result = await db.insert(inventoryItems).values(item);
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId);
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

export async function getLowStockItems(siteId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [sql`${inventoryItems.currentStock} <= ${inventoryItems.reorderPoint}`];
  if (siteId) conditions.push(eq(inventoryItems.siteId, siteId));
  
  return await db.select().from(inventoryItems)
    .where(and(...conditions))
    .orderBy(asc(inventoryItems.currentStock));
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
  const result = await db.insert(inventoryTransactions).values(transaction);
  const insertId = (result as any).insertId;
  return await db.select().from(inventoryTransactions).where(eq(inventoryTransactions.id, Number(insertId))).limit(1).then(r => r[0]);
}

export async function getInventoryTransactions(itemId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inventoryTransactions)
    .where(eq(inventoryTransactions.itemId, itemId))
    .orderBy(desc(inventoryTransactions.transactionDate));
}

// ============= VENDORS =============

export async function createVendor(vendor: InsertVendor) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(vendors).values(vendor);
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId);
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
  const result = await db.insert(financialTransactions).values(transaction);
  const insertId = (result as any).insertId;
  return await db.select().from(financialTransactions).where(eq(financialTransactions.id, Number(insertId))).limit(1).then(r => r[0]);
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
  const result = await db.insert(complianceRecords).values(record);
  const insertId = (result as any).insertId;
  return await db.select().from(complianceRecords).where(eq(complianceRecords.id, Number(insertId))).limit(1).then(r => r[0]);
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
  const result = await db.insert(documents).values(doc);
  const insertId = (result as any).insertId;
  return await db.select().from(documents).where(eq(documents.id, Number(insertId))).limit(1).then(r => r[0]);
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
    .where(sql`${inventoryItems.currentStock} <= ${inventoryItems.reorderPoint}`);
  
  return {
    totalAssets: totalAssets?.count || 0,
    operationalAssets: operationalAssets?.count || 0,
    maintenanceAssets: maintenanceAssets?.count || 0,
    pendingWorkOrders: pendingWorkOrders?.count || 0,
    inProgressWorkOrders: inProgressWorkOrders?.count || 0,
    lowStockItems: lowStockCount?.count || 0,
  };
}

// ============= NOTIFICATIONS =============

export async function createNotification(notification: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(notifications).values(notification);
  return Number(result[0].insertId);
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
  return result[0]?.count || 0;
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
  
  const result = await db.insert(assetPhotos).values(data);
  const insertId = Number(result[0].insertId);
  return insertId;
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
  
  const result = await db.insert(scheduledReports).values(data);
  const insertId = Number(result[0].insertId);
  return insertId;
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
  const result = await db.insert(assetTransfers).values(transfer);
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId);
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
  const result = await db.insert(quickbooksConfig).values(config);
  const insertId = result[0].insertId;
  
  return await db.select().from(quickbooksConfig).where(eq(quickbooksConfig.id, Number(insertId))).limit(1).then(r => r[0]);
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
  
  const existing = await getUserPreferences(prefs.userId);
  
  if (existing) {
    await db.update(userPreferences)
      .set({ ...prefs, updatedAt: new Date() })
      .where(eq(userPreferences.userId, prefs.userId));
    return await getUserPreferences(prefs.userId);
  } else {
    const result = await db.insert(userPreferences).values(prefs);
    const insertId = result[0].insertId;
    return await db.select().from(userPreferences).where(eq(userPreferences.id, Number(insertId))).limit(1).then(r => r[0]);
  }
}


// ============= Email Notifications =============
export async function createEmailNotification(notification: InsertEmailNotification) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(emailNotifications).values(notification);
  const insertId = result[0].insertId;
  return await db.select().from(emailNotifications).where(eq(emailNotifications.id, Number(insertId))).limit(1).then(r => r[0]);
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



// ============= WORK ORDER TEMPLATES =============

export async function createWorkOrderTemplate(data: InsertWorkOrderTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(workOrderTemplates).values(data);
  return Number(result[0].insertId);
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
