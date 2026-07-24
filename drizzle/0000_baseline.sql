CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`requestKey` varchar(64) NOT NULL,
	`clientHash` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`phone` varchar(24) NOT NULL,
	`clientEmail` varchar(320),
	`projectType` enum('company','portfolio','landing','other') NOT NULL,
	`budget` enum('700-1500','1500-3000','3000+') NOT NULL,
	`details` text NOT NULL,
	`status` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
	`emailStatus` enum('pending','sent','failed','not_configured') NOT NULL DEFAULT 'pending',
	`emailMessageId` varchar(128),
	`emailError` varchar(500),
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_publicId_unique` UNIQUE(`publicId`),
	CONSTRAINT `bookings_requestKey_unique` UNIQUE(`requestKey`)
);
--> statement-breakpoint
CREATE TABLE `ledgerEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('income','expense') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`note` varchar(255) NOT NULL,
	`occurredAt` bigint unsigned NOT NULL,
	`createdBy` enum('fares','youssef') NOT NULL,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `ledgerEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `bookings_created_at_idx` ON `bookings` (`createdAt`);--> statement-breakpoint
CREATE INDEX `bookings_client_created_at_idx` ON `bookings` (`clientHash`,`createdAt`);--> statement-breakpoint
CREATE INDEX `bookings_phone_created_at_idx` ON `bookings` (`phone`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ledger_occurred_at_idx` ON `ledgerEntries` (`occurredAt`);