import {
  eq,
  and,
  desc,
  asc,
  gte,
  lte,
  lt,
  sql,
  or,
  like,
  isNotNull,
  isNull,
  ilike,
  getTableColumns,
  notInArray,
  inArray,
  max,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  appSettings,
  InsertUser, users, sites, InsertSite, type Site, siteValuations, assetCategories, assets, InsertAsset,
  workOrders, InsertWorkOrder, maintenanceSchedules, InsertMaintenanceSchedule,
  inventoryItems, InsertInventoryItem, inventoryTransactions, vendors, InsertVendor,
  financialTransactions, complianceRecords, auditLogs, documents,
  notifications, notificationPreferences, assetPhotos, InsertAssetPhoto,
  facilityPhotos,
  type FacilityPhoto,
  type NewFacilityPhoto,
  scheduledReports, InsertScheduledReport, assetTransfers, quickbooksConfig, InsertQuickBooksConfig,
  userPreferences, InsertUserPreferences, emailNotifications, InsertEmailNotification,
  workOrderTemplates, InsertWorkOrderTemplate,
  pendingUsers,
  inventoryCatalogue,
  requisitions,
  stockCards,
  stockMovements,
  stockSettings,
  commodityTrackingNumbers,
} from "../drizzle/schema";
import type { FacilityType } from "../shared/facilities";
import {
  getPostgresJsPoolOptions,
  isSupabaseDatabaseUrl,
} from "../shared/mysqlSsl";
import { ENV } from './_core/env';
import type { InventoryTransaction } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;
let _dbUrlFingerprint: string | null = null;

function databaseUrlFingerprint(): string {
  return process.env.DATABASE_URL?.trim() ?? "";
}

export async function getDb() {
  const fingerprint = databaseUrlFingerprint();
  if (_db && _dbUrlFingerprint && _dbUrlFingerprint !== fingerprint) {
    console.warn(
      "[Database] DATABASE_URL changed — resetting pooled connection"
    );
    await resetDbConnection();
  }

  if (!_db && fingerprint) {
    try {
      const url = fingerprint;
      const options = getPostgresJsPoolOptions(url);
      let host = "";
      let port = "";
      try {
        const parsed = new URL(url);
        host = parsed.hostname;
        port = parsed.port;
      } catch {
        // ignore parse errors; postgres will surface them
      }
      console.log("[Database] Initialising postgres.js pool", {
        host,
        port,
        supabase: isSupabaseDatabaseUrl(url),
        prepare: options.prepare,
        max: options.max,
        ssl: options.ssl,
        connect_timeout: options.connect_timeout,
      });
      _sql = postgres(url, options);
      _db = drizzle(_sql);
      _dbUrlFingerprint = fingerprint;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _sql = null;
      _dbUrlFingerprint = null;
    }
  }
  return _db;
}

/**
 * Warm the postgres pool (serverless cold start). Retries with backoff and pool reset.
 */
export async function warmDbConnection(
  retries = 3,
  baseDelayMs = 500
): Promise<NonNullable<Awaited<ReturnType<typeof getDb>>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const database = await getDb();
      if (!database) {
        throw new Error(
          "Database not available (check DATABASE_URL and pool initialisation)"
        );
      }
      await database.execute(sql`SELECT 1`);
      return database;
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) {
        console.warn(
          `[Database] warmDbConnection attempt ${attempt + 1}/${retries} failed, retrying`,
          error instanceof Error ? error.message : error
        );
        await resetDbConnection();
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelayMs * (attempt + 1))
        );
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "warmDbConnection failed"));
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
  _dbUrlFingerprint = null;
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
    if (user.status !== undefined) {
      values.status = user.status;
      updateSet.status = user.status;
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
  return await db.select().from(users).orderBy(desc(users.createdAt)).limit(1000);
}

export type AdminUserListRow = {
  user: typeof users.$inferSelect;
  facilityName: string | null;
};

/** Admin user directory with optional filters and joined facility name. */
export async function listAdminUsersWithFacilities(filters?: {
  search?: string;
  role?: "admin" | "manager" | "staff" | "field" | "user";
  facilityId?: number;
  status?: "active" | "inactive" | "pending";
}): Promise<AdminUserListRow[]> {
  const database = await getDb();
  if (!database) return [];

  const conditions = [];
  if (filters?.role) {
    conditions.push(eq(users.role, filters.role));
  }
  if (filters?.facilityId != null) {
    conditions.push(eq(users.siteId, filters.facilityId));
  }
  if (filters?.status) {
    conditions.push(eq(users.status, filters.status));
  }
  const q = filters?.search?.trim();
  if (q) {
    const pattern = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern)));
  }

  return await database
    .select({
      user: users,
      facilityName: sites.name,
    })
    .from(users)
    .leftJoin(sites, eq(users.siteId, sites.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(500);
}

export async function updateUserRole(
  userId: number,
  role: "admin" | "manager" | "staff" | "user" | "field"
) {
  const db = await getDb();
  if (!db) return null;
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return await db.select().from(users).where(eq(users.id, userId)).limit(1).then(r => r[0]);
}

/** Insert `public.users` row after Supabase Auth user creation (admin invite / create user). */
export async function insertAppUserLinkedToAuth(params: {
  authUserId: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "staff" | "user" | "field";
  siteId?: number | null;
  status?: "active" | "inactive" | "pending";
  mustChangePasswordOnLogin?: boolean;
}): Promise<number> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const [inserted] = await database
    .insert(users)
    .values({
      openId: params.authUserId,
      authUserId: params.authUserId,
      name: params.name,
      email: params.email,
      loginMethod: "supabase",
      role: params.role,
      siteId: params.siteId ?? null,
      status: params.status ?? "active",
      hasCompletedOnboarding: true,
      mustChangePasswordOnLogin: params.mustChangePasswordOnLogin ?? false,
      lastSignedIn: new Date(),
    })
    .returning({ id: users.id });
  const userId = inserted?.id;
  if (userId == null || !Number.isFinite(userId)) {
    throw new Error("Failed to create app user row");
  }
  return userId;
}

