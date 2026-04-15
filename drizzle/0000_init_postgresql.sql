CREATE TYPE "public"."asset_status" AS ENUM('operational', 'maintenance', 'repair', 'retired', 'disposed');--> statement-breakpoint
CREATE TYPE "public"."asset_transfer_status" AS ENUM('pending', 'approved', 'rejected', 'in_transit', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."auth_token_type" AS ENUM('magic_link', 'signup_verification');--> statement-breakpoint
CREATE TYPE "public"."compliance_status" AS ENUM('compliant', 'non_compliant', 'pending', 'expired');--> statement-breakpoint
CREATE TYPE "public"."financial_tx_type" AS ENUM('acquisition', 'maintenance', 'repair', 'disposal', 'depreciation', 'revenue', 'other');--> statement-breakpoint
CREATE TYPE "public"."inventory_tx_type" AS ENUM('in', 'out', 'adjustment', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."maintenance_frequency" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('maintenance_due', 'low_stock', 'work_order_assigned', 'work_order_completed', 'asset_status_change', 'compliance_due', 'system_alert');--> statement-breakpoint
CREATE TYPE "public"."pending_requested_role" AS ENUM('user', 'manager');--> statement-breakpoint
CREATE TYPE "public"."pending_user_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('pdf', 'excel');--> statement-breakpoint
CREATE TYPE "public"."report_schedule" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."scheduled_report_type" AS ENUM('assetInventory', 'maintenanceSchedule', 'workOrders', 'financial', 'compliance');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'technician', 'user');--> statement-breakpoint
CREATE TYPE "public"."work_order_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('pending', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."work_order_type" AS ENUM('corrective', 'preventive', 'inspection', 'emergency');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assetCategories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assetPhotos" (
	"id" serial PRIMARY KEY NOT NULL,
	"assetId" integer,
	"workOrderId" integer,
	"photoUrl" text NOT NULL,
	"photoKey" varchar(500) NOT NULL,
	"caption" text,
	"uploadedBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assetTransfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"assetId" integer NOT NULL,
	"fromSiteId" integer NOT NULL,
	"toSiteId" integer NOT NULL,
	"requestedBy" integer NOT NULL,
	"approvedBy" integer,
	"status" "asset_transfer_status" DEFAULT 'pending' NOT NULL,
	"requestDate" timestamp DEFAULT now() NOT NULL,
	"approvalDate" timestamp,
	"transferDate" timestamp,
	"completionDate" timestamp,
	"reason" text,
	"notes" text,
	"handoverChecklist" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"assetTag" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"categoryId" integer NOT NULL,
	"siteId" integer NOT NULL,
	"status" "asset_status" DEFAULT 'operational' NOT NULL,
	"manufacturer" varchar(255),
	"model" varchar(255),
	"serialNumber" varchar(255),
	"acquisitionDate" timestamp,
	"acquisitionCost" numeric(15, 2),
	"currentValue" numeric(15, 2),
	"depreciationRate" numeric(5, 2),
	"warrantyExpiry" timestamp,
	"location" varchar(255),
	"assignedTo" integer,
	"imageUrl" text,
	"notes" text,
	"qrCode" text,
	"barcode" varchar(255),
	"barcodeFormat" varchar(50),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"depreciationMethod" varchar(50),
	"usefulLifeYears" integer,
	"residualValue" numeric(12, 2),
	"depreciationStartDate" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assets_assetTag_unique" UNIQUE("assetTag")
);
--> statement-breakpoint
CREATE TABLE "auditLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"entityType" varchar(100),
	"entityId" integer,
	"changes" text,
	"ipAddress" varchar(50),
	"userAgent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"token" varchar(255) NOT NULL,
	"type" "auth_token_type" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "complianceRecords" (
	"id" serial PRIMARY KEY NOT NULL,
	"assetId" integer,
	"title" varchar(255) NOT NULL,
	"regulatoryBody" varchar(255),
	"requirementType" varchar(100),
	"description" text,
	"status" "compliance_status" DEFAULT 'pending' NOT NULL,
	"dueDate" timestamp,
	"completionDate" timestamp,
	"nextReviewDate" timestamp,
	"assignedTo" integer,
	"documentUrl" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"fileUrl" text NOT NULL,
	"fileKey" varchar(500) NOT NULL,
	"fileType" varchar(100),
	"fileSize" bigint,
	"entityType" varchar(100),
	"entityId" integer,
	"uploadedBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"recipientType" varchar(50) NOT NULL,
	"recipientIds" text,
	"recipientRole" varchar(50),
	"sentBy" integer NOT NULL,
	"sentAt" timestamp DEFAULT now() NOT NULL,
	"status" varchar(50) DEFAULT 'sent' NOT NULL,
	"recipientCount" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_type" varchar(50) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financialTransactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transactionType" "financial_tx_type" NOT NULL,
	"assetId" integer,
	"workOrderId" integer,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"description" text,
	"transactionDate" timestamp NOT NULL,
	"vendorId" integer,
	"receiptNumber" varchar(100),
	"approvedBy" integer,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventoryItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"itemCode" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"siteId" integer NOT NULL,
	"currentStock" integer DEFAULT 0 NOT NULL,
	"minStockLevel" integer DEFAULT 0 NOT NULL,
	"reorderPoint" integer DEFAULT 0 NOT NULL,
	"maxStockLevel" integer,
	"unitOfMeasure" varchar(50),
	"unitCost" numeric(15, 2),
	"vendorId" integer,
	"location" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventoryItems_itemCode_unique" UNIQUE("itemCode")
);
--> statement-breakpoint
CREATE TABLE "inventoryTransactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"itemId" integer NOT NULL,
	"type" "inventory_tx_type" NOT NULL,
	"quantity" integer NOT NULL,
	"workOrderId" integer,
	"fromSiteId" integer,
	"toSiteId" integer,
	"unitCost" numeric(15, 2),
	"totalCost" numeric(15, 2),
	"performedBy" integer NOT NULL,
	"notes" text,
	"transactionDate" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenanceSchedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"assetId" integer NOT NULL,
	"frequency" "maintenance_frequency" NOT NULL,
	"frequencyValue" integer DEFAULT 1 NOT NULL,
	"lastPerformed" timestamp,
	"nextDue" timestamp NOT NULL,
	"assignedTo" integer,
	"isActive" boolean DEFAULT true NOT NULL,
	"taskTemplate" text,
	"estimatedDuration" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificationPreferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"maintenanceDue" boolean DEFAULT true NOT NULL,
	"lowStock" boolean DEFAULT true NOT NULL,
	"workOrderAssigned" boolean DEFAULT true NOT NULL,
	"workOrderCompleted" boolean DEFAULT true NOT NULL,
	"assetStatusChange" boolean DEFAULT true NOT NULL,
	"complianceDue" boolean DEFAULT true NOT NULL,
	"systemAlert" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notificationPreferences_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"relatedEntityType" varchar(50),
	"relatedEntityId" integer,
	"isRead" boolean DEFAULT false NOT NULL,
	"readAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(255) NOT NULL,
	"designation" varchar(255),
	"department" varchar(255),
	"requested_role" "pending_requested_role" DEFAULT 'user' NOT NULL,
	"status" "pending_user_status" DEFAULT 'pending' NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pending_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "quickbooksConfig" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" varchar(255) NOT NULL,
	"clientSecret" varchar(255) NOT NULL,
	"redirectUri" varchar(500) NOT NULL,
	"realmId" varchar(255) NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"tokenExpiresAt" timestamp,
	"isActive" integer DEFAULT 1 NOT NULL,
	"lastSyncAt" timestamp,
	"autoSync" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduledReports" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"reportType" "scheduled_report_type" NOT NULL,
	"format" "report_format" NOT NULL,
	"schedule" "report_schedule" NOT NULL,
	"dayOfWeek" integer,
	"dayOfMonth" integer,
	"time" varchar(5) NOT NULL,
	"recipients" text NOT NULL,
	"filters" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastRun" timestamp,
	"nextRun" timestamp,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100) DEFAULT 'Nigeria',
	"contactPerson" varchar(255),
	"contactPhone" varchar(50),
	"contactEmail" varchar(320),
	"isActive" boolean DEFAULT true NOT NULL,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userPreferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"sidebarWidth" integer DEFAULT 280,
	"sidebarCollapsed" integer DEFAULT 0,
	"dashboardWidgets" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userPreferences_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"siteId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	"has_completed_onboarding" boolean DEFAULT false NOT NULL,
	"password_hash" varchar(255),
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"vendorCode" varchar(100),
	"contactPerson" varchar(255),
	"email" varchar(320),
	"phone" varchar(50),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100),
	"website" varchar(255),
	"notes" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_vendorCode_unique" UNIQUE("vendorCode")
);
--> statement-breakpoint
CREATE TABLE "workOrderTemplates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "work_order_type" NOT NULL,
	"priority" "work_order_priority" DEFAULT 'medium' NOT NULL,
	"estimatedDuration" integer,
	"checklistItems" text,
	"instructions" text,
	"categoryId" integer,
	"createdBy" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workOrders" (
	"id" serial PRIMARY KEY NOT NULL,
	"workOrderNumber" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"assetId" integer NOT NULL,
	"siteId" integer NOT NULL,
	"type" "work_order_type" NOT NULL,
	"priority" "work_order_priority" DEFAULT 'medium' NOT NULL,
	"status" "work_order_status" DEFAULT 'pending' NOT NULL,
	"assignedTo" integer,
	"requestedBy" integer NOT NULL,
	"scheduledStart" timestamp,
	"scheduledEnd" timestamp,
	"actualStart" timestamp,
	"actualEnd" timestamp,
	"estimatedCost" numeric(15, 2),
	"actualCost" numeric(15, 2),
	"completionNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workOrders_workOrderNumber_unique" UNIQUE("workOrderNumber")
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_users" ADD CONSTRAINT "pending_users_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;