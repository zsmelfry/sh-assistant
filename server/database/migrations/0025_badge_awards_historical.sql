-- Add historical flag to badge_awards for tracking badges that no longer meet conditions
ALTER TABLE `badge_awards` ADD COLUMN `historical` integer NOT NULL DEFAULT 0;