export async function clearMustChangePasswordOnLogin(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database
    .update(users)
    .set({ mustChangePasswordOnLogin: false, updatedAt: new Date() })
    .where(eq(users.id, userId));
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

export type SiteListRow = Site & {
  parentFacilityName: string | null;
};

/** Facilities list with hierarchy label (for UI / `sites.list`). */
export async function getSitesList(opts?: { facilityType?: FacilityType }): Promise<SiteListRow[]> {
  const database = await getDb();
  if (!database) return [];
  const allSitesRaw = await database.select().from(sites).orderBy(asc(sites.name));
  const allSites =
    opts?.facilityType != null
      ? allSitesRaw.filter((s) => s.facilityType === opts.facilityType)
      : allSitesRaw;
  const idToName = new Map(allSitesRaw.map((s) => [s.id, s.name]));

  return allSites.map((s) => ({
    ...s,
    parentFacilityName:
      s.parentFacilityId != null ? idToName.get(s.parentFacilityId) ?? null : null,
  }));
}

export type SiteMapDataRow = {
  id: number;
  name: string;
  facilityType: FacilityType;
  latitude: string | null;
  longitude: string | null;
  parentFacilityId: number | null;
  assetCount: number;
  inventoryCount: number;
};

/** Active facilities with map coordinates and asset/inventory counts (for Asset Map). */
export async function getSitesMapData(): Promise<SiteMapDataRow[]> {
  const database = await getDb();
  if (!database) return [];

  const rows = await database
    .select({
      id: sites.id,
      name: sites.name,
      facilityType: sites.facilityType,
      latitude: sites.latitude,
      longitude: sites.longitude,
      parentFacilityId: sites.parentFacilityId,
      assetCount: sql<number>`cast(count(distinct ${assets.id}) as int)`,
      inventoryCount: sql<number>`cast(count(distinct ${inventoryItems.id}) as int)`,
    })
    .from(sites)
    .leftJoin(assets, eq(assets.siteId, sites.id))
    .leftJoin(inventoryItems, eq(inventoryItems.siteId, sites.id))
    .where(eq(sites.isActive, true))
    .groupBy(
      sites.id,
      sites.name,
      sites.facilityType,
      sites.latitude,
      sites.longitude,
      sites.parentFacilityId
    );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    facilityType: row.facilityType,
    latitude: row.latitude != null ? String(row.latitude) : null,
    longitude: row.longitude != null ? String(row.longitude) : null,
    parentFacilityId: row.parentFacilityId,
    assetCount: row.assetCount ?? 0,
    inventoryCount: row.inventoryCount ?? 0,
  }));
}

export type SidebarNavCounts = {
  facilities: {
    all: number;
    nationalHq: number;
    branches: number;
    divisions: number;
    clinics: number;
    warehouses: number;
  };
  inventory: {
    stockOverview: number | null;
    tracking: number | null;
    requisitions: number | null;
    receipts: number | null;
    issues: number | null;
  };
};

export async function getNavSidebarCounts(): Promise<SidebarNavCounts | null> {
  const database = await getDb();
  if (!database) return null;

  const typeRows = await database
    .select({
      facilityType: sites.facilityType,
      c: sql<number>`cast(count(*) as int)`,
    })
    .from(sites)
    .groupBy(sites.facilityType);

  const byType = new Map(typeRows.map((r) => [r.facilityType, r.c]));
  const all = typeRows.reduce((sum, r) => sum + r.c, 0);
  const branches = byType.get("branch") ?? 0;
  const divisions = byType.get("division") ?? 0;
  const clinics = byType.get("clinic") ?? 0;
  const warehouses = byType.get("warehouse") ?? 0;
  const nationalHq = byType.get("national_headquarters") ?? 0;

  const [whRow] = await database
    .select({ c: sql<number>`cast(count(*) as int)` })
    .from(sites)
    .where(eq(sites.facilityType, "warehouse"));
  const [catRow] = await database.select({ c: sql<number>`cast(count(*) as int)` }).from(inventoryCatalogue);
  const whCount = whRow?.c ?? 0;
  const catCount = catRow?.c ?? 0;
  const stockOverview = whCount * catCount;

  const [reqRow] = await database.select({ c: sql<number>`cast(count(*) as int)` }).from(requisitions);

  return {
    facilities: { all, nationalHq, branches, divisions, clinics, warehouses },
    inventory: {
      stockOverview,
      tracking: null,
      requisitions: reqRow?.c ?? null,
      receipts: null,
      issues: null,
    },
  };
}

export async function getFacilitiesByType(facilityType: FacilityType) {
  const database = await getDb();
  if (!database) return [];
  return database
    .select()
    .from(sites)
    .where(eq(sites.facilityType, facilityType))
    .orderBy(asc(sites.name));
}

export async function getChildFacilities(parentId: number) {
  const database = await getDb();
  if (!database) return [];
  return database
    .select()
    .from(sites)
    .where(eq(sites.parentFacilityId, parentId))
    .orderBy(asc(sites.name));
}

/** True if assigning `parentId` as parent of `siteId` would create a cycle. */
export async function wouldCreateFacilityParentCycle(
  siteId: number,
  parentId: number | null
): Promise<boolean> {
  if (parentId == null) return false;
  if (parentId === siteId) return true;
  const database = await getDb();
  if (!database) return false;
  let current: number | null = parentId;
  const visited = new Set<number>();
  while (current != null) {
    if (current === siteId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    const row = await database
      .select({ pid: sites.parentFacilityId })
      .from(sites)
      .where(eq(sites.id, current))
      .limit(1);
    current = row[0]?.pid ?? null;
  }
  return false;
}

export async function getSiteById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.select().from(sites).where(eq(sites.id, id)).limit(1).then(r => r[0] || null);
}

