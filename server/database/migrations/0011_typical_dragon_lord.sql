DROP INDEX `idx_sm_notes_point_product`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sm_notes_point` ON `sm_notes` (`point_id`);--> statement-breakpoint
ALTER TABLE `sm_tasks` ADD `completed_at` integer;