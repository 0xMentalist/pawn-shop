CREATE TABLE `indexer_cursors` (
	`id` text PRIMARY KEY NOT NULL,
	`next_block` integer NOT NULL,
	`updated_at` integer NOT NULL
);
