-- Add description and priority columns to checklist items
ALTER TABLE `pt_checklist_items` ADD `description` text;
--> statement-breakpoint
ALTER TABLE `pt_checklist_items` ADD `priority` text NOT NULL DEFAULT 'medium';
--> statement-breakpoint
-- Create checklist attachments table
CREATE TABLE `pt_checklist_attachments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `checklist_item_id` integer NOT NULL REFERENCES `pt_checklist_items`(`id`) ON DELETE CASCADE,
  `type` text NOT NULL,
  `url` text,
  `file_path` text,
  `original_name` text,
  `caption` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pt_checklist_att_item` ON `pt_checklist_attachments` (`checklist_item_id`);
