-- Dashboard: daily insights cache for AI-generated daily motivation
CREATE TABLE `coach_daily_insights` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `date` text NOT NULL,
  `content` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_coach_daily_insights_date` ON `coach_daily_insights` (`date`);
