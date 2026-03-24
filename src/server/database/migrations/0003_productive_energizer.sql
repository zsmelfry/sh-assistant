CREATE TABLE `definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word_id` integer NOT NULL,
	`definition` text NOT NULL,
	`part_of_speech` text DEFAULT '' NOT NULL,
	`example` text DEFAULT '' NOT NULL,
	`example_translation` text DEFAULT '' NOT NULL,
	`examples` text DEFAULT '[]',
	`synonyms` text DEFAULT '' NOT NULL,
	`antonyms` text DEFAULT '' NOT NULL,
	`word_family` text DEFAULT '' NOT NULL,
	`collocations` text DEFAULT '' NOT NULL,
	`fetched_at` integer NOT NULL,
	`model_provider` text DEFAULT '' NOT NULL,
	`model_name` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`word_id`) REFERENCES `vocab_words`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_definitions_word_id` ON `definitions` (`word_id`);--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`word_id` integer NOT NULL,
	`srs_card_id` integer NOT NULL,
	`quality` integer NOT NULL,
	`previous_interval` integer NOT NULL,
	`new_interval` integer NOT NULL,
	`previous_ease_factor` real NOT NULL,
	`new_ease_factor` real NOT NULL,
	`reviewed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `vocab_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `vocab_words`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`srs_card_id`) REFERENCES `srs_cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_review_logs_user_id` ON `review_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_review_logs_card_id` ON `review_logs` (`srs_card_id`);--> statement-breakpoint
CREATE INDEX `idx_review_logs_reviewed_at` ON `review_logs` (`reviewed_at`);--> statement-breakpoint
CREATE TABLE `srs_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`word_id` integer NOT NULL,
	`ease_factor` real DEFAULT 2.5 NOT NULL,
	`interval` integer DEFAULT 0 NOT NULL,
	`repetitions` integer DEFAULT 0 NOT NULL,
	`next_review_at` integer NOT NULL,
	`last_reviewed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `vocab_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `vocab_words`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_srs_cards_user_word` ON `srs_cards` (`user_id`,`word_id`);--> statement-breakpoint
CREATE INDEX `idx_srs_cards_user_id` ON `srs_cards` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_srs_cards_next_review` ON `srs_cards` (`next_review_at`);--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`new_words_studied` integer DEFAULT 0 NOT NULL,
	`reviews_completed` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `vocab_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_study_sessions_user_date` ON `study_sessions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_study_sessions_user_id` ON `study_sessions` (`user_id`);