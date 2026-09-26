import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cards, chainEvents, valuationFixtures } from "@/db/schema";

export async function getDemoCard() {
  const [card] = await db.select().from(cards).where(eq(cards.id, "demo-charizard-001"));
  if (!card) return null;
  const [valuation] = await db.select().from(valuationFixtures).where(eq(valuationFixtures.cardId, card.id));
  return { card, valuation: valuation ?? null };
}

export async function getActivity() {
  return db.select().from(chainEvents).orderBy(desc(chainEvents.blockNumber), desc(chainEvents.logIndex)).limit(50);
}

export async function getAuctionLoanIds() {
  const rows = await db.select({ loanId: chainEvents.loanId }).from(chainEvents).where(eq(chainEvents.eventName, "AuctionStarted")).orderBy(desc(chainEvents.blockNumber));
  return [...new Set(rows.map((row) => row.loanId).filter((id): id is string => Boolean(id)))];
}
