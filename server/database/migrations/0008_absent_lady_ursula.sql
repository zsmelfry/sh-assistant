ALTER TABLE `articles` ADD `last_read_at` integer;--> statement-breakpoint
CREATE INDEX `idx_articles_last_read_at` ON `articles` (`last_read_at`);