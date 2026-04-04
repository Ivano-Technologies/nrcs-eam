import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow with extended roles for EAM system
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "manager", "technician", "user"]).default("user").notNull(),
  siteId: int("siteId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false).notNull(),
});

/**
 * Sites/Locations for multi-site management
 */
export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Nigeria"),
  contactPerson: varchar("contactPerson", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  isActive: boolean("isActive").default(true).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Asset Categories (e.g., Machinery, Buildings, Vehicles, Equipment)
 */
export const assetCategories = mysqlTable("assetCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Assets - Core asset inventory
 */
export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  assetTag: varchar("assetTag", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: int("categoryId").notNull(),
  siteId: int("siteId").notNull(),
  status: mysqlEnum("status", ["operational", "maintenance", "repair", "retired", "disposed"]).default("operational").notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  serialNumber: varchar("serialNumber", { length: 255 }),
  acquisitionDate: timestamp("acquisitionDate"),
  acquisitionCost: decimal("acquisitionCost", { precision: 15, scale: 2 }),
  currentValue: decimal("currentValue", { precision: 15, scale: 2 }),
  depreciationRate: decimal("depreciationRate", { precision: 5, scale: 2 }),
  warrantyExpiry: timestamp("warrantyExpiry"),
  location: varchar("location", { length: 255 }),
  assignedTo: int("assignedTo"),
  imageUrl: text("imageUrl"),
  notes: text("notes"),
  qrCode: text("qrCode"),
  barcode: varchar("barcode", { length: 255 }),
  barcodeFormat: varchar("barcodeFormat", { length: 50 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  
  // Depreciation fields
  depreciationMethod: varchar("depreciationMethod", { length: 50 }), // 'straight-line', 'declining-balance', 'none'
  usefulLifeYears: int("usefulLifeYears"), // Expected useful life in years
  residualValue: decimal("residualValue", { precision: 12, scale: 2 }), // Salvage value at end of life
  depreciationStartDate: timestamp("depreciationStartDate"), // When depreciation starts
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Work Orders
 */
export const workOrders = mysqlTable("workOrders", {
  id: int("id").autoincrement().primaryKey(),
  workOrderNumber: varchar("workOrderNumber", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assetId: int("assetId").notNull(),
  siteId: int("siteId").notNull(),
  type: mysqlEnum("type", ["corrective", "preventive", "inspection", "emergency"]).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  status: mysqlEnum("status", ["pending", "assigned", "in_progress", "on_hold", "completed", "cancelled"]).default("pending").notNull(),
  assignedTo: int("assignedTo"),
  requestedBy: int("requestedBy").notNull(),
  scheduledStart: timestamp("scheduledStart"),
  scheduledEnd: timestamp("scheduledEnd"),
  actualStart: timestamp("actualStart"),
  actualEnd: timestamp("actualEnd"),
  estimatedCost: decimal("estimatedCost", { precision: 15, scale: 2 }),
  actualCost: decimal("actualCost", { precision: 15, scale: 2 }),
  completionNotes: text("completionNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Preventive Maintenance Schedules
 */
export const maintenanceSchedules = mysqlTable("maintenanceSchedules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  assetId: int("assetId").notNull(),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]).notNull(),
  frequencyValue: int("frequencyValue").default(1).notNull(),
  lastPerformed: timestamp("lastPerformed"),
  nextDue: timestamp("nextDue").notNull(),
  assignedTo: int("assignedTo"),
  isActive: boolean("isActive").default(true).notNull(),
  taskTemplate: text("taskTemplate"),
  estimatedDuration: int("estimatedDuration"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Inventory Items (spare parts and supplies)
 */
export const inventoryItems = mysqlTable("inventoryItems", {
  id: int("id").autoincrement().primaryKey(),
  itemCode: varchar("itemCode", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  siteId: int("siteId").notNull(),
  currentStock: int("currentStock").default(0).notNull(),
  minStockLevel: int("minStockLevel").default(0).notNull(),
  reorderPoint: int("reorderPoint").default(0).notNull(),
  maxStockLevel: int("maxStockLevel"),
  unitOfMeasure: varchar("unitOfMeasure", { length: 50 }),
  unitCost: decimal("unitCost", { precision: 15, scale: 2 }),
  vendorId: int("vendorId"),
  location: varchar("location", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Inventory Transactions
 */
export const inventoryTransactions = mysqlTable("inventoryTransactions", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  type: mysqlEnum("type", ["in", "out", "adjustment", "transfer"]).notNull(),
  quantity: int("quantity").notNull(),
  workOrderId: int("workOrderId"),
  fromSiteId: int("fromSiteId"),
  toSiteId: int("toSiteId"),
  unitCost: decimal("unitCost", { precision: 15, scale: 2 }),
  totalCost: decimal("totalCost", { precision: 15, scale: 2 }),
  performedBy: int("performedBy").notNull(),
  notes: text("notes"),
  transactionDate: timestamp("transactionDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Vendors
 */
export const vendors = mysqlTable("vendors", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  vendorCode: varchar("vendorCode", { length: 100 }).unique(),
  contactPerson: varchar("contactPerson", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  website: varchar("website", { length: 255 }),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Financial Transactions
 */
export const financialTransactions = mysqlTable("financialTransactions", {
  id: int("id").autoincrement().primaryKey(),
  transactionType: mysqlEnum("transactionType", ["acquisition", "maintenance", "repair", "disposal", "depreciation", "revenue", "other"]).notNull(),
  assetId: int("assetId"),
  workOrderId: int("workOrderId"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("NGN").notNull(),
  description: text("description"),
  transactionDate: timestamp("transactionDate").notNull(),
  vendorId: int("vendorId"),
  receiptNumber: varchar("receiptNumber", { length: 100 }),
  approvedBy: int("approvedBy"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Compliance Records
 */
export const complianceRecords = mysqlTable("complianceRecords", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId"),
  title: varchar("title", { length: 255 }).notNull(),
  regulatoryBody: varchar("regulatoryBody", { length: 255 }),
  requirementType: varchar("requirementType", { length: 100 }),
  description: text("description"),
  status: mysqlEnum("status", ["compliant", "non_compliant", "pending", "expired"]).default("pending").notNull(),
  dueDate: timestamp("dueDate"),
  completionDate: timestamp("completionDate"),
  nextReviewDate: timestamp("nextReviewDate"),
  assignedTo: int("assignedTo"),
  documentUrl: text("documentUrl"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Audit Trail for compliance and tracking
 */
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 100 }),
  entityId: int("entityId"),
  changes: text("changes"),
  ipAddress: varchar("ipAddress", { length: 50 }),
  userAgent: text("userAgent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

/**
 * Documents and Attachments
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileType: varchar("fileType", { length: 100 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  entityType: varchar("entityType", { length: 100 }),
  entityId: int("entityId"),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type InsertSite = typeof sites.$inferInsert;
export type AssetCategory = typeof assetCategories.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;
export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = typeof workOrders.$inferInsert;
export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect;
export type InsertMaintenanceSchedule = typeof maintenanceSchedules.$inferInsert;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;
export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type ComplianceRecord = typeof complianceRecords.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Document = typeof documents.$inferSelect;

/**
 * Notifications - In-app notification system
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "maintenance_due",
    "low_stock",
    "work_order_assigned",
    "work_order_completed",
    "asset_status_change",
    "compliance_due",
    "system_alert"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  relatedEntityType: varchar("relatedEntityType", { length: 50 }), // asset, workOrder, inventory, etc.
  relatedEntityId: int("relatedEntityId"),
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Notification Preferences - User notification settings
 */
export const notificationPreferences = mysqlTable("notificationPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  maintenanceDue: boolean("maintenanceDue").default(true).notNull(),
  lowStock: boolean("lowStock").default(true).notNull(),
  workOrderAssigned: boolean("workOrderAssigned").default(true).notNull(),
  workOrderCompleted: boolean("workOrderCompleted").default(true).notNull(),
  assetStatusChange: boolean("assetStatusChange").default(true).notNull(),
  complianceDue: boolean("complianceDue").default(true).notNull(),
  systemAlert: boolean("systemAlert").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;

/**
 * Asset Photos - Store photos for assets and work orders
 */
export const assetPhotos = mysqlTable("assetPhotos", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId"),
  workOrderId: int("workOrderId"),
  photoUrl: text("photoUrl").notNull(),
  photoKey: varchar("photoKey", { length: 500 }).notNull(),
  caption: text("caption"),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Scheduled Reports - Email report scheduling
 */
export const scheduledReports = mysqlTable("scheduledReports", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  reportType: mysqlEnum("reportType", [
    "assetInventory",
    "maintenanceSchedule",
    "workOrders",
    "financial",
    "compliance"
  ]).notNull(),
  format: mysqlEnum("format", ["pdf", "excel"]).notNull(),
  schedule: mysqlEnum("schedule", ["daily", "weekly", "monthly"]).notNull(),
  dayOfWeek: int("dayOfWeek"), // 0-6 for weekly
  dayOfMonth: int("dayOfMonth"), // 1-31 for monthly
  time: varchar("time", { length: 5 }).notNull(), // HH:MM format
  recipients: text("recipients").notNull(), // Comma-separated email addresses
  filters: text("filters"), // JSON string of filter options
  isActive: boolean("isActive").default(true).notNull(),
  lastRun: timestamp("lastRun"),
  nextRun: timestamp("nextRun"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AssetPhoto = typeof assetPhotos.$inferSelect;
export type InsertAssetPhoto = typeof assetPhotos.$inferInsert;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type InsertScheduledReport = typeof scheduledReports.$inferInsert;


/**
 * Asset Transfer Requests
 */
export const assetTransfers = mysqlTable("assetTransfers", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  fromSiteId: int("fromSiteId").notNull(),
  toSiteId: int("toSiteId").notNull(),
  requestedBy: int("requestedBy").notNull(),
  approvedBy: int("approvedBy"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "in_transit", "completed", "cancelled"]).default("pending").notNull(),
  requestDate: timestamp("requestDate").defaultNow().notNull(),
  approvalDate: timestamp("approvalDate"),
  transferDate: timestamp("transferDate"),
  completionDate: timestamp("completionDate"),
  reason: text("reason"),
  notes: text("notes"),
  handoverChecklist: text("handoverChecklist"), // JSON string
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AssetTransfer = typeof assetTransfers.$inferSelect;
export type InsertAssetTransfer = typeof assetTransfers.$inferInsert;


/**
 * Work Order Templates - Reusable templates for common maintenance tasks
 */
export const workOrderTemplates = mysqlTable("workOrderTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["corrective", "preventive", "inspection", "emergency"]).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  estimatedDuration: int("estimatedDuration"), // in minutes
  checklistItems: text("checklistItems"), // JSON string of checklist items
  instructions: text("instructions"),
  categoryId: int("categoryId"), // Optional: link to asset category
  createdBy: int("createdBy").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkOrderTemplate = typeof workOrderTemplates.$inferSelect;
export type InsertWorkOrderTemplate = typeof workOrderTemplates.$inferInsert;


/**
 * QuickBooks Integration Configuration
 */
export const quickbooksConfig = mysqlTable("quickbooksConfig", {
  id: int("id").autoincrement().primaryKey(),
  clientId: varchar("clientId", { length: 255 }).notNull(),
  clientSecret: varchar("clientSecret", { length: 255 }).notNull(),
  redirectUri: varchar("redirectUri", { length: 500 }).notNull(),
  realmId: varchar("realmId", { length: 255 }).notNull(), // Company ID
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  isActive: int("isActive").default(1).notNull(), // 1 = active, 0 = inactive
  lastSyncAt: timestamp("lastSyncAt"),
  autoSync: int("autoSync").default(1).notNull(), // 1 = enabled, 0 = disabled
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuickBooksConfig = typeof quickbooksConfig.$inferSelect;
export type InsertQuickBooksConfig = typeof quickbooksConfig.$inferInsert;

/**
 * User Preferences for UI state
 */
export const userPreferences = mysqlTable("userPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  sidebarWidth: int("sidebarWidth").default(280),
  sidebarCollapsed: int("sidebarCollapsed").default(0), // 0 = expanded, 1 = collapsed
  dashboardWidgets: text("dashboardWidgets"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InsertUserPreferences = typeof userPreferences.$inferInsert;

/**
 * Email Notification History
 */
// Magic Link Authentication
export const authTokens = mysqlTable("auth_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  type: mysqlEnum("type", ["magic_link", "signup_verification"]).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuthToken = typeof authTokens.$inferSelect;
export type InsertAuthToken = typeof authTokens.$inferInsert;

export const pendingUsers = mysqlTable("pending_users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  requestedRole: mysqlEnum("requested_role", ["user", "manager"]).notNull().default("user"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  approvedBy: int("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PendingUser = typeof pendingUsers.$inferSelect;
export type InsertPendingUser = typeof pendingUsers.$inferInsert;

export const emailTemplates = mysqlTable("email_templates", {
  id: int("id").autoincrement().primaryKey(),
  templateType: varchar("template_type", { length: 50 }).notNull(), // 'magic_link', 'welcome', 'approval'
  subject: varchar("subject", { length: 255 }).notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const emailNotifications = mysqlTable("emailNotifications", {
  id: int("id").autoincrement().primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  recipientType: varchar("recipientType", { length: 50 }).notNull(), // 'all', 'individual', 'role'
  recipientIds: text("recipientIds"), // JSON array of user IDs if individual
  recipientRole: varchar("recipientRole", { length: 50 }), // 'admin', 'manager', 'user' if by role
  sentBy: int("sentBy").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  status: varchar("status", { length: 50 }).default("sent").notNull(), // 'sent', 'failed'
  recipientCount: int("recipientCount").default(0),
});

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = typeof emailNotifications.$inferInsert;
