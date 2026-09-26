import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// SQLite holds demo fixtures and projections. Contracts remain the source of truth
// for balances, ownership, loans, and auction settlement.
export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  setName: text("set_name").notNull(),
  year: integer("year").notNull(),
  grader: text("grader").notNull(),
  grade: text("grade").notNull(),
  certificationNumber: text("certification_number").notNull().unique(),
  custodyStatus: text("custody_status", { enum: ["simulated_received", "vaulted", "pledged", "released", "liquidated"] }).notNull(),
  tokenId: text("token_id"),
  tokenContract: text("token_contract"),
  imageUrl: text("image_url"),
});

export const valuationFixtures = sqliteTable("valuation_fixtures", {
  cardId: text("card_id").primaryKey().references(() => cards.id),
  lastSaleMicroUsdc: integer("last_sale_micro_usdc").notNull(),
  median30dMicroUsdc: integer("median_30d_micro_usdc").notNull(),
  appraisedMicroUsdc: integer("appraised_micro_usdc").notNull(),
  confidence: text("confidence", { enum: ["high", "medium", "low"] }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const identityAuthorizations = sqliteTable("identity_authorizations", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  action: text("action").notNull(),
  nullifierHash: text("nullifier_hash").notNull(),
  credentialType: text("credential_type", { enum: ["proof_of_human", "passport", "mnc", "selfie"] }),
  authorizedAt: integer("authorized_at", { mode: "timestamp_ms" }).notNull(),
  registrationTxHash: text("registration_tx_hash"),
}, (table) => [
  uniqueIndex("identity_wallet_action_unique").on(table.walletAddress, table.action),
  uniqueIndex("identity_nullifier_action_unique").on(table.nullifierHash, table.action),
]);

export const chainEvents = sqliteTable("chain_events", {
  id: text("id").primaryKey(), // chainId:txHash:logIndex
  chainId: integer("chain_id").notNull(),
  txHash: text("tx_hash").notNull(),
  logIndex: integer("log_index").notNull(),
  blockNumber: integer("block_number").notNull(),
  eventName: text("event_name").notNull(),
  actorAddress: text("actor_address"),
  loanId: text("loan_id"),
  payloadJson: text("payload_json").notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("chain_event_tx_log_unique").on(table.chainId, table.txHash, table.logIndex),
  index("chain_event_block_idx").on(table.chainId, table.blockNumber),
]);

export const webhookReceipts = sqliteTable("webhook_receipts", {
  deliveryId: text("delivery_id").primaryKey(),
  receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["received", "processed", "failed"] }).notNull(),
});

export const indexerCursors = sqliteTable("indexer_cursors", {
  id: text("id").primaryKey(),
  nextBlock: integer("next_block").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
