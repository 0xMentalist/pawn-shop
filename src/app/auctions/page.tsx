import type { Metadata } from "next";
import { Gavel } from "lucide-react";
import { AuctionBoard } from "@/components/auction-board";
import { getAuctionLoanIds } from "@/lib/data";
import { syncRecentEvents } from "@/lib/sync-events";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Auctions" };
export const dynamic = "force-dynamic";

export default async function AuctionsPage() {
  let syncError = false;
  try { await syncRecentEvents(); } catch { syncError = true; }
  const loanIds = await getAuctionLoanIds();
  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12 lg:px-8"><PageHeading title="Card auctions" description="Bid on cards from loans that were not repaid." />
    {syncError ? <p className="rounded-md border border-border p-3 text-xs text-muted-foreground">Live RPC sync is unavailable. Showing previously indexed auctions.</p> : null}
    {loanIds.length > 0 ? <AuctionBoard loanIds={loanIds} /> : <Card><CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><span className="flex size-14 items-center justify-center rounded-lg bg-secondary"><Gavel className="size-6" aria-hidden="true" /></span><h2 className="mt-5 text-lg font-semibold">No auctions yet</h2></CardContent></Card>}
  </main>;
}
