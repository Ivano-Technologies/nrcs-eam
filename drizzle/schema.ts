import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  bigint,
  pgEnum,
  uuid,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "manager",
  "technician",
  "user",
]);

export const assetStatusEnum = pgEnum("asset_status", [
  "operational",
  "maintenance",
  "repair",
  "retired",
  "disposed",
]);

export const workOrderTypeEnum = pgEnum("work_order_type", [
  "corrective",
  "preventive",
  "inspection",
  "emergency",
]);

export const workOrderPriorityEnum = pgEnum("work_order_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "pending",
  "assigned",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
]);

export const maintenanceFrequencyEnum = pgEnum("maintenance_frequency", [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
]);

export const inventoryTxTypeEnum = pgEnum("inventory_tx_type", [
  "in",
  "out",
  "adjustment",
  "transfer",
]);

export const financialTxTypeEnum = pgEnum("financial_tx_type", [
  "acquisition",
  "maintenance",
  "repair",
  "disposal",
  "depreciation",
  "revenue",
  "other",
]);

export const complianceStatusEnum = pgEnum("compliance_status", [
  "compliant",
  "non_compliant",
  "pending",
  "expired",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "maintenance_due",
  "low_stock",
  "work_order_assigned",
  "work_order_completed",
  "asset_status_change",
  "compliance_due",
  "system_alert",
]);

export const scheduledReportTypeEnum = pgEnum("scheduled_report_type", [
  "assetInventory",
  "maintenanceSchedule",
  "workOrders",
  "financial",
  "compliance",
]);

export const reportFormatEnum = pgEnum("report_format", ["pdf", "excel"]);

export const reportScheduleEnum = pgEnum("report_schedule", [
  "daily",
  "weekly",
  "monthly",
]);

export const assetTransferStatusEnum = pgEnum("asset_transfer_status", [
  "pending",
  "approved",
  "rejected",
  "in_transit",
  "completed",
  "cancelled",
]);

export const pendingRequestedRoleEnum = pgEnum("pending_requested_role", [
  "user",
  "manager",
]);

export const pendingUserStatusEnum = pgEnum("pending_user_status", [
  "pending",
  "approved",
  "rejected",
]);

/**
 * Core user table backing auth flow with extended roles for EAM system
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  siteId: integer("siteId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { mode: "date" }).defaultNow().notNull(),
  hasCompletedOnboarding: boolean("has_completed_onboarding")
    .default(false)
    .notNull(),
  /** Supabase Auth user id (`auth.users.id`). */
  authUserId: uuid("auth_user_id").unique(),
});

/** System-wide key/value settings (e.g. openRegistration). */
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

/**
 * Sites/Locations for multi-site management
 */
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
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
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Asset Categories (e.g., Machinery, Buildings, Vehicles, Equipment)
 */
