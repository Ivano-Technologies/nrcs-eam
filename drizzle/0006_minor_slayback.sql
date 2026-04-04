CREATE TABLE `assetTransfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`fromSiteId` int NOT NULL,
	`toSiteId` int NOT NULL,
	`requestedBy` int NOT NULL,
	`approvedBy` int,
	`status` enum('pending','approved','rejected','in_transit','completed','cancelled') NOT NULL DEFAULT 'pending',
	`requestDate` timestamp NOT NULL DEFAULT (now()),
	`approvalDate` timestamp,
	`transferDate` timestamp,
	`completionDate` timestamp,
	`reason` text,
	`notes` text,
	`handoverChecklist` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assetTransfers_id` PRIMARY KEY(`id`)
);
