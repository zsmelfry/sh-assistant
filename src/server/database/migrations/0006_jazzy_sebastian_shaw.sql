CREATE TABLE `article_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`notes` text,
	`bookmarked_at` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_article_bookmarks_article_id` ON `article_bookmarks` (`article_id`);--> statement-breakpoint
CREATE TABLE `article_translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`provider_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_article_translations_article_type` ON `article_translations` (`article_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_article_translations_article_id` ON `article_translations` (`article_id`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`site_name` text,
	`content` text NOT NULL,
	`excerpt` text,
	`published_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_articles_url` ON `articles` (`url`);--> statement-breakpoint
CREATE INDEX `idx_articles_created_at` ON `articles` (`created_at`);