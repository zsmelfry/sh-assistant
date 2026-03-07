-- Coach system: profile, conversations, memories, notifications, profile changes
-- Focus plans, badges, badge awards

CREATE TABLE `coach_profile` (
  `id` integer PRIMARY KEY DEFAULT 1,
  `content` text NOT NULL DEFAULT '',
  `current_focus` text NOT NULL DEFAULT '',
  `version` integer NOT NULL DEFAULT 0,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `coach_conversations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `context` text NOT NULL,
  `skill_id` integer REFERENCES `skills`(`id`) ON DELETE SET NULL,
  `messages` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_coach_conv_context` ON `coach_conversations` (`context`);
--> statement-breakpoint
CREATE INDEX `idx_coach_conv_skill` ON `coach_conversations` (`skill_id`);
--> statement-breakpoint
CREATE INDEX `idx_coach_conv_created` ON `coach_conversations` (`created_at`);
--> statement-breakpoint

CREATE TABLE `coach_memories` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `conversation_id` integer REFERENCES `coach_conversations`(`id`) ON DELETE CASCADE,
  `summary` text NOT NULL,
  `skill_tags` text NOT NULL DEFAULT '[]',
  `category_tags` text NOT NULL DEFAULT '[]',
  `memory_type` text NOT NULL,
  `importance` integer NOT NULL DEFAULT 3,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_coach_mem_type` ON `coach_memories` (`memory_type`);
--> statement-breakpoint
CREATE INDEX `idx_coach_mem_importance` ON `coach_memories` (`importance`);
--> statement-breakpoint
CREATE INDEX `idx_coach_mem_created` ON `coach_memories` (`created_at`);
--> statement-breakpoint

CREATE TABLE `coach_notifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `content` text NOT NULL,
  `priority` text NOT NULL DEFAULT 'medium',
  `skill_id` integer REFERENCES `skills`(`id`) ON DELETE SET NULL,
  `action_type` text,
  `action_url` text,
  `status` text NOT NULL DEFAULT 'pending',
  `scheduled_for` integer NOT NULL,
  `expires_at` integer,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_coach_notif_status` ON `coach_notifications` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_coach_notif_scheduled` ON `coach_notifications` (`scheduled_for`);
--> statement-breakpoint
CREATE INDEX `idx_coach_notif_type` ON `coach_notifications` (`type`);
--> statement-breakpoint

CREATE TABLE `coach_profile_changes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `field` text NOT NULL,
  `previous_value` text,
  `new_value` text,
  `reason` text NOT NULL,
  `source_conversation_id` integer REFERENCES `coach_conversations`(`id`) ON DELETE SET NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `focus_plans` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `skill_id` integer NOT NULL REFERENCES `skills`(`id`) ON DELETE CASCADE,
  `current_tier` integer NOT NULL,
  `target_tier` integer NOT NULL,
  `target_date` text NOT NULL,
  `strategy` text,
  `linked_habit_ids` text,
  `linked_planner_goal_ids` text,
  `linked_skill_learning_ids` text,
  `status` text NOT NULL DEFAULT 'active',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_focus_plans_status` ON `focus_plans` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_focus_plans_skill` ON `focus_plans` (`skill_id`);
--> statement-breakpoint

CREATE TABLE `badges` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `key` text NOT NULL,
  `name` text NOT NULL,
  `description` text NOT NULL,
  `icon` text,
  `rarity` text NOT NULL DEFAULT 'common',
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_badges_key` ON `badges` (`key`);
--> statement-breakpoint

CREATE TABLE `badge_awards` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `badge_id` integer NOT NULL REFERENCES `badges`(`id`) ON DELETE CASCADE,
  `skill_id` integer REFERENCES `skills`(`id`) ON DELETE SET NULL,
  `milestone_id` integer,
  `awarded_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_badge_awards_badge` ON `badge_awards` (`badge_id`);
--> statement-breakpoint
CREATE INDEX `idx_badge_awards_skill` ON `badge_awards` (`skill_id`);
