CREATE TABLE `quickbooksConfig` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` varchar(255) NOT NULL,
	`clientSecret` varchar(255) NOT NULL,
	`redirectUri` varchar(500) NOT NULL,
	`realmId` varchar(255) NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` timestamp,
	`isActive` int NOT NULL DEFAULT 1,
	`lastSyncAt` timestamp,
	`autoSync` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quickbooksConfig_id` PRIMARY KEY(`id`)
);
