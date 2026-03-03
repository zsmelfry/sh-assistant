CREATE TABLE `pt_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` integer NOT NULL,
	`type` text NOT NULL,
	`url` text,
	`file_path` text,
	`caption` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `pt_notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pt_attachments_note` ON `pt_attachments` (`note_id`);--> statement-breakpoint
CREATE TABLE `pt_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pt_categories_sort` ON `pt_categories` (`sort_order`);--> statement-breakpoint
CREATE TABLE `pt_chats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `pt_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pt_chats_project` ON `pt_chats` (`project_id`);--> statement-breakpoint
CREATE TABLE `pt_checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`content` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`due_date` text,
	`milestone_id` integer,
	`linked_note_id` integer,
	`linked_diagram_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `pt_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestone_id`) REFERENCES `pt_milestones`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_pt_checklist_project` ON `pt_checklist_items` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_pt_checklist_milestone` ON `pt_checklist_items` (`milestone_id`);--> statement-breakpoint
CREATE INDEX `idx_pt_checklist_sort` ON `pt_checklist_items` (`project_id`,`milestone_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `pt_diagrams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'flowchart' NOT NULL,
	`mermaid_code` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `pt_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pt_diagrams_project` ON `pt_diagrams` (`project_id`);--> statement-breakpoint
CREATE TABLE `pt_milestones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `pt_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pt_milestones_project` ON `pt_milestones` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_pt_milestones_sort` ON `pt_milestones` (`project_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `pt_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`ai_summary` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `pt_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pt_notes_project` ON `pt_notes` (`project_id`);--> statement-breakpoint
CREATE TABLE `pt_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`remind_type` text NOT NULL,
	`sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pt_notifications_unique` ON `pt_notifications` (`target_type`,`target_id`,`remind_type`);--> statement-breakpoint
CREATE TABLE `pt_project_tags` (
	`project_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `pt_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `pt_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pt_project_tags_pk` ON `pt_project_tags` (`project_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_pt_project_tags_tag` ON `pt_project_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `pt_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'idea' NOT NULL,
	`category_id` integer NOT NULL,
	`due_date` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`blocked_reason` text,
	`archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `pt_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pt_projects_category` ON `pt_projects` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_pt_projects_status` ON `pt_projects` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pt_projects_archived` ON `pt_projects` (`archived`);--> statement-breakpoint
CREATE INDEX `idx_pt_projects_sort` ON `pt_projects` (`sort_order`);--> statement-breakpoint
CREATE TABLE `pt_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pt_tags_name` ON `pt_tags` (`name`);