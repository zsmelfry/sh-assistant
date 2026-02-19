CREATE TABLE `planner_checkitems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal_id` integer NOT NULL,
	`content` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `planner_goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_planner_checkitems_goal` ON `planner_checkitems` (`goal_id`);--> statement-breakpoint
CREATE INDEX `idx_planner_checkitems_sort` ON `planner_checkitems` (`goal_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_planner_checkitems_completed_at` ON `planner_checkitems` (`completed_at`);--> statement-breakpoint
CREATE TABLE `planner_domains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_planner_domains_sort` ON `planner_domains` (`sort_order`);--> statement-breakpoint
CREATE TABLE `planner_goal_tags` (
	`goal_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `planner_goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `planner_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_planner_goal_tags_pk` ON `planner_goal_tags` (`goal_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_planner_goal_tags_tag` ON `planner_goal_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `planner_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `planner_domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_planner_goals_domain` ON `planner_goals` (`domain_id`);--> statement-breakpoint
CREATE INDEX `idx_planner_goals_sort` ON `planner_goals` (`domain_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `planner_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_planner_tags_name` ON `planner_tags` (`name`);