export async function getSiteByIdEnriched(id: number) {
  const row = await getSiteById(id);
  if (!row) return null;
  let parentFacilityName: string | null = null;
  if (row.parentFacilityId != null) {
    parentFacilityName = (await getSiteById(row.parentFacilityId))?.name ?? null;
  }
  return { ...row, parentFacilityName };
}

export async function updateSite(id: number, data: Partial<InsertSite>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(sites).set(data).where(eq(sites.id, id));
  return await getSiteById(id);
}

export async function getFacilityPhotos(siteId: number): Promise<FacilityPhoto[]> {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(facilityPhotos)
    .where(eq(facilityPhotos.siteId, siteId))
    .orderBy(desc(facilityPhotos.createdAt));
}

export async function addFacilityPhoto(data: NewFacilityPhoto): Promise<FacilityPhoto> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(facilityPhotos).values(data).returning();
  if (!row) throw new Error("Failed to insert facility photo");
  return row;
}

export async function deleteFacilityPhoto(id: number, uploadedBy: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(facilityPhotos)
    .where(and(eq(facilityPhotos.id, id), eq(facilityPhotos.uploadedBy, uploadedBy)));
}

export async function deleteFacilityPhotoById(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(facilityPhotos).where(eq(facilityPhotos.id, id));
}

export async function getFacilityPhotoById(id: number): Promise<FacilityPhoto | null> {
  const db = await getDb();
  if (!db) return null;
  return await db
    .select()
    .from(facilityPhotos)
    .where(eq(facilityPhotos.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
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

/** Next NRCS register sequence number for a branch + 2-letter category code (existing rows with null assetNum are ignored). */
export async function getNextAssetRegisterSequence(branchCode: string, itemCategoryCode: string): Promise<number> {
  const database = await getDb();
  if (!database) return 1;
  const branch = branchCode.trim();
  const cat = itemCategoryCode.trim().slice(0, 2).toUpperCase();
  if (!branch || cat.length !== 2) return 1;
  const [row] = await database
    .select({ m: max(assets.assetNum) })
    .from(assets)
    .where(and(eq(assets.branchCode, branch), eq(assets.itemCategoryCode, cat)));
  const maxNum = row?.m != null ? Number(row.m) : 0;
  return Number.isFinite(maxNum) ? maxNum + 1 : 1;
}

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

export async function getAllAssets(filters?: {
  siteId?: number;
  status?: string;
  categoryId?: number;
  categoryIds?: number[];
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(assets);
  const conditions = [];
  
  if (filters?.siteId) conditions.push(eq(assets.siteId, filters.siteId));
  if (filters?.status) conditions.push(eq(assets.status, filters.status as any));
  if (filters?.categoryIds?.length) {
    conditions.push(inArray(assets.categoryId, filters.categoryIds));
  } else if (filters?.categoryId) {
    conditions.push(eq(assets.categoryId, filters.categoryId));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return await query.orderBy(desc(assets.createdAt)).limit(2000);
}

export async function getAssetById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.select().from(assets).where(eq(assets.id, id)).limit(1).then(r => r[0] || null);
}

export async function updateAsset(id: number, data: Partial<InsertAsset>) {
  const db = await getDb();
  if (!db) return null;
  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Partial<InsertAsset>;
  await db.update(assets).set({ ...cleaned, updatedAt: new Date() }).where(eq(assets.id, id));
  return await getAssetById(id);
}

function serializeAuditScalar(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return Number(v);
  if (v === null || v === undefined) return null;
  return v;
}

/** JSON-serializable snapshot of an asset row for audit diffs. */
export function serializeAssetForAudit(row: typeof assets.$inferSelect): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = serializeAuditScalar(v);
  }
  return out;
}

const ASSET_AUDIT_IGNORE_FIELDS = new Set(["updatedAt"]);

export function diffAssetSnapshotKeys(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const k of Array.from(keys)) {
    if (ASSET_AUDIT_IGNORE_FIELDS.has(k)) continue;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  }
  return changed;
}

/**
 * Updates an asset and writes `asset_edit` audit in the same transaction.
 * Rolls back the update if the audit insert fails.
 */
export async function updateAssetWithAssetEditAudit(
  id: number,
  data: Partial<InsertAsset>,
  userId: number
): Promise<typeof assets.$inferSelect | null> {
  const database = await getDb();
  if (!database) return null;

  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Partial<InsertAsset>;
  if (Object.keys(cleaned).length === 0) {
    return await getAssetById(id);
  }

  return await database.transaction(async (tx) => {
    const [before] = await tx.select().from(assets).where(eq(assets.id, id)).limit(1);
    if (!before) {
      throw new Error("Asset not found");
    }

    await tx.update(assets).set({ ...cleaned, updatedAt: new Date() }).where(eq(assets.id, id));

    const [after] = await tx.select().from(assets).where(eq(assets.id, id)).limit(1);
    if (!after) {
      throw new Error("Asset not found after update");
    }

    const b = serializeAssetForAudit(before);
    const a = serializeAssetForAudit(after);
    const changedFields = diffAssetSnapshotKeys(b, a);

    await tx.insert(auditLogs).values({
      userId,
      action: "asset_edit",
      entityType: "asset",
      entityId: id,
      changes: JSON.stringify({ before: b, after: a, changedFields }),
      ipAddress: null,
      userAgent: null,
    });

    return after;
  });
}

/** Backfill asset lat/long from linked facility when either coordinate is null. */
export async function backfillAssetCoordinatesFromSites(): Promise<number> {
  const database = await getDb();
  if (!database) return 0;
  const rows = await database.execute(sql`
    UPDATE assets AS a
    SET
      latitude = s.latitude,
      longitude = s.longitude,
      "updatedAt" = NOW()
    FROM sites AS s
    WHERE a."siteId" = s.id
      AND s.latitude IS NOT NULL
      AND s.longitude IS NOT NULL
      AND (a.latitude IS NULL OR a.longitude IS NULL)
    RETURNING a.id
  `);
  return Array.isArray(rows) ? rows.length : 0;
}

/** Overwrite coordinates for every asset at the facility from the site's current lat/long. */
export async function syncAssetCoordinatesForSiteId(siteId: number): Promise<number> {
  const database = await getDb();
  if (!database) return 0;
  const rows = await database.execute(sql`
    UPDATE assets AS a
    SET
      latitude = s.latitude,
      longitude = s.longitude,
      "updatedAt" = NOW()
    FROM sites AS s
    WHERE a."siteId" = s.id
      AND s.id = ${siteId}
      AND s.latitude IS NOT NULL
      AND s.longitude IS NOT NULL
    RETURNING a.id
  `);
  return Array.isArray(rows) ? rows.length : 0;
}

/** Assets eligible for automatic register depreciation (not manually overridden, required fields present). */
export async function listAssetsEligibleForAutoDepreciation(): Promise<
  Array<{
    id: number;
    actualUnitValue: string | null;
    itemCategory: string | null;
    yearAcquiredRegister: number | null;
  }>
> {
  const database = await getDb();
  if (!database) return [];
  return await database
    .select({
      id: assets.id,
      actualUnitValue: assets.actualUnitValue,
      itemCategory: assets.itemCategory,
      yearAcquiredRegister: assets.yearAcquiredRegister,
    })
    .from(assets)
    .where(
      and(
        eq(assets.depreciatedValueManualOverride, false),
        isNotNull(assets.actualUnitValue),
        isNotNull(assets.itemCategory),
        sql`trim(coalesce(${assets.itemCategory}, '')) <> ''`,
        isNotNull(assets.yearAcquiredRegister)
      )
    );
}

export async function countAllAssets(): Promise<number> {
  const database = await getDb();
  if (!database) return 0;
  const [row] = await database
    .select({ c: sql<number>`count(*)::int` })
    .from(assets);
  return row?.c ?? 0;
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

// Capped at 10,000 to prevent Vercel function memory/timeout issues.
// For larger exports, apply filters (site, category, status) first.
export const ASSET_REGISTER_MAX_LIMIT = 10_000;

export type AssetRegisterListParams = {
  siteId?: number;
  categoryId?: number;
  /** When set (non-empty), matches assets whose categoryId is any of these (e.g. duplicate category names). */
  categoryIds?: number[];
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
  if (params.categoryIds?.length) {
    conditions.push(inArray(assets.categoryId, params.categoryIds));
  } else if (params.categoryId) {
    conditions.push(eq(assets.categoryId, params.categoryId));
  }
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
  
  return await query.orderBy(desc(workOrders.createdAt)).limit(2000);
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
  
  return await query.orderBy(asc(maintenanceSchedules.nextDue)).limit(2000);
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

/** Assets with no physical check or last check older than 6 months (for reminder emails). */
export async function listAssetsForPhysicalCheckReminder() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: assets.id,
      siteId: assets.siteId,
      assetTag: assets.assetTag,
      name: assets.name,
      lastPhysicalCheck: assets.lastPhysicalCheck,
    })
    .from(assets)
    .where(
      or(
        isNull(assets.lastPhysicalCheck),
        sql`${assets.lastPhysicalCheck} < (CURRENT_DATE - interval '6 months')`
      )
    );
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

  // Capped at 500 — server-side filters should be applied for large date ranges
  return await query.orderBy(desc(financialTransactions.transactionDate)).limit(500);
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
  
  return await query.orderBy(desc(complianceRecords.createdAt)).limit(2000);
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
  
  return await result.limit(500);
}

