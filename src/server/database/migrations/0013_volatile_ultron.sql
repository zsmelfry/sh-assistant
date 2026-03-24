ALTER TABLE `planner_domains` ADD `year` integer DEFAULT 2026 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_planner_domains_year_sort` ON `planner_domains` (`year`,`sort_order`);