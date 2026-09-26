import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { getActivity } from "@/lib/data";
import { syncRecentEvents } from "@/lib/sync-events";
import { syncMultiBaasEvents } from "@/lib/multibaas-sync";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const eventLabels: Record<string, string> = {
  CardVaulted: "Card added",
  BorrowerVerified: "Borrower verified",
  ValuationAccepted: "Card value accepted",
  LoanOriginated: "Loan opened",
  LiquidityDeposited: "Liquidity supplied",
  LiquidityWithdrawn: "Liquidity withdrawn",
  LoanRepaid: "Loan repaid",
  DemoMaturityAccelerated: "Loan term advanced",
  LoanDefaulted: "Loan defaulted",
  AuctionStarted: "Auction opened",
  AuctionBid: "Bid placed",
  AuctionSettled: "Auction settled",
  LoanSettled: "Loan settled",
};

export default async function ActivityPage() {
  let curvegridError = false;
  let rpcError = false;
  try { await syncMultiBaasEvents(); } catch (error) { curvegridError = true; console.error("MultiBaas activity sync failed", error); }
  try { await syncRecentEvents(); } catch (error) { rpcError = true; console.error("Sepolia activity sync failed", error); }
  const events = await getActivity();
  return <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 md:px-6 md:py-12"><PageHeading title="Market activity" description="A public record of card, loan, and pool transactions." />
    {curvegridError || rpcError ? <p role="status" className="text-sm text-muted-foreground">Live updates are delayed. Showing the latest available activity.</p> : null}
    <Card><CardContent className="p-0">{events.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><h2 className="font-display text-3xl font-semibold">No activity yet.</h2><p className="mt-3 text-sm text-muted-foreground">Transactions will appear here.</p></div> : <div className="divide-y divide-border">{events.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-7"><div className="flex min-w-0 items-center gap-4"><span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" /><div><p className="text-sm font-semibold">{eventLabels[event.eventName] ?? event.eventName}</p><p className="mt-1 text-sm text-muted-foreground">{event.occurredAt.toLocaleString()}</p></div></div><a href={`https://sepolia.etherscan.io/tx/${event.txHash}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${eventLabels[event.eventName] ?? event.eventName} transaction on Etherscan`} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowUpRight className="size-4" aria-hidden="true" /></a></div>)}</div>}</CardContent></Card>
  </main>;
}
