"use client";

import { useEffect, useState } from "react";
import { parseUnits, zeroAddress, type Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { abis, contracts, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { formatUsdc } from "@/lib/loan-math";

type AuctionCard = { name: string; grade: string; imageUrl: string; psaReferenceNumber: string; saleSourceUrl: string };

export function AuctionBoard({ loanIds, cards }: { loanIds: string[]; cards: Record<string, AuctionCard> }) {
  return <div className="grid gap-4">{loanIds.map((id) => <AuctionItem key={id} loanId={BigInt(id)} cards={cards} />)}</div>;
}

function AuctionItem({ loanId, cards }: { loanId: bigint; cards: Record<string, AuctionCard> }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hex>();
  const [now, setNow] = useState(Date.now());
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const ready = Boolean(contracts.auction && contracts.mockUsdc && isConnected && chainId === SEPOLIA_CHAIN_ID && publicClient);
  const auction = useReadContract({ address: contracts.auction, abi: abis.auction, functionName: "auctions", args: [loanId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: Boolean(contracts.auction), refetchInterval: 15_000 } });
  const minBid = useReadContract({ address: contracts.auction, abi: abis.auction, functionName: "minimumBid", args: [loanId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: Boolean(contracts.auction), refetchInterval: 15_000 } });
  const tokenBalance = useReadContract({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "balanceOf", args: [address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready, refetchInterval: 15_000 } });
  const details = Array.isArray(auction.data) ? auction.data : null;
  const card = details ? cards[String(details[0])] : undefined;
  const endsAt = details ? Number(details[3]) * 1000 : 0;
  const settled = details ? Boolean(details[6]) : false;
  const closed = now >= endsAt;
  const minimum = typeof minBid.data === "bigint" ? minBid.data : 0n;
  let entered: bigint | undefined;
  try { if (/^\d+(\.\d{0,6})?$/.test(amount)) entered = parseUnits(amount, 6); } catch { /* invalid input */ }
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15_000); return () => window.clearInterval(timer); }, []);

  async function confirm(tx: Hex) {
    if (!publicClient) throw new Error("Sepolia RPC is unavailable.");
    setHash(tx);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    if (receipt.status !== "success") throw new Error("Transaction reverted.");
    await Promise.all([auction.refetch(), minBid.refetch(), tokenBalance.refetch()]);
  }

  async function bid() {
    if (!ready || !address || !publicClient || !contracts.auction || !contracts.mockUsdc || !entered || entered < minimum) return;
    setBusy(true);
    setMessage("");
    try {
      const allowance = await publicClient.readContract({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "allowance", args: [address, contracts.auction] });
      if (typeof allowance !== "bigint" || allowance < entered) {
        setMessage("Approve MockUSDC for the bid in your wallet.");
        await confirm(await writeContractAsync({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "approve", args: [contracts.auction, entered], chainId: SEPOLIA_CHAIN_ID }));
      }
      setMessage("Confirm the auction bid in your wallet.");
      await confirm(await writeContractAsync({ address: contracts.auction, abi: abis.auction, functionName: "bid", args: [loanId, entered], chainId: SEPOLIA_CHAIN_ID }));
      setAmount("");
      setMessage("Bid confirmed. The previous highest bidder was refunded.");
    } catch (error) { setMessage(error instanceof Error ? error.message.split("\n")[0] : "Bid failed."); }
    finally { setBusy(false); }
  }

  async function settle() {
    if (!ready || !contracts.auction) return;
    setBusy(true);
    setMessage("");
    try {
      await confirm(await writeContractAsync({ address: contracts.auction, abi: abis.auction, functionName: "settle", args: [loanId], chainId: SEPOLIA_CHAIN_ID }));
      setMessage("Auction settled on Sepolia.");
    } catch (error) { setMessage(error instanceof Error ? error.message.split("\n")[0] : "Settlement failed."); }
    finally { setBusy(false); }
  }

  if (!details || endsAt === 0) return <Card><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">{auction.isError ? <>Could not load auction #{loanId.toString()}. <Button type="button" variant="outline" size="sm" onClick={() => void auction.refetch()}>Retry</Button></> : `Loading auction #${loanId.toString()}…`}</CardContent></Card>;
  return <Card><CardHeader className="gap-4 sm:flex-row sm:items-center">{card ? <div className="flex h-36 w-28 shrink-0 items-center justify-center rounded-xl bg-secondary p-2"><img src={card.imageUrl} alt={`${card.name} card artwork`} className="h-full w-auto max-w-full object-contain" /></div> : null}<div className="space-y-1"><CardTitle className="text-2xl">{card ? `${card.name} · PSA ${card.grade}` : `Card #${String(details[0])}`}</CardTitle><CardDescription>Card #{String(details[0])} · Loan #{loanId.toString()} · {settled ? "Settled" : closed ? "Bidding closed · ready to settle" : `Open until ${new Date(endsAt).toLocaleString()}`}</CardDescription>{card ? <a className="font-serial inline-flex min-h-8 items-center text-xs font-semibold text-primary underline underline-offset-4" href={card.saleSourceUrl} target="_blank" rel="noopener noreferrer">Comparable PSA reference #{card.psaReferenceNumber}</a> : null}</div></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Outstanding principal</p><p className="mt-1 font-semibold tabular-nums">{formatUsdc(details[1] as bigint)}</p></div><div><p className="text-xs text-muted-foreground">{settled ? "Winning bid" : "Highest bid"}</p><p className="mt-1 font-semibold tabular-nums">{formatUsdc(details[5] as bigint)}</p></div>{!settled ? <div><p className="text-xs text-muted-foreground">{(details[5] as bigint) === 0n ? "Opening bid" : "Next minimum"}</p><p className="mt-1 font-semibold tabular-nums">{minimum ? formatUsdc(minimum) : "—"}</p></div> : null}</div>
    {!settled && !closed ? <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void bid(); }}><div className="flex-1"><label htmlFor={`auction-bid-${loanId}`} className="sr-only">Your bid in MockUSDC</label><Input id={`auction-bid-${loanId}`} type="text" inputMode="decimal" placeholder="Bid in MockUSDC" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><Button type="submit" disabled={!ready || busy || !entered || entered < minimum}>Place bid</Button></form> : null}
    {!settled && closed ? <Button type="button" disabled={!ready || busy} onClick={() => void settle()}>Settle auction</Button> : null}
    {!settled ? !isConnected ? <p className="text-xs text-muted-foreground">Connect a wallet to bid or settle.</p> : chainId !== SEPOLIA_CHAIN_ID ? <p className="text-xs text-muted-foreground">Switch your wallet to Sepolia.</p> : <p className="text-xs text-muted-foreground">Your MockUSDC: {typeof tokenBalance.data === "bigint" ? formatUsdc(tokenBalance.data) : "—"}</p> : null}
    {message ? <p role="status" className="text-xs">{message}</p> : null}
    {hash ? <a className="inline-flex min-h-10 items-center rounded-sm text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" target="_blank" rel="noopener noreferrer" href={`https://sepolia.etherscan.io/tx/${hash}`}>View latest transaction</a> : null}
  </CardContent></Card>;
}
