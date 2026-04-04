CREATE TABLE `assetPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int,
	`workOrderId` int,
	`photoUrl` text NOT NULL,
	`photoKey` varchar(500) NOT NULL,
	`caption` text,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assetPhotos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduledReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`reportType` enum('assetInventory','maintenanceSchedule','workOrders','financial','compliance') NOT NULL,
	`format` enum('pdf','excel') NOT NULL,
	`schedule` enum('daily','weekly','monthly') NOT NULL,
	`dayOfWeek` int,
	`dayOfMonth` int,
	`time` varchar(5) NOT NULL,
	`recipients` text NOT NULL,
	`filters` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastRun` timestamp,
	`nextRun` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduledReports_id` PRIMARY KEY(`id`)
);
