-- Add reminderAt column to projects, milestones, and checklist items
ALTER TABLE `pt_projects` ADD `reminder_at` integer;
--> statement-breakpoint
ALTER TABLE `pt_milestones` ADD `reminder_at` integer;
--> statement-breakpoint
ALTER TABLE `pt_checklist_items` ADD `reminder_at` integer;
--> statement-breakpoint
-- Recreate pt_notifications with reminderAt instead of remindType
CREATE TABLE `pt_notifications_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `target_type` text NOT NULL,
  `target_id` integer NOT NULL,
  `reminder_at` integer NOT NULL,
  `sent_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `pt_notifications_new` (`id`, `target_type`, `target_id`, `reminder_at`, `sent_at`)
  SELECT `id`, `target_type`, `target_id`, `sent_at`, `sent_at` FROM `pt_notifications`;
--> statement-breakpoint
DROP TABLE `pt_notifications`;
--> statement-breakpoint
ALTER TABLE `pt_notifications_new` RENAME TO `pt_notifications`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pt_notifications_unique` ON `pt_notifications` (`target_type`,`target_id`,`reminder_at`);
