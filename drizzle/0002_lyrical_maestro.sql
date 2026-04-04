ALTER TABLE `assets` ADD `qrCode` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `latitude` decimal(10,8);--> statement-breakpoint
ALTER TABLE `assets` ADD `longitude` decimal(11,8);--> statement-breakpoint
ALTER TABLE `sites` ADD `latitude` decimal(10,8);--> statement-breakpoint
ALTER TABLE `sites` ADD `longitude` decimal(11,8);