import type { Metadata } from "next";
import { AuctionBoard } from "@/components/auction-board";
import { getAuctionLoanIds, getDemoCards } from "@/lib/data";
import { getDemoCardEvidence } from "@/lib/demo-cards";
import { syncRecentEvents } from "@/lib/sync-events";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Auctions" };
export const dynamic = "force-dynamic";

export default async function AuctionsPage() {
  let syncError = false;
  try { await syncRecentEvents(); } catch { syncError = true; }
  const [loanIds, cardRecords] = await Promise.all([getAuctionLoanIds(), getDemoCards()]);
  const cards = Object.fromEntries(cardRecords.flatMap(({ card }) => {
    const evidence = getDemoCardEvidence(card.id);
    return card.tokenId && evidence ? [[card.tokenId, { name: card.name, grade: card.grade, imageUrl: evidence.imageUrl, psaReferenceNumber: evidence.psaReferenceNumber, saleSourceUrl: evidence.saleSourceUrl }]] : [];
  }));
  return <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12 lg:px-8"><PageHeading title="Auctions" />
    {syncError ? <p role="status" className="text-sm text-muted-foreground">Live updates are delayed. Showing the latest available auctions.</p> : null}
    {loanIds.length > 0 ? <AuctionBoard loanIds={loanIds} cards={cards} /> : <Card><CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><h2 className="font-display text-3xl font-semibold">No auctions yet.</h2><p className="mt-3 text-sm text-muted-foreground">Check back when a card enters auction.</p></CardContent></Card>}
  </main>;
}
