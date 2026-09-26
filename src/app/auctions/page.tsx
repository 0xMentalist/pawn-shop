import type { Metadata } from "next";
import { AuctionBoard } from "@/components/auction-board";
import { AuctionRefresh } from "@/components/auction-refresh";
import { getAuctionListings, getDemoCards } from "@/lib/data";
import { syncFaucetCards } from "@/lib/faucet-sync";
import { getDemoCardEvidence } from "@/lib/demo-cards";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import type { AuctionListing } from "@/lib/auction-discovery";

export const metadata: Metadata = { title: "Auctions" };
export const dynamic = "force-dynamic";

export default async function AuctionsPage() {
  let syncError = false;
  let listings: AuctionListing[] = [];
  try {
    const result = await getAuctionListings();
    listings = result.listings;
    syncError = result.failedMarkets > 0;
  } catch (error) {
    syncError = true;
    console.error("Auction market read failed", error);
  }
  try { await syncFaucetCards(); }
  catch (error) { console.error("Could not sync card faucet for Auctions", error); }
  const cardRecords = await getDemoCards();
  const cards = Object.fromEntries(cardRecords.flatMap(({ card }) => {
    const evidence = getDemoCardEvidence(card.id);
    return card.tokenId && evidence ? [[card.tokenId, { name: card.name, grade: card.grade, imageUrl: evidence.imageUrl, psaReferenceNumber: evidence.psaReferenceNumber, saleSourceUrl: evidence.saleSourceUrl, priceSource: ("sourceType" in evidence ? evidence.sourceType : "psa-auction-comparable") as "psa-auction-comparable" | "psa-price-guide" }]] : [];
  }));
  return <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12 lg:px-8"><AuctionRefresh /><PageHeading title="Card auctions" description="Find cards from loans that reached auction." />
    {syncError ? <p role="status" className="text-sm text-muted-foreground">Some auctions could not refresh right now.</p> : null}
    {listings.length > 0 ? <AuctionBoard listings={listings.map(({ loanId, auctionAddress, managerAddress }) => ({ loanId, auctionAddress, managerAddress }))} cards={cards} /> : <Card><CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><h2 className="font-display text-3xl font-semibold">{syncError ? "Auctions unavailable." : "No live auctions."}</h2><p className="mt-3 text-sm text-muted-foreground">{syncError ? "Please try again shortly." : "Cards entering auction will appear here."}</p></CardContent></Card>}
  </main>;
}
