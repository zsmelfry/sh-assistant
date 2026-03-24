CREATE TABLE `sm_quiz_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quiz_id` integer NOT NULL,
	`user_answer` text NOT NULL,
	`is_correct` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `sm_quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sm_quiz_attempts_quiz` ON `sm_quiz_attempts` (`quiz_id`);--> statement-breakpoint
CREATE TABLE `sm_quizzes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`point_id` integer NOT NULL,
	`section` text NOT NULL,
	`type` text NOT NULL,
	`question` text NOT NULL,
	`options` text,
	`correct_answer` text NOT NULL,
	`explanation` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`point_id`) REFERENCES `sm_points`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sm_quizzes_point_section` ON `sm_quizzes` (`point_id`,`section`);--> statement-breakpoint
ALTER TABLE `skill_configs` ADD `quiz_system_prompt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `skill_configs` ADD `quiz_user_prompt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `skill_configs` ADD `guidance_system_prompt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `skill_configs` ADD `guidance_user_prompt` text DEFAULT '' NOT NULL;