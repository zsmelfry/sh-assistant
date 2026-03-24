-- Wordbooks: multi-language wordbook support for vocab-tracker
CREATE TABLE `wordbooks` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `name` text NOT NULL,
  `language` text NOT NULL,
  `is_active` integer DEFAULT 0,
  `word_count` integer DEFAULT 0,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
-- Seed default French wordbook with current word count
INSERT INTO `wordbooks` (`name`, `language`, `is_active`, `word_count`, `created_at`)
  VALUES ('法语频率词', 'fr', 1, (SELECT COUNT(*) FROM `vocab_words`), strftime('%s', 'now') * 1000);
--> statement-breakpoint
-- Add wordbook_id column to vocab_words, default to 1 (the French wordbook)
ALTER TABLE `vocab_words` ADD COLUMN `wordbook_id` integer DEFAULT 1 REFERENCES `wordbooks`(`id`);
--> statement-breakpoint
-- Point all existing words to the default French wordbook
UPDATE `vocab_words` SET `wordbook_id` = 1 WHERE `wordbook_id` IS NULL;
--> statement-breakpoint
-- Create composite index for efficient per-wordbook queries
CREATE INDEX `idx_vocab_words_wordbook_rank` ON `vocab_words` (`wordbook_id`, `rank`);
--> statement-breakpoint
-- Feature gate: multi-wordbook mode disabled by default
INSERT OR IGNORE INTO `vocab_settings` (`key`, `value`) VALUES ('multi_wordbook_enabled', 'false');
