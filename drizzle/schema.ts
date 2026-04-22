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
  json,
  unique,
  date,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { FACILITY_TYPE_VALUES } from "../shared/facilities";
import { ITEM_CATEGORY_VALUES } from "../shared/itemCategory";

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "staff",
  "manager",
  "admin",
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
  "critical_stock",
  "expiry_warning_90",
  "expiry_warning_60",
  "expiry_warning_30",
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

export const facilityTypeEnum = pgEnum("facility_type", [...FACILITY_TYPE_VALUES]);

export const itemCategoryEnum = pgEnum("item_category", [...ITEM_CATEGORY_VALUES]);

/** WMS — donor classification (IFRC supply chain + synthetic system donors). */
export const donorTypeEnum = pgEnum("donor_type", [
  "national_society",
  "multilateral",
  "corporate",
  "government",
  "individual",
  "synthetic",
]);

/** WMS — transport on GRN / waybill. */
export const wmsMeansOfTransportEnum = pgEnum("wms_means_of_transport", [
  "road",
  "rail",
  "air",
  "sea",
  "handcarried",
]);

export const grnStatusEnum = pgEnum("grn_status", ["draft", "finalized", "claim_raised"]);

export const waybillDocTypeEnum = pgEnum("waybill_doc_type", ["waybill", "delivery_note"]);

export const waybillStatusEnum = pgEnum("waybill_status", [
  "draft",
  "dispatched",
  "received",
  "claim_raised",
]);

/**
 * WMS ledger source — sole quantity ledger per Decision 1 (inventory-ledger-architecture.md).
 * Legacy `inventory_movements` writers migrate through Phases 2–6; enum extended in migration 0014.
 */
export const wmsStockMovementSourceEnum = pgEnum("wms_stock_movement_source", [
  "grn",
  "waybill",
  "stock_check",
  "adjustment",
  "import",
  "transfer_in",
  "transfer_out",
  "kit_assembly",
  "kit_disassembly",
  "expiry",
]);

export const ctnRegistryStatusEnum = pgEnum("ctn_registry_status", ["active", "locked", "depleted"]);

