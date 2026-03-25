CREATE TABLE `verification_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`type` text NOT NULL,
	`role` text,
	`modules` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_verification_tokens_hash` ON `verification_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_verification_tokens_email_type` ON `verification_tokens` (`email`,`type`);--> statement-breakpoint
CREATE INDEX `idx_verification_tokens_expires` ON `verification_tokens` (`expires_at`);