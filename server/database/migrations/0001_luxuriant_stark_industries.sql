CREATE TABLE `vocab_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`word_id` integer NOT NULL,
	`learning_status` text DEFAULT 'unread' NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`is_mastered` integer DEFAULT false NOT NULL,
	`first_interacted_at` integer,
	`mastered_at` integer,
	`note` text,
	FOREIGN KEY (`user_id`) REFERENCES `vocab_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `vocab_words`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vocab_progress_user_word` ON `vocab_progress` (`user_id`,`word_id`);--> statement-breakpoint
CREATE INDEX `idx_vocab_progress_user_id` ON `vocab_progress` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_vocab_progress_word_id` ON `vocab_progress` (`word_id`);--> statement-breakpoint
CREATE INDEX `idx_vocab_progress_status` ON `vocab_progress` (`learning_status`);--> statement-breakpoint
CREATE TABLE `vocab_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `vocab_status_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`word_id` integer NOT NULL,
	`previous_status` text NOT NULL,
	`new_status` text NOT NULL,
	`changed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `vocab_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `vocab_words`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_vocab_history_user_id` ON `vocab_status_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_vocab_history_word_id` ON `vocab_status_history` (`word_id`);--> statement-breakpoint
CREATE INDEX `idx_vocab_history_user_word` ON `vocab_status_history` (`user_id`,`word_id`);--> statement-breakpoint
CREATE INDEX `idx_vocab_history_changed_at` ON `vocab_status_history` (`changed_at`);--> statement-breakpoint
CREATE TABLE `vocab_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nickname` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vocab_words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rank` integer NOT NULL,
	`word` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_vocab_words_rank` ON `vocab_words` (`rank`);