export const wmsDocTypeEnum = pgEnum("wms_doc_type", ["grn", "waybill"]);

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
  /** Public URL for profile photo (e.g. from app upload or external HTTPS URL). */
  avatarUrl: text("avatar_url"),
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
 * Sites (facilities) — table name `sites` kept for stable migrations / FKs.
 */
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 8 }).unique(),
  name: varchar("name", { length: 255 }).notNull(),
  facilityType: facilityTypeEnum("facilityType").default("branch").notNull(),
  parentFacilityId: integer("parentFacilityId").references((): AnyPgColumn => sites.id, {
    onDelete: "set null",
  }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Nigeria"),
  contactPerson: varchar("contactPerson", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  postalCode: varchar("postalCode", { length: 32 }),
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

export const inventoryCatalogue = pgTable("inventory_catalogue", {
  id: serial("id").primaryKey(),
  itemCode: varchar("item_code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  /** Humanitarian item taxonomy (distinct from IFRC `category`). */
  itemCategory: itemCategoryEnum("item_category").notNull().default("other"),
  subcategory: varchar("subcategory", { length: 100 }),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }).notNull(),
  vedClassification: varchar("ved_classification", { length: 20 }),
  unitWeightKg: doublePrecision("unit_weight_kg"),
  packSize: integer("pack_size"),
  packUnit: varchar("pack_unit", { length: 50 }),
  hasExpiry: boolean("has_expiry").default(false),
  coldChainRequired: boolean("cold_chain_required").default(false),
  photoUrl: varchar("photo_url", { length: 500 }),
  standardSuppliers: json("standard_suppliers"),
  ifrcItemCode: varchar("ifrc_item_code", { length: 50 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const inventoryStock = pgTable(
  "inventory_stock",
  {
    id: serial("id").primaryKey(),
    catalogueId: integer("catalogue_id")
      .notNull()
      .references(() => inventoryCatalogue.id),
    warehouseId: integer("warehouse_id")
      .notNull()
      .references(() => sites.id),
    zoneLocation: varchar("zone_location", { length: 100 }),
    quantityOnHand: doublePrecision("quantity_on_hand").default(0).notNull(),
    quantityReserved: doublePrecision("quantity_reserved").default(0),
    quantityInTransit: doublePrecision("quantity_in_transit").default(0),
    minLevel: doublePrecision("min_level").default(0),
    maxLevel: doublePrecision("max_level"),
    safetyStockLevel: doublePrecision("safety_stock_level"),
    lastCountedAt: timestamp("last_counted_at", { mode: "date" }),
    lastMovementAt: timestamp("last_movement_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    inventoryStockCatalogueWarehouseUnique: unique("inventory_stock_catalogue_warehouse_unique").on(
      table.catalogueId,
      table.warehouseId
    ),
    warehouseItemIdx: index("inv_stock_warehouse_item_idx").on(table.catalogueId, table.warehouseId),
  })
);

export const inventoryBatches = pgTable(
  "inventory_batches",
  {
    id: serial("id").primaryKey(),
    stockId: integer("stock_id")
      .notNull()
      .references(() => inventoryStock.id),
    batchNumber: varchar("batch_number", { length: 100 }),
    expiryDate: date("expiry_date"),
    manufactureDate: date("manufacture_date"),
    quantity: doublePrecision("quantity").notNull(),
    supplierName: varchar("supplier_name", { length: 255 }),
    receivedDate: timestamp("received_date", { mode: "date" }).defaultNow(),
    notes: text("notes"),
    status: varchar("status", { length: 50 }).default("active"),
  },
  (table) => ({
    activeExpiryIdx: index("inv_batch_active_expiry_idx").on(table.expiryDate),
  })
);

export const inventoryDocuments = pgTable("inventory_documents", {
  id: serial("id").primaryKey(),
  documentType: varchar("document_type", { length: 50 }).notNull(),
  documentNumber: varchar("document_number", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 50 }).default("draft"),
  fromWarehouseId: integer("from_warehouse_id").references(() => sites.id),
  toWarehouseId: integer("to_warehouse_id").references(() => sites.id),
  items: json("items"),
  referenceDocument: varchar("reference_document", { length: 255 }),
  transportDetails: json("transport_details"),
  attachments: json("attachments"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  approvedAt: timestamp("approved_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
});

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: serial("id").primaryKey(),
    movementType: varchar("movement_type", { length: 50 }).notNull(),
    catalogueId: integer("catalogue_id")
      .notNull()
      .references(() => inventoryCatalogue.id),
    stockId: integer("stock_id").references(() => inventoryStock.id),
    batchId: integer("batch_id").references(() => inventoryBatches.id),
    fromWarehouseId: integer("from_warehouse_id").references(() => sites.id),
    toWarehouseId: integer("to_warehouse_id").references(() => sites.id),
    quantityChange: doublePrecision("quantity_change").notNull(),
    balanceAfter: doublePrecision("balance_after").notNull(),
    documentType: varchar("document_type", { length: 50 }),
    documentId: integer("document_id"),
    documentNumber: varchar("document_number", { length: 100 }),
    performedBy: integer("performed_by").references(() => users.id),
    approvedBy: integer("approved_by").references(() => users.id),
    reason: varchar("reason", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    catalogueCreatedIdx: index("inv_mov_catalogue_created_idx").on(table.catalogueId, table.createdAt),
    warehouseCreatedIdx: index("inv_mov_warehouse_created_idx").on(table.fromWarehouseId, table.createdAt),
  })
);

export const inventoryCounts = pgTable("inventory_counts", {
  id: serial("id").primaryKey(),
  countNumber: varchar("count_number", { length: 100 }).notNull().unique(),
  countType: varchar("count_type", { length: 50 }).notNull(),
  warehouseId: integer("warehouse_id")
    .notNull()
    .references(() => sites.id),
  status: varchar("status", { length: 50 }).default("draft"),
  scope: json("scope"),
  plannedStartDate: date("planned_start_date"),
  actualStartedAt: timestamp("actual_started_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  conductedBy: integer("conducted_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  notes: text("notes"),
  varianceCount: integer("variance_count"),
  totalItemsCounted: integer("total_items_counted"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const inventoryCountLines = pgTable("inventory_count_lines", {
  id: serial("id").primaryKey(),
  countId: integer("count_id")
    .notNull()
    .references(() => inventoryCounts.id),
  stockId: integer("stock_id")
    .notNull()
    .references(() => inventoryStock.id),
  expectedQuantity: doublePrecision("expected_quantity"),
  actualQuantity: doublePrecision("actual_quantity"),
  varianceQuantity: doublePrecision("variance_quantity"),
  variancePercent: doublePrecision("variance_percent"),
  varianceReason: varchar("variance_reason", { length: 255 }),
  varianceNotes: text("variance_notes"),
  countedBy: integer("counted_by").references(() => users.id),
  countedAt: timestamp("counted_at", { mode: "date" }),
});

/**
 * WMS — humanitarian donors (IFRC partners). Seeded with common NS / multilateral codes.
 */
export const donors = pgTable(
  "donors",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    type: donorTypeEnum("type").notNull(),
    country: varchar("country", { length: 100 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    donorTypeIdx: index("donors_type_idx").on(table.type),
  })
);

/**
 * WMS — Commodity Tracking Number: one row per consignment of a catalogue item.
 */
export const commodityTrackingNumbers = pgTable(
  "commodity_tracking_numbers",
  {
    id: serial("id").primaryKey(),
    ctnCode: varchar("ctn_code", { length: 64 }).notNull().unique(),
    donorId: integer("donor_id")
      .notNull()
      .references(() => donors.id),
    itemId: integer("item_id")
      .notNull()
      .references(() => inventoryCatalogue.id),
    receivedDate: date("received_date"),
    expiryDate: date("expiry_date"),
    unit: varchar("unit", { length: 50 }).notNull(),
    originalQuantity: doublePrecision("original_quantity").notNull(),
    notes: text("notes"),
    status: ctnRegistryStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    ctnDonorIdx: index("ctn_donor_idx").on(table.donorId),
    ctnItemIdx: index("ctn_item_idx").on(table.itemId),
    ctnExpiryIdx: index("ctn_expiry_idx").on(table.expiryDate),
  })
);

export const goodsReceivedNotes = pgTable(
  "goods_received_notes",
  {
    id: serial("id").primaryKey(),
    grnNumber: varchar("grn_number", { length: 100 }).notNull().unique(),
    consignmentNumber: varchar("consignment_number", { length: 100 }),
    delegationLocationId: integer("delegation_location_id")
      .notNull()
      .references(() => sites.id),
    receivedFrom: varchar("received_from", { length: 500 }).notNull(),
    dateOfArrival: date("date_of_arrival").notNull(),
    documentWellReceived: boolean("document_well_received").default(true),
    incompleteDocumentsNotes: text("incomplete_documents_notes"),
    meansOfTransport: wmsMeansOfTransportEnum("means_of_transport"),
    awbNumber: varchar("awb_number", { length: 100 }),
    waybillCmrNumber: varchar("waybill_cmr_number", { length: 100 }),
    blNumber: varchar("bl_number", { length: 100 }),
    flightNumber: varchar("flight_number", { length: 100 }),
    registrationNumber: varchar("registration_number", { length: 100 }),
    vesselName: varchar("vessel_name", { length: 255 }),
    deliveredByName: varchar("delivered_by_name", { length: 255 }),
    deliveredByFunction: varchar("delivered_by_function", { length: 255 }),
    deliveredByDate: date("delivered_by_date"),
    deliveredBySignatureUrl: text("delivered_by_signature_url"),
    receivedByName: varchar("received_by_name", { length: 255 }),
    receivedByFunction: varchar("received_by_function", { length: 255 }),
    receivedByDate: date("received_by_date"),
    receivedBySignatureUrl: text("received_by_signature_url"),
    comments: text("comments"),
    status: grnStatusEnum("status").notNull().default("draft"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    grnDelegationDateIdx: index("grn_delegation_date_idx").on(
      table.delegationLocationId,
      table.dateOfArrival
    ),
  })
);

export const goodsReceivedNoteLines = pgTable("goods_received_note_lines", {
  id: serial("id").primaryKey(),
  grnId: integer("grn_id")
    .notNull()
    .references(() => goodsReceivedNotes.id, { onDelete: "cascade" }),
  consignmentNumber: varchar("consignment_number", { length: 100 }),
  description: text("description").notNull(),
  ctnOrDonor: varchar("ctn_or_donor", { length: 255 }),
  ctnId: integer("ctn_id").references(() => commodityTrackingNumbers.id),
  nbOfUnits: doublePrecision("nb_of_units").notNull(),
  unitType: varchar("unit_type", { length: 50 }).notNull(),
  weightKg: doublePrecision("weight_kg"),
  receivedInGoodCondition: boolean("received_in_good_condition").default(true),
  claimNotes: text("claim_notes"),
  lineOrder: integer("line_order").default(0).notNull(),
});

export const requisitions = pgTable(
  "requisitions",
  {
    id: serial("id").primaryKey(),
    reqNumber: varchar("req_number", { length: 100 }).notNull().unique(),
    /** Logistics requisition number (WMS); may mirror req_number or be distinct. */
    lrNumber: varchar("lr_number", { length: 100 }).unique(),
    title: varchar("title", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).default("draft"),
    priority: varchar("priority", { length: 50 }).default("routine"),
    requestedBy: integer("requested_by")
      .notNull()
      .references(() => users.id),
    requestingFacility: integer("requesting_facility")
      .notNull()
      .references(() => sites.id),
    /** Requesting unit label (WMS logistics). */
    requestingUnit: varchar("requesting_unit", { length: 255 }),
    /** Purpose / narrative (WMS); complements justification. */
    purpose: text("purpose"),
    justification: text("justification").notNull(),
    incidentReference: varchar("incident_reference", { length: 255 }),
    affectedPopulation: integer("affected_population"),
    items: json("items"),
    suggestedWarehouseId: integer("suggested_warehouse_id").references(() => sites.id),
    authorizedBy: integer("authorized_by").references(() => users.id),
    dateAuthorized: timestamp("date_authorized", { mode: "date" }),
    approvedBranchBy: integer("approved_branch_by").references(() => users.id),
    approvedBranchAt: timestamp("approved_branch_at", { mode: "date" }),
    approvedHqBy: integer("approved_hq_by").references(() => users.id),
    approvedHqAt: timestamp("approved_hq_at", { mode: "date" }),
    rejectedBy: integer("rejected_by").references(() => users.id),
    rejectionReason: text("rejection_reason"),
    fulfilledAt: timestamp("fulfilled_at", { mode: "date" }),
    linkedWaybills: json("linked_waybills"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    statusPriorityIdx: index("req_status_priority_idx").on(table.status, table.priority),
  })
);

export const waybills = pgTable(
  "waybills",
  {
    id: serial("id").primaryKey(),
    wbNumber: varchar("wb_number", { length: 100 }).notNull().unique(),
    docType: waybillDocTypeEnum("doc_type").notNull(),
    countryCode: varchar("country_code", { length: 8 }),
    date: date("date").notNull(),
    warehouseId: integer("warehouse_id")
      .notNull()
      .references(() => sites.id),
    destinationType: varchar("destination_type", { length: 50 }).default("other").notNull(),
    destinationBeneficiary: text("destination_beneficiary").notNull(),
    destinationLocation: text("destination_location"),
    transportContractRef: varchar("transport_contract_ref", { length: 255 }),
    vehicle1: varchar("vehicle_1", { length: 255 }),
    vehicle2: varchar("vehicle_2", { length: 255 }),
    registration1: varchar("registration_1", { length: 100 }),
    registration2: varchar("registration_2", { length: 100 }),
    meansOfTransport: wmsMeansOfTransportEnum("means_of_transport"),
    etd: timestamp("etd", { mode: "date" }),
    loadedByName: varchar("loaded_by_name", { length: 255 }),
    loadedByDate: date("loaded_by_date"),
    loadedByFunction: varchar("loaded_by_function", { length: 255 }),
    loadedBySignatureUrl: text("loaded_by_signature_url"),
    transportedByName: varchar("transported_by_name", { length: 255 }),
    transportedByDate: date("transported_by_date"),
    transportedByFunction: varchar("transported_by_function", { length: 255 }),
    transportedBySignatureUrl: text("transported_by_signature_url"),
    receivedByName: varchar("received_by_name", { length: 255 }),
    receivedByDate: date("received_by_date"),
    receivedByFunction: varchar("received_by_function", { length: 255 }),
    receivedBySignatureUrl: text("received_by_signature_url"),
    receivedAtLocation: varchar("received_at_location", { length: 500 }),
    receivedCondition: text("received_condition"),
    comments: text("comments"),
    commentsFromReceiver: text("comments_from_receiver"),
    requisitionId: integer("requisition_id").references(() => requisitions.id),
    status: waybillStatusEnum("status").notNull().default("draft"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    waybillWarehouseDateIdx: index("waybill_warehouse_date_idx").on(table.warehouseId, table.date),
  })
);

export const waybillLines = pgTable("waybill_lines", {
  id: serial("id").primaryKey(),
  waybillId: integer("waybill_id")
    .notNull()
    .references(() => waybills.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => inventoryCatalogue.id),
  itemDescription: text("item_description").notNull(),
  ctnId: integer("ctn_id")
    .notNull()
    .references(() => commodityTrackingNumbers.id),
  nbOfUnits: doublePrecision("nb_of_units").notNull(),
  unitType: varchar("unit_type", { length: 50 }).notNull(),
  weightKg: doublePrecision("weight_kg"),
  volumeM3: doublePrecision("volume_m3"),
  requisitionLineId: varchar("requisition_line_id", { length: 64 }),
  remarks: text("remarks"),
  lineOrder: integer("line_order").default(0).notNull(),
});

export const waybillLineCtnSources = pgTable(
  "waybill_line_ctn_sources",
  {
    id: serial("id").primaryKey(),
    waybillLineId: integer("waybill_line_id")
      .notNull()
      .references(() => waybillLines.id, { onDelete: "cascade" }),
    ctnId: integer("ctn_id")
      .notNull()
      .references(() => commodityTrackingNumbers.id),
    quantity: doublePrecision("quantity").notNull(),
    overrideByUserId: integer("override_by_user_id").references(() => users.id),
    overrideAt: timestamp("override_at", { mode: "date" }),
    overrideReason: text("override_reason"),
    sourceOrder: integer("source_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    lineSourceIdx: index("waybill_line_ctn_sources_line_idx").on(table.waybillLineId),
    ctnSourceIdx: index("waybill_line_ctn_sources_ctn_idx").on(table.ctnId),
  })
);

/**
 * WMS — one stock card per CTN per stock location (facility).
 */
export const stockCards = pgTable(
  "stock_cards",
  {
    id: serial("id").primaryKey(),
    ctnId: integer("ctn_id")
      .notNull()
      .references(() => commodityTrackingNumbers.id),
    locationId: integer("location_id")
      .notNull()
      .references(() => sites.id),
    description: text("description"),
    itemCode: varchar("item_code", { length: 50 }),
    measureUnit: varchar("measure_unit", { length: 50 }),
    expiryDate: date("expiry_date"),
    stockMinimum: doublePrecision("stock_minimum"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    stockCardCtnLocationUnique: unique("stock_card_ctn_location_unique").on(table.ctnId, table.locationId),
    stockCardLocationIdx: index("stock_card_location_idx").on(table.locationId),
  })
);

export const binCardStatusEnum = pgEnum("bin_card_status", ["open", "closed"]);

export const binCards = pgTable(
  "bin_cards",
  {
    id: serial("id").primaryKey(),
    stockCardId: integer("stock_card_id")
      .notNull()
      .references(() => stockCards.id, { onDelete: "cascade" }),
    binNumber: varchar("bin_number", { length: 64 }).notNull(),
    stockLocation: varchar("stock_location", { length: 255 }),
    itemCode: varchar("item_code", { length: 50 }),
    itemDescription: text("item_description"),
    commodityTrackingNumber: varchar("commodity_tracking_number", { length: 64 }),
    donorCode: varchar("donor_code", { length: 32 }),
    unit: varchar("unit", { length: 50 }),
    expiryDate: date("expiry_date"),
    openedAt: timestamp("opened_at", { mode: "date" }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { mode: "date" }),
    status: binCardStatusEnum("status").notNull().default("open"),
  },
  (table) => ({
    binStockCardNumberUnique: unique("bin_stock_card_number_unique").on(table.stockCardId, table.binNumber),
  })
);

/**
 * WMS physical ledger rows. See module comment: separate from `inventory_movements`.
 */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    stockCardId: integer("stock_card_id")
      .notNull()
      .references(() => stockCards.id, { onDelete: "cascade" }),
    binCardId: integer("bin_card_id").references(() => binCards.id),
    date: date("date").notNull(),
    documentRef: varchar("document_ref", { length: 100 }),
    fromTo: varchar("from_to", { length: 500 }),
    quantityIn: doublePrecision("quantity_in").default(0).notNull(),
    quantityOut: doublePrecision("quantity_out").default(0).notNull(),
    balanceAfter: doublePrecision("balance_after").notNull(),
    remarks: text("remarks"),
    storekeeperInitials: varchar("storekeeper_initials", { length: 32 }),
    signatureUrl: text("signature_url"),
    sourceType: wmsStockMovementSourceEnum("source_type").notNull(),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    stockMovementsCardDateIdx: index("stock_movements_card_date_idx").on(table.stockCardId, table.date),
  })
);

/**
 * WMS — per kit CTN, which component CTNs (and donors) contributed at assembly.
 * See Decision 4 (inventory-ledger-architecture.md). `assembly_event_id` points to
 * the `stock_movements` row that recorded that component consumption (typically `quantity_out`, `kit_assembly`).
 */
export const kitCtnContributors = pgTable(
  "kit_ctn_contributors",
  {
    id: serial("id").primaryKey(),
    kitCtnId: integer("kit_ctn_id")
      .notNull()
      .references(() => commodityTrackingNumbers.id),
    componentCtnId: integer("component_ctn_id")
      .notNull()
      .references(() => commodityTrackingNumbers.id),
    componentDonorId: integer("component_donor_id")
      .notNull()
      .references(() => donors.id),
    quantityConsumed: doublePrecision("quantity_consumed").notNull(),
    assemblyEventId: integer("assembly_event_id")
      .notNull()
      .references(() => stockMovements.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    kitCtnIdx: index("kit_ctn_contributors_kit_ctn_idx").on(table.kitCtnId),
    componentCtnIdx: index("kit_ctn_contributors_component_ctn_idx").on(table.componentCtnId),
    assemblyEventIdx: index("kit_ctn_contributors_assembly_event_idx").on(table.assemblyEventId),
    componentDonorIdx: index("kit_ctn_contributors_component_donor_idx").on(table.componentDonorId),
  })
);

/** Prenumbered GRN / waybill series per facility (Phase 2 numbering UX). */
export const documentNumberSequences = pgTable(
  "document_number_sequences",
  {
    id: serial("id").primaryKey(),
    facilityId: integer("facility_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    docType: wmsDocTypeEnum("doc_type").notNull(),
    year: integer("year").notNull(),
    prefix: varchar("prefix", { length: 32 }).notNull(),
    lastSeq: integer("last_seq").notNull().default(0),
  },
  (table) => ({
    docSeqUnique: unique("document_number_sequences_unique").on(
      table.facilityId,
      table.docType,
      table.year
    ),
  })
);

export const distributions = pgTable("distributions", {
  id: serial("id").primaryKey(),
  distributionNumber: varchar("distribution_number", { length: 100 }).notNull().unique(),
  waybillId: integer("waybill_id").references(() => inventoryDocuments.id),
  incidentReference: varchar("incident_reference", { length: 255 }),
  distributionDate: date("distribution_date").notNull(),
  location: varchar("location", { length: 500 }).notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationType: varchar("location_type", { length: 100 }),
  beneficiaryCount: integer("beneficiary_count"),
  householdCount: integer("household_count"),
  maleCount: integer("male_count"),
  femaleCount: integer("female_count"),
  childrenCount: integer("children_count"),
  elderlyCount: integer("elderly_count"),
  pwdCount: integer("pwd_count"),
  itemsDistributed: json("items_distributed"),
  conductedBy: integer("conducted_by").references(() => users.id),
  teamMembers: json("team_members"),
  observers: text("observers"),
  photos: json("photos"),
  beneficiaryList: json("beneficiary_list"),
  notes: text("notes"),
  challenges: text("challenges"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const inventoryKits = pgTable("inventory_kits", {
  id: serial("id").primaryKey(),
  kitCode: varchar("kit_code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  kitType: varchar("kit_type", { length: 100 }),
  catalogueId: integer("catalogue_id").references(() => inventoryCatalogue.id),
  components: json("components").notNull(),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const kitAssemblies = pgTable("kit_assemblies", {
  id: serial("id").primaryKey(),
  kitId: integer("kit_id")
    .notNull()
    .references(() => inventoryKits.id),
  warehouseId: integer("warehouse_id")
    .notNull()
    .references(() => sites.id),
  direction: varchar("direction", { length: 20 }).notNull(),
  quantity: integer("quantity").notNull(),
  performedBy: integer("performed_by").references(() => users.id),
  performedAt: timestamp("performed_at", { mode: "date" }).defaultNow(),
  notes: text("notes"),
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
export type InventoryCatalogue = typeof inventoryCatalogue.$inferSelect;
export type InsertInventoryCatalogue = typeof inventoryCatalogue.$inferInsert;
export type InventoryStock = typeof inventoryStock.$inferSelect;
export type InsertInventoryStock = typeof inventoryStock.$inferInsert;
export type InventoryBatch = typeof inventoryBatches.$inferSelect;
export type InsertInventoryBatch = typeof inventoryBatches.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = typeof inventoryMovements.$inferInsert;
export type InventoryDocument = typeof inventoryDocuments.$inferSelect;
export type InsertInventoryDocument = typeof inventoryDocuments.$inferInsert;
export type InventoryCount = typeof inventoryCounts.$inferSelect;
export type InsertInventoryCount = typeof inventoryCounts.$inferInsert;
export type InventoryCountLine = typeof inventoryCountLines.$inferSelect;
export type InsertInventoryCountLine = typeof inventoryCountLines.$inferInsert;
export type Requisition = typeof requisitions.$inferSelect;
export type InsertRequisition = typeof requisitions.$inferInsert;
export type Donor = typeof donors.$inferSelect;
export type InsertDonor = typeof donors.$inferInsert;
export type CommodityTrackingNumber = typeof commodityTrackingNumbers.$inferSelect;
export type InsertCommodityTrackingNumber = typeof commodityTrackingNumbers.$inferInsert;
export type GoodsReceivedNote = typeof goodsReceivedNotes.$inferSelect;
export type GoodsReceivedNoteLine = typeof goodsReceivedNoteLines.$inferSelect;
export type Waybill = typeof waybills.$inferSelect;
export type WaybillLine = typeof waybillLines.$inferSelect;
export type WaybillLineCtnSource = typeof waybillLineCtnSources.$inferSelect;
export type StockCard = typeof stockCards.$inferSelect;
export type BinCard = typeof binCards.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = typeof stockMovements.$inferInsert;
export type KitCtnContributor = typeof kitCtnContributors.$inferSelect;
export type InsertKitCtnContributor = typeof kitCtnContributors.$inferInsert;
export type DocumentNumberSequence = typeof documentNumberSequences.$inferSelect;
export type Distribution = typeof distributions.$inferSelect;
export type InsertDistribution = typeof distributions.$inferInsert;
export type InventoryKit = typeof inventoryKits.$inferSelect;
export type InsertInventoryKit = typeof inventoryKits.$inferInsert;
export type KitAssembly = typeof kitAssemblies.$inferSelect;
export type InsertKitAssembly = typeof kitAssemblies.$inferInsert;
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
