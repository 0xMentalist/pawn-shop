CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`set_name` text NOT NULL,
	`year` integer NOT NULL,
	`grader` text NOT NULL,
	`grade` text NOT NULL,
	`certification_number` text NOT NULL,
	`custody_status` text NOT NULL,
	`token_id` text,
	`token_contract` text,
	`image_url` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_certification_number_unique` ON `cards` (`certification_number`);--> statement-breakpoint
CREATE TABLE `chain_events` (
	`id` text PRIMARY KEY NOT NULL,
	`chain_id` integer NOT NULL,
	`tx_hash` text NOT NULL,
	`log_index` integer NOT NULL,
	`block_number` integer NOT NULL,
	`event_name` text NOT NULL,
	`actor_address` text,
	`loan_id` text,
	`payload_json` text NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chain_event_tx_log_unique` ON `chain_events` (`chain_id`,`tx_hash`,`log_index`);--> statement-breakpoint
CREATE INDEX `chain_event_block_idx` ON `chain_events` (`chain_id`,`block_number`);--> statement-breakpoint
CREATE TABLE `identity_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_address` text NOT NULL,
	`action` text NOT NULL,
	`nullifier_hash` text NOT NULL,
	`authorized_at` integer NOT NULL,
	`registration_tx_hash` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_wallet_action_unique` ON `identity_authorizations` (`wallet_address`,`action`);--> statement-breakpoint
CREATE UNIQUE INDEX `identity_nullifier_action_unique` ON `identity_authorizations` (`nullifier_hash`,`action`);--> statement-breakpoint
CREATE TABLE `valuation_fixtures` (
	`card_id` text PRIMARY KEY NOT NULL,
	`last_sale_micro_usdc` integer NOT NULL,
	`median_30d_micro_usdc` integer NOT NULL,
	`appraised_micro_usdc` integer NOT NULL,
	`confidence` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `webhook_receipts` (
	`delivery_id` text PRIMARY KEY NOT NULL,
	`received_at` integer NOT NULL,
	`processed_at` integer,
	`status` text NOT NULL
);
