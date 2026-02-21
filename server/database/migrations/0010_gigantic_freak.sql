CREATE TABLE `sm_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`point_id` integer,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`point_id`) REFERENCES `sm_points`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_sm_activities_date` ON `sm_activities` (`date`);--> statement-breakpoint
CREATE INDEX `idx_sm_activities_point` ON `sm_activities` (`point_id`);--> statement-breakpoint
CREATE TABLE `sm_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`point_id` integer NOT NULL,
	`product_id` integer,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`point_id`) REFERENCES `sm_points`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `sm_products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sm_notes_point_product` ON `sm_notes` (`point_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `sm_point_articles` (
	`point_id` integer NOT NULL,
	`article_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`point_id`, `article_id`),
	FOREIGN KEY (`point_id`) REFERENCES `sm_points`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sm_stage_points` (
	`stage_id` integer NOT NULL,
	`point_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`stage_id`, `point_id`),
	FOREIGN KEY (`stage_id`) REFERENCES `sm_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`point_id`) REFERENCES `sm_points`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sm_stages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`objective` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sm_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`point_id` integer NOT NULL,
	`description` text NOT NULL,
	`expected_output` text,
	`hint` text,
	`is_completed` integer DEFAULT false NOT NULL,
	`completion_note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`point_id`) REFERENCES `sm_points`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sm_tasks_point` ON `sm_tasks` (`point_id`);