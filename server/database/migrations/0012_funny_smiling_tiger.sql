DROP INDEX `idx_sm_notes_point`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sm_notes_point_product` ON `sm_notes` (`point_id`,`product_id`);