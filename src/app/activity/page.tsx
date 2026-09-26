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
  DemoMaturityAccelerated: "Loan term advanced (test)",
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
  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12 lg:px-8"><PageHeading title="Activity" description="Recent pool and loan transactions." />
    {curvegridError ? <p className="rounded-md border border-border p-3 text-xs text-muted-foreground">Curvegrid is temporarily unavailable. Direct Sepolia sync is still active.</p> : null}
    {rpcError ? <p className="rounded-md border border-border p-3 text-xs text-muted-foreground">Direct Sepolia sync is unavailable. Showing previously indexed events.</p> : null}
    <Card><CardContent className="p-0">{events.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><span className="flex size-14 items-center justify-center rounded-lg bg-secondary"><Activity className="size-6" aria-hidden="true" /></span><h2 className="mt-5 text-lg font-semibold">No activity yet</h2></div> : <div className="divide-y divide-border">{events.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 p-5"><div><p className="text-sm font-semibold">{eventLabels[event.eventName] ?? event.eventName}</p><p className="mt-1 text-xs text-muted-foreground">{event.occurredAt.toLocaleString()}</p></div><a href={`https://sepolia.etherscan.io/tx/${event.txHash}`} target="_blank" rel="noopener noreferrer" className="rounded-md text-xs font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View transaction</a></div>)}</div>}</CardContent></Card>
  </main>;
}
