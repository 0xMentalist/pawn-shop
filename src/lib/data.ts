import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cards, chainEvents, valuationFixtures } from "@/db/schema";
import { DEMO_CARDS, isDemoCardId } from "@/lib/demo-cards";

export async function getDemoCard(cardId = "demo-charizard-001") {
  if (!isDemoCardId(cardId)) return null;
  const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
  if (!card) return null;
  const [valuation] = await db.select().from(valuationFixtures).where(eq(valuationFixtures.cardId, card.id));
  return { card, valuation: valuation ?? null };
}

export async function getDemoCards() {
  const records = await Promise.all(DEMO_CARDS.map((card) => getDemoCard(card.id)));
  return records.flatMap((record) => record?.valuation ? [{ card: record.card, valuation: record.valuation }] : []);
}

export async function getActivity() {
  return db.select().from(chainEvents).orderBy(desc(chainEvents.blockNumber), desc(chainEvents.logIndex)).limit(50);
}

export async function getAuctionLoanIds() {
  const rows = await db.select({ loanId: chainEvents.loanId }).from(chainEvents).where(eq(chainEvents.eventName, "AuctionStarted")).orderBy(desc(chainEvents.blockNumber));
  return [...new Set(rows.map((row) => row.loanId).filter((id): id is string => Boolean(id)))];
}
