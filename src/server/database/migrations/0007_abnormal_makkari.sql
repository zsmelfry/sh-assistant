CREATE TABLE `article_chats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_article_chats_article_id` ON `article_chats` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_article_chats_created_at` ON `article_chats` (`created_at`);--> statement-breakpoint
CREATE TABLE `article_tag_map` (
	`article_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`article_id`, `tag_id`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `article_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `article_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_article_tags_name` ON `article_tags` (`name`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_article_translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`provider_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `llm_providers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_article_translations`("id", "article_id", "type", "content", "provider_id", "created_at") SELECT "id", "article_id", "type", "content", "provider_id", "created_at" FROM `article_translations`;--> statement-breakpoint
DROP TABLE `article_translations`;--> statement-breakpoint
ALTER TABLE `__new_article_translations` RENAME TO `article_translations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_article_translations_article_type` ON `article_translations` (`article_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_article_translations_article_id` ON `article_translations` (`article_id`);