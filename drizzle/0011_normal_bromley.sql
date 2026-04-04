ALTER TABLE `assets` ADD `depreciationMethod` varchar(50);--> statement-breakpoint
ALTER TABLE `assets` ADD `usefulLifeYears` int;--> statement-breakpoint
ALTER TABLE `assets` ADD `residualValue` decimal(12,2);--> statement-breakpoint
ALTER TABLE `assets` ADD `depreciationStartDate` timestamp;