/** Asset register edit history (`action = asset_edit`) with editor display name. */
export async function getAssetEditAuditLogs(assetId: number, limit = 100) {
  const database = await getDb();
  if (!database) return [];

  return await database
    .select({
      id: auditLogs.id,
      timestamp: auditLogs.timestamp,
      userId: auditLogs.userId,
      changes: auditLogs.changes,
      userLabel: sql<string>`coalesce(${users.name}, ${users.email}, 'User #' || ${auditLogs.userId}::text)`,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(
      and(
        eq(auditLogs.entityType, "asset"),
        eq(auditLogs.entityId, assetId),
        eq(auditLogs.action, "asset_edit")
      )
    )
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit);
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

export async function getDashboardStats(opts?: { siteId?: number }) {
  const db = await getDb();
  if (!db) return null;

  const siteId = opts?.siteId;
  const assetScope = siteId != null ? eq(assets.siteId, siteId) : undefined;

  const [anyMovement] = await db.select({ id: stockMovements.id }).from(stockMovements).limit(1);

  const [totalAssets] = assetScope
    ? await db.select({ count: sql<number>`count(*)` }).from(assets).where(assetScope)
    : await db.select({ count: sql<number>`count(*)` }).from(assets);
  const [operationalAssets] = assetScope
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(assets)
        .where(and(eq(assets.status, "operational"), assetScope))
    : await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.status, "operational"));
  const [maintenanceAssets] = assetScope
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(assets)
        .where(and(eq(assets.status, "maintenance"), assetScope))
    : await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.status, "maintenance"));
  const [pendingWorkOrders] = await db.select({ count: sql<number>`count(*)` }).from(workOrders).where(eq(workOrders.status, "pending"));
  const [inProgressWorkOrders] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workOrders)
    .where(eq(workOrders.status, "in_progress"));

  let lowStockItems = 0;
  if (anyMovement) {
    const movementTotals = db
      .select({
        stockCardId: stockMovements.stockCardId,
        netQuantity: sql<number>`coalesce(sum(${stockMovements.quantityIn} - ${stockMovements.quantityOut}), 0)`
          .mapWith(Number)
          .as("netQuantity"),
      })
      .from(stockMovements)
      .groupBy(stockMovements.stockCardId)
      .as("movement_net_kpi");

    const thresholdSql = sql`coalesce(${stockSettings.minLevel}, ${stockCards.stockMinimum}, 0)`;
    const lowStockScope = siteId != null ? eq(stockCards.locationId, siteId) : undefined;

    const [lowStockCount] = await db
      .select({ count: sql<number>`count(distinct ${stockCards.id})`.mapWith(Number) })
      .from(stockCards)
      .innerJoin(commodityTrackingNumbers, eq(stockCards.ctnId, commodityTrackingNumbers.id))
      .leftJoin(movementTotals, eq(movementTotals.stockCardId, stockCards.id))
      .leftJoin(
        stockSettings,
        and(
          eq(stockSettings.catalogueId, commodityTrackingNumbers.itemId),
          eq(stockSettings.warehouseId, stockCards.locationId)
        )
      )
      .where(
        and(
          lowStockScope,
          sql`${thresholdSql} > 0`,
          sql`coalesce(${movementTotals.netQuantity}, 0) < ${thresholdSql}`
        )
      );
    lowStockItems = Number(lowStockCount?.count ?? 0);
  }

  return {
    totalAssets: Number(totalAssets?.count ?? 0),
    operationalAssets: Number(operationalAssets?.count ?? 0),
    maintenanceAssets: Number(maintenanceAssets?.count ?? 0),
    pendingWorkOrders: Number(pendingWorkOrders?.count ?? 0),
    inProgressWorkOrders: Number(inProgressWorkOrders?.count ?? 0),
    lowStockItems,
  };
}

