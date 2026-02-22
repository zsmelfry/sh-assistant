CREATE TABLE `skill_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`skill_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text DEFAULT 'BookOpen' NOT NULL,
	`teaching_system_prompt` text NOT NULL,
	`teaching_user_prompt` text NOT NULL,
	`chat_system_prompt` text NOT NULL,
	`task_system_prompt` text NOT NULL,
	`task_user_prompt` text NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_configs_skill_id_unique` ON `skill_configs` (`skill_id`);