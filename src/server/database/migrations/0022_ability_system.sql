-- Ability system: categories, skills, milestones, completions, states, snapshots, activity logs

CREATE TABLE `ability_categories` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `icon` text,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ability_categories_name_unique` ON `ability_categories` (`name`);
--> statement-breakpoint

CREATE TABLE `skills` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `category_id` integer NOT NULL REFERENCES `ability_categories`(`id`),
  `name` text NOT NULL,
  `description` text,
  `icon` text,
  `source` text NOT NULL,
  `template_id` text,
  `current_tier` integer NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'active',
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skills_category` ON `skills` (`category_id`);
--> statement-breakpoint
CREATE INDEX `idx_skills_status` ON `skills` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_skills_template` ON `skills` (`template_id`);
--> statement-breakpoint

CREATE TABLE `milestones` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `skill_id` integer NOT NULL REFERENCES `skills`(`id`) ON DELETE CASCADE,
  `tier` integer NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `milestone_type` text NOT NULL,
  `verify_method` text NOT NULL,
  `verify_config` text,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_milestones_skill` ON `milestones` (`skill_id`);
--> statement-breakpoint
CREATE INDEX `idx_milestones_skill_tier` ON `milestones` (`skill_id`, `tier`);
--> statement-breakpoint

CREATE TABLE `milestone_completions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `milestone_id` integer NOT NULL REFERENCES `milestones`(`id`) ON DELETE CASCADE,
  `verify_method` text NOT NULL,
  `evidence_url` text,
  `evidence_note` text,
  `verified_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_milestone_completions_milestone` ON `milestone_completions` (`milestone_id`);
--> statement-breakpoint

CREATE TABLE `skill_current_state` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `skill_id` integer NOT NULL REFERENCES `skills`(`id`) ON DELETE CASCADE,
  `state_key` text NOT NULL,
  `state_value` text NOT NULL,
  `state_label` text NOT NULL,
  `source` text NOT NULL,
  `confirmed_at` integer NOT NULL,
  `expires_after_days` integer NOT NULL DEFAULT 180,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skill_state_skill` ON `skill_current_state` (`skill_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skill_state_skill_key` ON `skill_current_state` (`skill_id`, `state_key`);
--> statement-breakpoint

CREATE TABLE `skill_snapshots` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `date` text NOT NULL,
  `radar_data` text NOT NULL,
  `skill_data` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skill_snapshots_date` ON `skill_snapshots` (`date`);
--> statement-breakpoint

CREATE TABLE `activity_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `skill_id` integer REFERENCES `skills`(`id`) ON DELETE SET NULL,
  `category_id` integer REFERENCES `ability_categories`(`id`) ON DELETE SET NULL,
  `source` text NOT NULL,
  `source_ref` text,
  `description` text NOT NULL,
  `date` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_skill` ON `activity_logs` (`skill_id`);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_date` ON `activity_logs` (`date`);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_source` ON `activity_logs` (`source`);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_category` ON `activity_logs` (`category_id`);
