CREATE TABLE `assetCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assetCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetTag` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`categoryId` int NOT NULL,
	`siteId` int NOT NULL,
	`status` enum('operational','maintenance','repair','retired','disposed') NOT NULL DEFAULT 'operational',
	`manufacturer` varchar(255),
	`model` varchar(255),
	`serialNumber` varchar(255),
	`acquisitionDate` timestamp,
	`acquisitionCost` decimal(15,2),
	`currentValue` decimal(15,2),
	`depreciationRate` decimal(5,2),
	`warrantyExpiry` timestamp,
	`location` varchar(255),
	`assignedTo` int,
	`imageUrl` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `assets_assetTag_unique` UNIQUE(`assetTag`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(100),
	`entityId` int,
	`changes` text,
	`ipAddress` varchar(50),
	`userAgent` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `complianceRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int,
	`title` varchar(255) NOT NULL,
	`regulatoryBody` varchar(255),
	`requirementType` varchar(100),
	`description` text,
	`status` enum('compliant','non_compliant','pending','expired') NOT NULL DEFAULT 'pending',
	`dueDate` timestamp,
	`completionDate` timestamp,
	`nextReviewDate` timestamp,
	`assignedTo` int,
	`documentUrl` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `complianceRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileType` varchar(100),
	`fileSize` bigint,
	`entityType` varchar(100),
	`entityId` int,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financialTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionType` enum('acquisition','maintenance','repair','disposal','depreciation','other') NOT NULL,
	`assetId` int,
	`workOrderId` int,
	`amount` decimal(15,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'NGN',
	`description` text,
	`transactionDate` timestamp NOT NULL,
	`vendorId` int,
	`receiptNumber` varchar(100),
	`approvedBy` int,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financialTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemCode` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100),
	`siteId` int NOT NULL,
	`currentStock` int NOT NULL DEFAULT 0,
	`minStockLevel` int NOT NULL DEFAULT 0,
	`reorderPoint` int NOT NULL DEFAULT 0,
	`maxStockLevel` int,
	`unitOfMeasure` varchar(50),
	`unitCost` decimal(15,2),
	`vendorId` int,
	`location` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryItems_itemCode_unique` UNIQUE(`itemCode`)
);
--> statement-breakpoint
CREATE TABLE `inventoryTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`type` enum('in','out','adjustment','transfer') NOT NULL,
	`quantity` int NOT NULL,
	`workOrderId` int,
	`fromSiteId` int,
	`toSiteId` int,
	`unitCost` decimal(15,2),
	`totalCost` decimal(15,2),
	`performedBy` int NOT NULL,
	`notes` text,
	`transactionDate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenanceSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`assetId` int NOT NULL,
	`frequency` enum('daily','weekly','monthly','quarterly','semi_annual','annual') NOT NULL,
	`frequencyValue` int NOT NULL DEFAULT 1,
	`lastPerformed` timestamp,
	`nextDue` timestamp NOT NULL,
	`assignedTo` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`taskTemplate` text,
	`estimatedDuration` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenanceSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`city` varchar(100),
	`state` varchar(100),
	`country` varchar(100) DEFAULT 'Nigeria',
	`contactPerson` varchar(255),
	`contactPhone` varchar(50),
	`contactEmail` varchar(320),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`vendorCode` varchar(100),
	`contactPerson` varchar(255),
	`email` varchar(320),
	`phone` varchar(50),
	`address` text,
	`city` varchar(100),
	`state` varchar(100),
	`country` varchar(100),
	`website` varchar(255),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendors_id` PRIMARY KEY(`id`),
	CONSTRAINT `vendors_vendorCode_unique` UNIQUE(`vendorCode`)
);
--> statement-breakpoint
CREATE TABLE `workOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workOrderNumber` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`assetId` int NOT NULL,
	`siteId` int NOT NULL,
	`type` enum('corrective','preventive','inspection','emergency') NOT NULL,
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('pending','assigned','in_progress','on_hold','completed','cancelled') NOT NULL DEFAULT 'pending',
	`assignedTo` int,
	`requestedBy` int NOT NULL,
	`scheduledStart` timestamp,
	`scheduledEnd` timestamp,
	`actualStart` timestamp,
	`actualEnd` timestamp,
	`estimatedCost` decimal(15,2),
	`actualCost` decimal(15,2),
	`completionNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `workOrders_workOrderNumber_unique` UNIQUE(`workOrderNumber`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','manager','technician','user') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `siteId` int;