/** Counts for Reports “Weekly insights” widget (30-day windows where applicable). */
export async function getWeeklyInsights(opts?: { siteId?: number }) {
  const database = await getDb();
  if (!database) {
    return {
      maintenanceDueNext30Days: 0,
      warrantiesExpiringNext30Days: 0,
      lowStockItems: 0,
      overdueWorkOrders: 0,
      pendingUserRequests: 0,
    };
  }
  const siteId = opts?.siteId;
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const maintDueWindow = and(
    eq(maintenanceSchedules.isActive, true),
    gte(maintenanceSchedules.nextDue, now),
    lte(maintenanceSchedules.nextDue, in30)
  );

  const [maintDue] =
    siteId != null
      ? await database
          .select({ count: sql<number>`count(*)` })
          .from(maintenanceSchedules)
          .innerJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
          .where(and(maintDueWindow, eq(assets.siteId, siteId)))
      : await database
          .select({ count: sql<number>`count(*)` })
          .from(maintenanceSchedules)
          .where(maintDueWindow);

  const warrantyWindow = and(
    isNotNull(assets.warrantyExpiry),
    lte(assets.warrantyExpiry, in30),
    gte(assets.warrantyExpiry, now),
    siteId != null ? eq(assets.siteId, siteId) : undefined
  );

  const [warrantyExp] = await database
    .select({ count: sql<number>`count(*)` })
    .from(assets)
    .where(warrantyWindow);

  const lowStockWhere =
    siteId != null
      ? and(
          sql`${inventoryItems.currentStock} < ${inventoryItems.minStockLevel}`,
          eq(inventoryItems.siteId, siteId)
        )
      : sql`${inventoryItems.currentStock} < ${inventoryItems.minStockLevel}`;

  const [lowStock] = await database
    .select({ count: sql<number>`count(*)` })
    .from(inventoryItems)
    .where(lowStockWhere);

  const overdueWoWhere = and(
    notInArray(workOrders.status, ["completed", "cancelled"]),
    isNotNull(workOrders.scheduledEnd),
    lt(workOrders.scheduledEnd, now),
    siteId != null ? eq(workOrders.siteId, siteId) : undefined
  );

  const [overdueWo] = await database
    .select({ count: sql<number>`count(*)` })
    .from(workOrders)
    .where(overdueWoWhere);

  const [pendingReq] =
    siteId != null
      ? [{ count: 0 }]
      : await database
          .select({ count: sql<number>`count(*)` })
          .from(pendingUsers)
          .where(eq(pendingUsers.status, "pending"));

  return {
    maintenanceDueNext30Days: Number(maintDue?.count ?? 0),
    warrantiesExpiringNext30Days: Number(warrantyExp?.count ?? 0),
    lowStockItems: Number(lowStock?.count ?? 0),
    overdueWorkOrders: Number(overdueWo?.count ?? 0),
    pendingUserRequests: Number(pendingReq?.count ?? 0),
  };
}

export async function getAppSettingValue(key: string): Promise<string | null> {
  const database = await getDb();
  if (!database) return null;
  const rows = await database.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function getAppSettingBool(key: string, defaultValue: boolean): Promise<boolean> {
  const raw = await getAppSettingValue(key);
  if (raw === null) return defaultValue;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1";
}

export async function setAppSettingValue(key: string, value: string): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const existing = await database.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (existing.length > 0) {
    await database.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
  } else {
    await database.insert(appSettings).values({ key, value });
  }
}

const SEARCH_LIMIT = 8;

export async function searchAssetsGlobal(pattern: string, siteId?: number) {
  if (siteId === -1) return [];
  const database = await getDb();
  if (!database) return [];
  const q = `%${pattern}%`;
  const textMatch = or(ilike(assets.name, q), ilike(assets.assetTag, q))!;
  return database
    .select({
      id: assets.id,
      name: assets.name,
      assetTag: assets.assetTag,
      status: assets.status,
    })
    .from(assets)
    .where(
      siteId != null && siteId > 0 ? and(textMatch, eq(assets.siteId, siteId)) : textMatch
    )
    .limit(SEARCH_LIMIT);
}