export const assetCategories = pgTable("assetCategories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Assets - Core asset inventory
 */
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  assetTag: varchar("assetTag", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: integer("categoryId").notNull(),
  siteId: integer("siteId").notNull(),
  status: assetStatusEnum("status").default("operational").notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  serialNumber: varchar("serialNumber", { length: 255 }),
  acquisitionDate: timestamp("acquisitionDate", { mode: "date" }),
  acquisitionCost: decimal("acquisitionCost", { precision: 15, scale: 2 }),
  currentValue: decimal("currentValue", { precision: 15, scale: 2 }),
  depreciationRate: decimal("depreciationRate", { precision: 5, scale: 2 }),
  warrantyExpiry: timestamp("warrantyExpiry", { mode: "date" }),
  location: varchar("location", { length: 255 }),
  assignedTo: integer("assignedTo"),
  imageUrl: text("imageUrl"),
  notes: text("notes"),
  qrCode: text("qrCode"),
  barcode: varchar("barcode", { length: 255 }),
  barcodeFormat: varchar("barcodeFormat", { length: 50 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),

  depreciationMethod: varchar("depreciationMethod", { length: 50 }),
  usefulLifeYears: integer("usefulLifeYears"),
  residualValue: decimal("residualValue", { precision: 12, scale: 2 }),
  depreciationStartDate: timestamp("depreciationStartDate", { mode: "date" }),

  /** Asset Register (NRCS) — item vs inventory */
  itemType: varchar("itemType", { length: 20 }).default("asset").notNull(),
  subCategory: varchar("subCategory", { length: 255 }),
  acquisitionMethod: varchar("acquisitionMethod", { length: 100 }),
  projectRef: varchar("projectRef", { length: 255 }),
  /** New / Used at acquisition */
  acquisitionCondition: varchar("acquisitionCondition", { length: 50 }),
  department: varchar("department", { length: 255 }),
  lastCheckedAt: timestamp("lastCheckedAt", { mode: "date" }),
  checkedBy: varchar("checkedBy", { length: 255 }),
  /** Good / Fair / Damaged / Beyond Repair */
  physicalCondition: varchar("physicalCondition", { length: 50 }),
  /**
   * Register display status (In Use, In Store, …). Kept separate from legacy `status` enum.
   */
  registerStatus: varchar("registerStatus", { length: 50 }).default("in_use").notNull(),
  /** Display name when not linked to users.id */
  assignedToName: varchar("assignedToName", { length: 255 }),
  currentDepreciatedValue: doublePrecision("currentDepreciatedValue"),

  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Work Orders
 */
export const workOrders = pgTable("workOrders", {
  id: serial("id").primaryKey(),
  workOrderNumber: varchar("workOrderNumber", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assetId: integer("assetId").notNull(),
  siteId: integer("siteId").notNull(),
  type: workOrderTypeEnum("type").notNull(),
  priority: workOrderPriorityEnum("priority").default("medium").notNull(),
  status: workOrderStatusEnum("status").default("pending").notNull(),
  assignedTo: integer("assignedTo"),
  requestedBy: integer("requestedBy").notNull(),
  scheduledStart: timestamp("scheduledStart", { mode: "date" }),
  scheduledEnd: timestamp("scheduledEnd", { mode: "date" }),
  actualStart: timestamp("actualStart", { mode: "date" }),
  actualEnd: timestamp("actualEnd", { mode: "date" }),
  estimatedCost: decimal("estimatedCost", { precision: 15, scale: 2 }),
  actualCost: decimal("actualCost", { precision: 15, scale: 2 }),
  completionNotes: text("completionNotes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Preventive Maintenance Schedules
 */
export const maintenanceSchedules = pgTable("maintenanceSchedules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  assetId: integer("assetId").notNull(),
  frequency: maintenanceFrequencyEnum("frequency").notNull(),
  frequencyValue: integer("frequencyValue").default(1).notNull(),
  lastPerformed: timestamp("lastPerformed", { mode: "date" }),
  nextDue: timestamp("nextDue", { mode: "date" }).notNull(),
  assignedTo: integer("assignedTo"),
  isActive: boolean("isActive").default(true).notNull(),
  taskTemplate: text("taskTemplate"),
  estimatedDuration: integer("estimatedDuration"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Inventory Items (spare parts and supplies)
 */
export const inventoryItems = pgTable("inventoryItems", {
  id: serial("id").primaryKey(),
  itemCode: varchar("itemCode", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  siteId: integer("siteId").notNull(),
  currentStock: integer("currentStock").default(0).notNull(),
  minStockLevel: integer("minStockLevel").default(0).notNull(),
  reorderPoint: integer("reorderPoint").default(0).notNull(),
  maxStockLevel: integer("maxStockLevel"),
  unitOfMeasure: varchar("unitOfMeasure", { length: 50 }),
  unitCost: decimal("unitCost", { precision: 15, scale: 2 }),
  vendorId: integer("vendorId"),
  location: varchar("location", { length: 255 }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Inventory Transactions
 */
export const inventoryTransactions = pgTable("inventoryTransactions", {
  id: serial("id").primaryKey(),
  itemId: integer("itemId").notNull(),
  type: inventoryTxTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(),
  workOrderId: integer("workOrderId"),
  fromSiteId: integer("fromSiteId"),
  toSiteId: integer("toSiteId"),
  unitCost: decimal("unitCost", { precision: 15, scale: 2 }),
  totalCost: decimal("totalCost", { precision: 15, scale: 2 }),
  performedBy: integer("performedBy").notNull(),
  notes: text("notes"),
  transactionDate: timestamp("transactionDate", { mode: "date" }).defaultNow().notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Vendors
 */
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
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
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Financial Transactions
 */
export const financialTransactions = pgTable("financialTransactions", {
  id: serial("id").primaryKey(),
  transactionType: financialTxTypeEnum("transactionType").notNull(),
  assetId: integer("assetId"),
  workOrderId: integer("workOrderId"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("NGN").notNull(),
  description: text("description"),
  transactionDate: timestamp("transactionDate", { mode: "date" }).notNull(),
  vendorId: integer("vendorId"),
  receiptNumber: varchar("receiptNumber", { length: 100 }),
  approvedBy: integer("approvedBy"),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Compliance Records
 */
export const complianceRecords = pgTable("complianceRecords", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId"),
  title: varchar("title", { length: 255 }).notNull(),
  regulatoryBody: varchar("regulatoryBody", { length: 255 }),
  requirementType: varchar("requirementType", { length: 100 }),
  description: text("description"),
  status: complianceStatusEnum("status").default("pending").notNull(),
  dueDate: timestamp("dueDate", { mode: "date" }),
  completionDate: timestamp("completionDate", { mode: "date" }),
  nextReviewDate: timestamp("nextReviewDate", { mode: "date" }),
  assignedTo: integer("assignedTo"),
  documentUrl: text("documentUrl"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Audit Trail for compliance and tracking
 */
export const auditLogs = pgTable("auditLogs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 100 }),
  entityId: integer("entityId"),
  changes: text("changes"),
  ipAddress: varchar("ipAddress", { length: 50 }),
  userAgent: text("userAgent"),
  timestamp: timestamp("timestamp", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Documents and Attachments
 */
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileType: varchar("fileType", { length: 100 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  entityType: varchar("entityType", { length: 100 }),
  entityId: integer("entityId"),
  uploadedBy: integer("uploadedBy").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
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
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  relatedEntityType: varchar("relatedEntityType", { length: 50 }),
  relatedEntityId: integer("relatedEntityId"),
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Notification Preferences - User notification settings
 */
export const notificationPreferences = pgTable("notificationPreferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  maintenanceDue: boolean("maintenanceDue").default(true).notNull(),
  lowStock: boolean("lowStock").default(true).notNull(),
  workOrderAssigned: boolean("workOrderAssigned").default(true).notNull(),
  workOrderCompleted: boolean("workOrderCompleted").default(true).notNull(),
  assetStatusChange: boolean("assetStatusChange").default(true).notNull(),
  complianceDue: boolean("complianceDue").default(true).notNull(),
  systemAlert: boolean("systemAlert").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences =
  typeof notificationPreferences.$inferInsert;

/**
 * Asset Photos - Store photos for assets and work orders
 */
export const assetPhotos = pgTable("assetPhotos", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId"),
  workOrderId: integer("workOrderId"),
  photoUrl: text("photoUrl").notNull(),
  photoKey: varchar("photoKey", { length: 500 }).notNull(),
  caption: text("caption"),
  uploadedBy: integer("uploadedBy").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Scheduled Reports - Email report scheduling
 */
export const scheduledReports = pgTable("scheduledReports", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  reportType: scheduledReportTypeEnum("reportType").notNull(),
  format: reportFormatEnum("format").notNull(),
  schedule: reportScheduleEnum("schedule").notNull(),
  dayOfWeek: integer("dayOfWeek"),
  dayOfMonth: integer("dayOfMonth"),
  time: varchar("time", { length: 5 }).notNull(),
  recipients: text("recipients").notNull(),
  filters: text("filters"),
  isActive: boolean("isActive").default(true).notNull(),
  lastRun: timestamp("lastRun", { mode: "date" }),
  nextRun: timestamp("nextRun", { mode: "date" }),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type AssetPhoto = typeof assetPhotos.$inferSelect;
export type InsertAssetPhoto = typeof assetPhotos.$inferInsert;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type InsertScheduledReport = typeof scheduledReports.$inferInsert;

/**
 * Asset Transfer Requests
 */
export const assetTransfers = pgTable("assetTransfers", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId").notNull(),
  fromSiteId: integer("fromSiteId").notNull(),
  toSiteId: integer("toSiteId").notNull(),
  requestedBy: integer("requestedBy").notNull(),
  approvedBy: integer("approvedBy"),
  status: assetTransferStatusEnum("status").default("pending").notNull(),
  requestDate: timestamp("requestDate", { mode: "date" }).defaultNow().notNull(),
  approvalDate: timestamp("approvalDate", { mode: "date" }),
  transferDate: timestamp("transferDate", { mode: "date" }),
  completionDate: timestamp("completionDate", { mode: "date" }),
  reason: text("reason"),
  notes: text("notes"),
  handoverChecklist: text("handoverChecklist"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type AssetTransfer = typeof assetTransfers.$inferSelect;
export type InsertAssetTransfer = typeof assetTransfers.$inferInsert;

/**
 * Work Order Templates - Reusable templates for common maintenance tasks
 */
export const workOrderTemplates = pgTable("workOrderTemplates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: workOrderTypeEnum("type").notNull(),
  priority: workOrderPriorityEnum("priority").default("medium").notNull(),
  estimatedDuration: integer("estimatedDuration"),
  checklistItems: text("checklistItems"),
  instructions: text("instructions"),
  categoryId: integer("categoryId"),
  createdBy: integer("createdBy").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type WorkOrderTemplate = typeof workOrderTemplates.$inferSelect;
export type InsertWorkOrderTemplate = typeof workOrderTemplates.$inferInsert;

/**
 * QuickBooks Integration Configuration
 */
export const quickbooksConfig = pgTable("quickbooksConfig", {
  id: serial("id").primaryKey(),
  clientId: varchar("clientId", { length: 255 }).notNull(),
  clientSecret: varchar("clientSecret", { length: 255 }).notNull(),
  redirectUri: varchar("redirectUri", { length: 500 }).notNull(),
  realmId: varchar("realmId", { length: 255 }).notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt", { mode: "date" }),
  isActive: integer("isActive").default(1).notNull(),
  lastSyncAt: timestamp("lastSyncAt", { mode: "date" }),
  autoSync: integer("autoSync").default(1).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type QuickBooksConfig = typeof quickbooksConfig.$inferSelect;
export type InsertQuickBooksConfig = typeof quickbooksConfig.$inferInsert;

/**
 * User Preferences for UI state
 */
export const userPreferences = pgTable("userPreferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  sidebarWidth: integer("sidebarWidth").default(280),
  sidebarCollapsed: integer("sidebarCollapsed").default(0),
  dashboardWidgets: text("dashboardWidgets"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export type InsertUserPreferences = typeof userPreferences.$inferInsert;

/**
 * Email Notification History
 */
// Magic Link Authentication
export const pendingUsers = pgTable("pending_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  designation: varchar("designation", { length: 255 }),
  department: varchar("department", { length: 255 }),
  requestedRole: pendingRequestedRoleEnum("requested_role")
    .notNull()
    .default("user"),
  status: pendingUserStatusEnum("status").notNull().default("pending"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { mode: "date" }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type PendingUser = typeof pendingUsers.$inferSelect;
export type InsertPendingUser = typeof pendingUsers.$inferInsert;

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  templateType: varchar("template_type", { length: 50 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const emailNotifications = pgTable("email_notifications", {
  id: serial("id").primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  recipientType: varchar("recipientType", { length: 50 }).notNull(),
  recipientIds: text("recipientIds"),
  recipientRole: varchar("recipientRole", { length: 50 }),
  sentBy: integer("sentBy").notNull(),
  sentAt: timestamp("sentAt", { mode: "date" }).defaultNow().notNull(),
  status: varchar("status", { length: 50 }).default("sent").notNull(),
  recipientCount: integer("recipientCount").default(0),
});

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = typeof emailNotifications.$inferInsert;
