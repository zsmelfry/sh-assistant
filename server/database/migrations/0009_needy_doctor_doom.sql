CREATE TABLE `sm_chats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`point_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`point_id`) REFERENCES `sm_points`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sm_chats_point` ON `sm_chats` (`point_id`);--> statement-breakpoint
CREATE INDEX `idx_sm_chats_created_at` ON `sm_chats` (`created_at`);--> statement-breakpoint
CREATE TABLE `sm_domains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sm_domains_sort` ON `sm_domains` (`sort_order`);--> statement-breakpoint
CREATE TABLE `sm_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'not_started' NOT NULL,
	`status_updated_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `sm_topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sm_points_topic` ON `sm_points` (`topic_id`);--> statement-breakpoint
CREATE INDEX `idx_sm_points_status` ON `sm_points` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sm_points_sort` ON `sm_points` (`topic_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `sm_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`target_market` text,
	`target_customer` text,
	`production_source` text,
	`current_stage` text DEFAULT 'ideation',
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sm_teachings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`point_id` integer NOT NULL,
	`what` text,
	`how` text,
	`example` text,
	`apply` text,
	`resources` text,
	`product_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`point_id`) REFERENCES `sm_points`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `sm_products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sm_teachings_point` ON `sm_teachings` (`point_id`);--> statement-breakpoint
CREATE TABLE `sm_topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `sm_domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sm_topics_domain` ON `sm_topics` (`domain_id`);--> statement-breakpoint
CREATE INDEX `idx_sm_topics_sort` ON `sm_topics` (`domain_id`,`sort_order`);