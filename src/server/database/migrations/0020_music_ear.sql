-- music-ear: songs table
CREATE TABLE `songs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `artist` text NOT NULL,
  `album` text,
  `year` integer,
  `genre` text,
  `lyrics` text,
  `notes` text,
  `youtube_url` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_songs_artist` ON `songs` (`artist`);
--> statement-breakpoint
CREATE INDEX `idx_songs_year` ON `songs` (`year`);
--> statement-breakpoint
-- music-ear: point-song junction table
CREATE TABLE `sm_point_songs` (
  `point_id` integer NOT NULL REFERENCES `sm_points`(`id`) ON DELETE CASCADE,
  `song_id` integer NOT NULL REFERENCES `songs`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL,
  PRIMARY KEY(`point_id`, `song_id`)
);
--> statement-breakpoint
-- quiz: add audio_spec column
ALTER TABLE `sm_quizzes` ADD `audio_spec` text;