export async function searchWorkOrdersGlobal(pattern: string, siteId?: number) {
  if (siteId === -1) return [];
  const database = await getDb();
  if (!database) return [];
  const q = `%${pattern}%`;
  const textMatch = or(ilike(workOrders.workOrderNumber, q), ilike(workOrders.title, q))!;
  return database
    .select({
      id: workOrders.id,
      workOrderNumber: workOrders.workOrderNumber,
      title: workOrders.title,
      status: workOrders.status,
    })
    .from(workOrders)
    .where(
      siteId != null && siteId > 0 ? and(textMatch, eq(workOrders.siteId, siteId)) : textMatch
    )
    .limit(SEARCH_LIMIT);
}

export async function searchInventoryGlobal(pattern: string, siteId?: number) {
  if (siteId === -1) return [];
  const database = await getDb();
  if (!database) return [];
  const q = `%${pattern}%`;
  const textMatch = or(ilike(inventoryItems.name, q), ilike(inventoryItems.itemCode, q))!;
  return database
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      itemCode: inventoryItems.itemCode,
      currentStock: inventoryItems.currentStock,
    })
    .from(inventoryItems)
    .where(
      siteId != null && siteId > 0 ? and(textMatch, eq(inventoryItems.siteId, siteId)) : textMatch
    )
    .limit(SEARCH_LIMIT);
}

export async function searchSitesGlobal(pattern: string) {
  const database = await getDb();
  if (!database) return [];
  const q = `%${pattern}%`;
  return database
    .select({ id: sites.id, name: sites.name })
    .from(sites)
    .where(ilike(sites.name, q))
    .limit(SEARCH_LIMIT);
}

