CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('domain','hosting','cloud','tools','marketing','other') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` enum('USD','EGP') NOT NULL,
	`note` varchar(255) NOT NULL,
	`occurredAt` bigint unsigned NOT NULL,
	`createdBy` enum('fares','youssef') NOT NULL,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `invoices_occurred_at_idx` ON `invoices` (`occurredAt`);