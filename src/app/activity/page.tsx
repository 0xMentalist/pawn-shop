import type { Metadata } from "next";
import { Activity } from "lucide-react";
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
  LiquidityDeposited: "Funds deposited",
  LiquidityWithdrawn: "Funds withdrawn",
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
  try { await syncMultiBaasEvents(); } catch { curvegridError = true; }
  try { await syncRecentEvents(); } catch { rpcError = true; }
  const events = await getActivity();
  return <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 md:px-6 md:py-12"><PageHeading title="Activity" />
    {curvegridError || rpcError ? <p role="status" className="text-sm text-muted-foreground">Live updates are delayed. Showing the latest available activity.</p> : null}
    <Card><CardContent className="p-0">{events.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><span className="flex size-14 items-center justify-center rounded-lg bg-secondary"><Activity className="size-6" aria-hidden="true" /></span><h2 className="mt-5 text-lg font-semibold">No activity yet</h2></div> : <div className="divide-y divide-border">{events.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 p-5"><div><p className="text-sm font-semibold">{eventLabels[event.eventName] ?? event.eventName}</p><p className="mt-1 text-sm text-muted-foreground">{event.occurredAt.toLocaleString()}</p></div><a href={`https://sepolia.etherscan.io/tx/${event.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-md text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View transaction</a></div>)}</div>}</CardContent></Card>
  </main>;
}
