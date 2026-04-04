CREATE TABLE `auth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`token` varchar(255) NOT NULL,
	`type` enum('magic_link','signup_verification') NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `email_notifications` (
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
	CONSTRAINT `email_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pending_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255) NOT NULL,
	`requested_role` enum('user','manager') NOT NULL DEFAULT 'user',
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`approved_by` int,
	`approved_at` timestamp,
	`rejection_reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pending_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `pending_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
DROP TABLE `emailNotifications`;--> statement-breakpoint
ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pending_users` ADD CONSTRAINT `pending_users_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;