CREATE TABLE `notificationPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`maintenanceDue` boolean NOT NULL DEFAULT true,
	`lowStock` boolean NOT NULL DEFAULT true,
	`workOrderAssigned` boolean NOT NULL DEFAULT true,
	`workOrderCompleted` boolean NOT NULL DEFAULT true,
	`assetStatusChange` boolean NOT NULL DEFAULT true,
	`complianceDue` boolean NOT NULL DEFAULT true,
	`systemAlert` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notificationPreferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('maintenance_due','low_stock','work_order_assigned','work_order_completed','asset_status_change','compliance_due','system_alert') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`relatedEntityType` varchar(50),
	`relatedEntityId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
