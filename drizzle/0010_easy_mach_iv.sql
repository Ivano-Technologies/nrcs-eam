CREATE TABLE `emailNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`recipientType` varchar(50) NOT NULL,
	`recipientIds` text,
	`recipientRole` varchar(50),
	`sentBy` int NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`status` varchar(50) NOT NULL DEFAULT 'sent',
	`recipientCount` int DEFAULT 0,
	CONSTRAINT `emailNotifications_id` PRIMARY KEY(`id`)
);
