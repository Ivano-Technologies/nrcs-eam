CREATE TABLE `email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_type` varchar(50) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`html_content` text NOT NULL,
	`text_content` text,
	`is_active` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`)
);
