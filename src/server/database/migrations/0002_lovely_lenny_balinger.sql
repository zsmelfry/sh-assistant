CREATE TABLE `llm_providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`model_name` text NOT NULL,
	`endpoint` text,
	`api_key` text,
	`is_default` integer DEFAULT false NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`params` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_llm_providers_provider` ON `llm_providers` (`provider`);--> statement-breakpoint
CREATE INDEX `idx_llm_providers_is_default` ON `llm_providers` (`is_default`);