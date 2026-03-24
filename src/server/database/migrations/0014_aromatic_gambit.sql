ALTER TABLE `sm_activities` ADD `skill_id` text DEFAULT 'startup-map' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_sm_activities_skill` ON `sm_activities` (`skill_id`);--> statement-breakpoint
ALTER TABLE `sm_domains` ADD `skill_id` text DEFAULT 'startup-map' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_sm_domains_skill` ON `sm_domains` (`skill_id`);--> statement-breakpoint
ALTER TABLE `sm_stages` ADD `skill_id` text DEFAULT 'startup-map' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_sm_stages_skill` ON `sm_stages` (`skill_id`);