export async function searchUsersGlobal(pattern: string) {
  const database = await getDb();
  if (!database) return [];
  const q = `%${pattern}%`;
  return database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(or(ilike(users.email, q), ilike(users.name, q)))
    .limit(SEARCH_LIMIT);
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

export async function markNotificationAsRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
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

export async function deleteNotification(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.delete(notifications).where(
    and(eq(notifications.id, id), eq(notifications.userId, userId))
  );
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

export type OrphanedAppUser = {
  id: number;
  email: string | null;
  role: string;
  createdAt: Date;
};

/** App users with no matching auth.users row (ghost accounts). */
export async function findOrphanedAppUsers(): Promise<OrphanedAppUser[]> {
  const database = await getDb();
  if (!database) return [];

  const rows = await database.execute(sql`
    SELECT u.id, u.email, u.role, u."createdAt"
    FROM public.users u
    LEFT JOIN auth.users a ON LOWER(a.email) = LOWER(u.email)
    WHERE u.email IS NOT NULL
      AND a.id IS NULL
    ORDER BY u."createdAt" DESC
  `);

  const list = Array.isArray(rows) ? rows : [];
  return list.map((r: Record<string, unknown>) => ({
    id: Number(r.id),
    email: r.email != null ? String(r.email) : null,
    role: String(r.role),
    createdAt:
      r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt ?? "")),
  }));
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

/** Match unique index (branch_code, item_category_code, asset_num) for NRCS register imports. */
export async function getAssetByBranchCategoryNum(
  branchCode: string,
  itemCategoryCode: string,
  assetNum: number
) {
  const database = await getDb();
  if (!database) return undefined;
  const bc = branchCode.trim();
  const cc = itemCategoryCode.trim().toUpperCase();
  if (!bc || !cc || !Number.isFinite(assetNum) || assetNum <= 0) return undefined;
  const [row] = await database
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.branchCode, bc),
        eq(assets.itemCategoryCode, cc),
        eq(assets.assetNum, assetNum)
      )
    )
    .limit(1);
  return row ?? undefined;
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
  status: string | null;
  mustChangePasswordOnLogin: boolean;
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
        status: users.status,
        mustChangePasswordOnLogin: users.mustChangePasswordOnLogin,
      })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${normalized}`)
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    const e = error as {
      message?: string;
      code?: string;
      detail?: string;
      hint?: string;
      severity?: string;
      cause?: unknown;
    };
    console.error("[auth.login] getLoginUserByEmailLowercase query failed", {
      message: e?.message,
      code: e?.code,
      detail: e?.detail,
      hint: e?.hint,
      severity: e?.severity,
      cause: e?.cause,
      raw: error,
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
  
  const transactions = await db
    .select()
    .from(financialTransactions)
    .where(gte(financialTransactions.transactionDate, startDate))
    .limit(1000);
  
  // Calculate totals
  const totalCost = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const maintenanceCost = transactions
    .filter(t => t.transactionType === 'maintenance')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const repairCost = transactions
    .filter(t => t.transactionType === 'repair')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  const uniqueAssetIds = Array.from(
    new Set(transactions.map((t) => t.assetId).filter((id): id is number => id != null))
  );
  const assetRows =
    uniqueAssetIds.length > 0
      ? await db.select().from(assets).where(inArray(assets.id, uniqueAssetIds))
      : [];
  const assetMap = new Map(assetRows.map((a) => [a.id, a]));

  const uniqueCategoryIds = Array.from(
    new Set(assetRows.map((a) => a.categoryId).filter((id): id is number => id != null))
  );
  const categoryRows =
    uniqueCategoryIds.length > 0
      ? await db.select().from(assetCategories).where(inArray(assetCategories.id, uniqueCategoryIds))
      : [];
  const categoryMap = new Map(categoryRows.map((c) => [c.id, c]));

  const uniqueSiteIds = Array.from(
    new Set(assetRows.map((a) => a.siteId).filter((id): id is number => id != null))
  );
  const siteRows =
    uniqueSiteIds.length > 0
      ? await db.select().from(sites).where(inArray(sites.id, uniqueSiteIds))
      : [];
  const siteMap = new Map(siteRows.map((s) => [s.id, s]));

  const uniqueVendorIds = Array.from(
    new Set(transactions.map((t) => t.vendorId).filter((id): id is number => id != null))
  );
  const vendorRows =
    uniqueVendorIds.length > 0
      ? await db.select().from(vendors).where(inArray(vendors.id, uniqueVendorIds))
      : [];
  const vendorMap = new Map(vendorRows.map((v) => [v.id, v]));

  const byCategory: Record<number, { categoryId: number; categoryName: string; total: number }> = {};
  for (const transaction of transactions) {
    if (transaction.assetId) {
      const asset = assetMap.get(transaction.assetId);
      if (asset?.categoryId) {
        if (!byCategory[asset.categoryId]) {
          const category = categoryMap.get(asset.categoryId);
          byCategory[asset.categoryId] = {
            categoryId: asset.categoryId,
            categoryName: category?.name ?? "Unknown",
            total: 0,
          };
        }
        byCategory[asset.categoryId].total += parseFloat(transaction.amount);
      }
    }
  }

  const bySite: Record<number, { siteId: number; siteName: string; total: number }> = {};
  for (const transaction of transactions) {
    if (transaction.assetId) {
      const asset = assetMap.get(transaction.assetId);
      if (asset?.siteId) {
        if (!bySite[asset.siteId]) {
          const site = siteMap.get(asset.siteId);
          bySite[asset.siteId] = {
            siteId: asset.siteId,
            siteName: site?.name ?? "Unknown",
            total: 0,
          };
        }
        bySite[asset.siteId].total += parseFloat(transaction.amount);
      }
    }
  }

  const byVendor: Record<number, { vendorId: number; vendorName: string; total: number; transactionCount: number }> = {};
  for (const transaction of transactions) {
    if (transaction.vendorId) {
      if (!byVendor[transaction.vendorId]) {
        const vendor = vendorMap.get(transaction.vendorId);
        byVendor[transaction.vendorId] = {
          vendorId: transaction.vendorId,
          vendorName: vendor?.name ?? "Unknown",
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

const movableNonLandSql = sql`coalesce(upper(trim(${assets.itemCategoryCode})), '') not in ('LA', 'LB')`;
/** Prefer NRCS register `actual_unit_value`, fall back to legacy `acquisitionCost`. */
const movableUnitValueSql = sql`coalesce(${assets.actualUnitValue}::numeric, ${assets.acquisitionCost}::numeric, 0)`;
const movableHasValueSql = sql`(${assets.actualUnitValue} is not null or ${assets.acquisitionCost} is not null)`;
const movableDepreciatedSql = sql`coalesce(${assets.depreciatedValue}::numeric, ${assets.currentDepreciatedValue}::numeric, 0)`;

export type DashboardAssetValueBreakdown = {
  propertyNgn: number;
  movableNgn: number;
  totalNgn: number;
};

/**
 * Dashboard KPI: certified property valuations + movable register values (excludes LA/LB so land/buildings are not double-counted).
 */
export async function getDashboardTotalAssetValue(
  scope: { mode: "all" } | { mode: "site"; siteId: number }
): Promise<DashboardAssetValueBreakdown> {
  const database = await getDb();
  if (!database) return { propertyNgn: 0, movableNgn: 0, totalNgn: 0 };

  const siteValFilter = scope.mode === "site" ? eq(siteValuations.siteId, scope.siteId) : undefined;
  const [propRow] = await database
    .select({
      propertyNgn: sql<number>`coalesce(sum(${siteValuations.certifiedValue}::numeric), 0)`.mapWith(Number),
    })
    .from(siteValuations)
    .where(siteValFilter ?? sql`true`);

  const assetSiteFilter = scope.mode === "site" ? eq(assets.siteId, scope.siteId) : undefined;
  const [movRow] = await database
    .select({
      movableNgn: sql<number>`coalesce(sum(${movableUnitValueSql}), 0)`.mapWith(Number),
    })
    .from(assets)
    .where(and(movableNonLandSql, movableHasValueSql, assetSiteFilter ?? sql`true`));

  const propertyNgn = Number(propRow?.propertyNgn ?? 0);
  const movableNgn = Number(movRow?.movableNgn ?? 0);
  return { propertyNgn, movableNgn, totalNgn: propertyNgn + movableNgn };
}

export type AssetValuationPropertyRow = {
  valuationId: number;
  siteId: number;
  facilityCode: string | null;
  facilityName: string;
  state: string | null;
  landAreaSqm: string | null;
  marketValueNgn: number;
  certifiedValueNgn: number;
  valuationDate: string;
  valuationReference: string | null;
  notes: string | null;
};

export type AssetValuationPendingRow = {
  siteId: number;
  facilityCode: string | null;
  facilityName: string;
  state: string | null;
  facilityType: string;
};

export type AssetValuationMovableCategoryRow = {
  categoryName: string;
  count: number;
  totalAcquisitionNgn: number;
  totalDepreciatedNgn: number;
};

export type AssetValuationReport = {
  totalCertifiedPropertyNgn: number;
  totalMovableAcquisitionNgn: number;
  combinedTotalNgn: number;
  valuationRowCount: number;
  distinctSitesWithValuation: number;
  totalFacilityCount: number;
  propertyRegister: AssetValuationPropertyRow[];
  pendingValuation: AssetValuationPendingRow[];
  /** Active branch offices with no property valuation row. */
  pendingBranchValuation: AssetValuationPendingRow[];
  /** Count of active `branch` facilities in `sites`. */
  activeBranchCount: number;
  movableByCategory: AssetValuationMovableCategoryRow[];
};

function numFromDb(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatIsoDate(d: Date | string | null | undefined): string {
  if (d == null) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Full Asset Valuation register + summaries (manager/admin Finance page). */
export async function getAssetValuationReport(): Promise<AssetValuationReport> {
  const empty: AssetValuationReport = {
    totalCertifiedPropertyNgn: 0,
    totalMovableAcquisitionNgn: 0,
    combinedTotalNgn: 0,
    valuationRowCount: 0,
    distinctSitesWithValuation: 0,
    totalFacilityCount: 0,
    propertyRegister: [],
    pendingValuation: [],
    pendingBranchValuation: [],
    activeBranchCount: 0,
    movableByCategory: [],
  };

  const database = await getDb();
  if (!database) return empty;

  const [sumCert] = await database
    .select({
      total: sql<number>`coalesce(sum(${siteValuations.certifiedValue}::numeric), 0)`.mapWith(Number),
      rows: sql<number>`count(*)::int`.mapWith(Number),
      distinctSites: sql<number>`count(distinct ${siteValuations.siteId})::int`.mapWith(Number),
    })
    .from(siteValuations);

  const [movSum] = await database
    .select({
      total: sql<number>`coalesce(sum(${movableUnitValueSql}), 0)`.mapWith(Number),
    })
    .from(assets)
    .where(and(movableNonLandSql, movableHasValueSql));

  const [facCount] = await database
    .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
    .from(sites);

  const [activeBranchRow] = await database
    .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
    .from(sites)
    .where(and(eq(sites.facilityType, "branch"), eq(sites.isActive, true)));

  const valuedSiteIds = await database.selectDistinct({ siteId: siteValuations.siteId }).from(siteValuations);
  const ids = valuedSiteIds.map((r) => r.siteId).filter((id): id is number => id != null);
  const pendingBranchBase = and(eq(sites.facilityType, "branch"), eq(sites.isActive, true));

  const pending =
    ids.length === 0
      ? await database
          .select({
            siteId: sites.id,
            facilityCode: sites.code,
            facilityName: sites.name,
            state: sites.state,
            facilityType: sites.facilityType,
          })
          .from(sites)
          .orderBy(asc(sites.state), asc(sites.name))
      : await database
          .select({
            siteId: sites.id,
            facilityCode: sites.code,
            facilityName: sites.name,
            state: sites.state,
            facilityType: sites.facilityType,
          })
          .from(sites)
          .where(notInArray(sites.id, ids))
          .orderBy(asc(sites.state), asc(sites.name));

  const branchWithoutValuationSql = and(
    pendingBranchBase,
    sql`not exists (select 1 from ${siteValuations} where ${siteValuations.siteId} = ${sites.id})`
  );

  const pendingBranches = await database
    .select({
      siteId: sites.id,
      facilityCode: sites.code,
      facilityName: sites.name,
      state: sites.state,
      facilityType: sites.facilityType,
    })
    .from(sites)
    .where(branchWithoutValuationSql)
    .orderBy(asc(sites.state), asc(sites.name));

  const propRows = await database
    .select({
      valuationId: siteValuations.id,
      siteId: siteValuations.siteId,
      facilityCode: sites.code,
      facilityName: sites.name,
      state: sites.state,
      landAreaSqm: siteValuations.landAreaSqm,
      marketValue: siteValuations.marketValue,
      certifiedValue: siteValuations.certifiedValue,
      valuationDate: siteValuations.valuationDate,
      valuationReference: siteValuations.valuationReference,
      notes: siteValuations.notes,
    })
    .from(siteValuations)
    .innerJoin(sites, eq(siteValuations.siteId, sites.id))
    .orderBy(asc(sites.state), asc(sites.code), asc(siteValuations.id));

  const movableRows = await database
    .select({
      categoryName: sql<string>`coalesce(${assetCategories.name}, 'Uncategorized')`,
      count: sql<number>`count(*)::int`.mapWith(Number),
      totalAcquisition: sql<number>`coalesce(sum(${movableUnitValueSql}), 0)`.mapWith(Number),
      totalDep: sql<number>`coalesce(sum(${movableDepreciatedSql}), 0)`.mapWith(Number),
    })
    .from(assets)
    .innerJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .where(and(movableNonLandSql, movableHasValueSql))
    .groupBy(assetCategories.id, assetCategories.name)
    .orderBy(asc(assetCategories.name));

  const totalCertifiedPropertyNgn = Number(sumCert?.total ?? 0);
  const totalMovableAcquisitionNgn = Number(movSum?.total ?? 0);

  return {
    totalCertifiedPropertyNgn,
    totalMovableAcquisitionNgn,
    combinedTotalNgn: totalCertifiedPropertyNgn + totalMovableAcquisitionNgn,
    valuationRowCount: Number(sumCert?.rows ?? 0),
    distinctSitesWithValuation: Number(sumCert?.distinctSites ?? 0),
    totalFacilityCount: Number(facCount?.n ?? 0),
    propertyRegister: propRows.map((r) => ({
      valuationId: r.valuationId,
      siteId: r.siteId,
      facilityCode: r.facilityCode,
      facilityName: r.facilityName,
      state: r.state,
      landAreaSqm: r.landAreaSqm != null ? String(r.landAreaSqm) : null,
      marketValueNgn: numFromDb(r.marketValue),
      certifiedValueNgn: numFromDb(r.certifiedValue),
      valuationDate: formatIsoDate(r.valuationDate),
      valuationReference: r.valuationReference,
      notes: r.notes,
    })),
    pendingValuation: pending.map((r) => ({
      siteId: r.siteId,
      facilityCode: r.facilityCode,
      facilityName: r.facilityName,
      state: r.state,
      facilityType: String(r.facilityType),
    })),
    pendingBranchValuation: pendingBranches.map((r) => ({
      siteId: r.siteId,
      facilityCode: r.facilityCode,
      facilityName: r.facilityName,
      state: r.state,
      facilityType: String(r.facilityType),
    })),
    activeBranchCount: Number(activeBranchRow?.n ?? 0),
    movableByCategory: movableRows.map((r) => ({
      categoryName: r.categoryName,
      count: Number(r.count ?? 0),
      totalAcquisitionNgn: Number(r.totalAcquisition ?? 0),
      totalDepreciatedNgn: Number(r.totalDep ?? 0),
    })),
  };
}
