-- Add wordbook_id to study_sessions for per-wordbook session isolation
ALTER TABLE `study_sessions` ADD COLUMN `wordbook_id` integer;
--> statement-breakpoint
-- Replace old unique index with one that includes wordbook_id
DROP INDEX IF EXISTS `idx_study_sessions_user_date`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_study_sessions_user_date_wb` ON `study_sessions` (`user_id`, `date`, `wordbook_id`);
