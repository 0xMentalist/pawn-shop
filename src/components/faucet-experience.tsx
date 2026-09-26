"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ExternalLink, Search } from "lucide-react";
import { zeroAddress, type Hex } from "viem";
import { useAccount, useBalance, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletButton } from "@/components/wallet-button";
import { abis, contracts, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { formatUsdc } from "@/lib/loan-math";
import { PSA_GUIDE_URL, type FAUCET_CARDS } from "@/lib/faucet-cards";

type FaucetCard = (typeof FAUCET_CARDS)[number] & { claimed: boolean };
type Voucher = { item: {
  number: number; cardName: string; setName: string; year: number; grader: string; grade: string;
  certificationNumber: string; imageUri: string; metadataUri: string; custodyAttestationHash: Hex; expiresAt: string;
}; signature: Hex };

export function FaucetExperience({ cards, refreshError }: { cards: FaucetCard[]; refreshError: boolean }) {
  const router = useRouter();
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const chain = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const onSepolia = isConnected && chainId === SEPOLIA_CHAIN_ID;
  const [query, setQuery] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState<{ name: string; hash: Hex } | null>(null);
  const [claimedHere, setClaimedHere] = useState<string[]>([]);
  const [usdcBusy, setUsdcBusy] = useState(false);
  const [usdcMessage, setUsdcMessage] = useState("");
  const [usdcHash, setUsdcHash] = useState<Hex>();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [showAvailable, setShowAvailable] = useState(true);
  useEffect(() => { const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 60_000); return () => clearInterval(timer); }, []);
  const eth = useBalance({ address, chainId: SEPOLIA_CHAIN_ID, query: { enabled: onSepolia } });
  const balance = useReadContract({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "balanceOf", args: [address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: onSepolia, refetchInterval: 15_000 } });
  const nextClaim = useReadContract({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "nextFaucetAt", args: [address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: onSepolia, refetchInterval: 15_000 } });
  const claimedCount = useReadContract({ address: contracts.cardFaucet, abi: abis.cardFaucet, functionName: "claimedCount", args: [address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: onSepolia && Boolean(contracts.cardFaucet), refetchInterval: 15_000 } });
  const cooldown = typeof nextClaim.data === "bigint" && nextClaim.data > BigInt(now) ? Number(nextClaim.data) : null;
  const canClaimUsdc = onSepolia && !usdcBusy && typeof nextClaim.data === "bigint" && cooldown === null;
  const gasMissing = onSepolia && eth.data?.value === 0n;
  const available = cards.filter((card) => !card.claimed && !claimedHere.includes(card.id)).length;
  const visibleCards = cards.filter((card) => (!showAvailable || (!card.claimed && !claimedHere.includes(card.id))) && `${card.name} ${card.printing} PSA ${card.grade}`.toLowerCase().includes(query.trim().toLowerCase()));

  async function claimUsdc() {
    if (!contracts.mockUsdc || !chain || !canClaimUsdc) return;
    setUsdcBusy(true);
    setUsdcMessage("Confirm the test token claim in your wallet.");
    setUsdcHash(undefined);
    try {
      const hash = await writeContractAsync({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "faucet", chainId: SEPOLIA_CHAIN_ID });
      const receipt = await chain.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The claim did not complete.");
      setUsdcHash(hash);
      setUsdcMessage("10,000 MockUSDC received.");
      setNow(Math.floor(Date.now() / 1000));
      await Promise.all([balance.refetch(), nextClaim.refetch()]);
    } catch (error) { setUsdcMessage(error instanceof Error ? error.message.split("\n")[0] : "Could not claim MockUSDC."); }
    finally { setUsdcBusy(false); }
  }

  async function claimCard(card: FaucetCard) {
    if (!address || !chain || !onSepolia || !contracts.cardFaucet || claimingId) return;
    setClaimingId(card.id);
    setClaimError("");
    setClaimSuccess(null);
    try {
      const response = await fetch("/api/faucet/voucher", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: card.id, address }) });
      const body = await response.json() as Voucher & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not prepare this card.");
      const item = { ...body.item, expiresAt: BigInt(body.item.expiresAt) };
      const hash = await writeContractAsync({ address: contracts.cardFaucet, abi: abis.cardFaucet, functionName: "claim", args: [item, body.signature], chainId: SEPOLIA_CHAIN_ID });
      const receipt = await chain.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The card claim did not complete.");
      setClaimedHere((previous) => [...previous, card.id]);
      setClaimSuccess({ name: card.name, hash });
      await claimedCount.refetch();
      router.refresh();
    } catch (error) { setClaimError(error instanceof Error ? error.message.split("\n")[0] : "Could not claim this card."); }
    finally { setClaimingId(null); }
  }

  return <div className="space-y-10">
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
      <div><h1 className="font-display text-5xl font-semibold tracking-tight md:text-6xl">Start with a card.</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Pick a demo card, claim test funds, and try Pawn Shop with your wallet.</p></div>
      <div className="rounded-2xl border bg-card p-5"><div className="flex items-baseline justify-between gap-3"><p className="text-sm text-muted-foreground">Your MockUSDC</p><p className="font-display text-3xl font-semibold tabular-nums">{typeof balance.data === "bigint" ? formatUsdc(balance.data) : "—"}</p></div><p className="mt-2 text-sm text-muted-foreground">Valueless test currency on Sepolia.</p>
        {isConnected && !onSepolia ? <Button type="button" className="mt-5 w-full" disabled={switching} onClick={() => void switchChainAsync({ chainId: SEPOLIA_CHAIN_ID })}>{switching ? "Switching…" : "Switch to Sepolia"}</Button> : null}
        {onSepolia ? <Button type="button" className="mt-5 w-full" disabled={!canClaimUsdc || gasMissing} aria-busy={usdcBusy} onClick={() => void claimUsdc()}>{usdcBusy ? "Claiming…" : nextClaim.isPending ? "Checking availability…" : cooldown ? "Claim available later" : "Claim 10,000 MockUSDC"}</Button> : !isConnected ? <div className="mt-5"><WalletButton /></div> : null}
        {balance.isError || nextClaim.isError ? <div className="mt-3 text-sm" role="alert"><p>Could not check your test funds.</p><Button type="button" variant="outline" className="mt-2" onClick={() => { void balance.refetch(); void nextClaim.refetch(); }}>Try again</Button></div> : null}
        {cooldown ? <p className="mt-2 text-xs text-muted-foreground">Next claim {new Date(cooldown * 1000).toLocaleString()}.</p> : null}
        {usdcMessage ? <p role="status" className="mt-3 text-sm">{usdcMessage}</p> : null}
        {usdcHash ? <a className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`https://sepolia.etherscan.io/tx/${usdcHash}`} target="_blank" rel="noopener noreferrer">View transaction <ExternalLink className="size-3" aria-hidden="true" /></a> : null}
      </div>
    </div>

    {gasMissing ? <p role="status" className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm">Add a little Sepolia ETH to your wallet for card and MockUSDC claim transactions.</p> : null}
    {refreshError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm"><span>Card availability could not refresh. Check again before claiming.</span><Button type="button" variant="outline" onClick={() => router.refresh()}>Refresh</Button></div> : null}
    {claimSuccess ? <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm"><span>{claimSuccess.name} is in your wallet. You can use it on Borrow.</span><div className="flex flex-wrap items-center gap-3"><a className="min-h-10 content-center text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`https://sepolia.etherscan.io/tx/${claimSuccess.hash}`} target="_blank" rel="noopener noreferrer">View transaction</a><Link href="/borrow" className="inline-flex min-h-10 items-center gap-1 font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Your cards <ArrowRight className="size-4" aria-hidden="true" /></Link></div></div> : null}
    {claimError ? <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">{claimError} Please try another available card if it was just claimed.</p> : null}
    {claimedCount.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm"><span>Could not check your card claim limit.</span><Button type="button" variant="outline" onClick={() => void claimedCount.refetch()}>Try again</Button></div> : null}

    <section aria-labelledby="faucet-cards-title" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="faucet-cards-title" className="font-display text-3xl font-semibold md:text-4xl">Choose a card</h2><p className="mt-2 text-sm text-muted-foreground">{available} of 40 available · up to three per wallet</p></div><a href={PSA_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">See PSA price guide <ExternalLink className="size-4" aria-hidden="true" /></a></div>
      <div className="flex flex-wrap items-center gap-3"><div className="relative w-full max-w-sm"><label htmlFor="faucet-card-search" className="sr-only">Search cards</label><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="faucet-card-search" className="pl-10" type="search" placeholder="Search 40 cards" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Button type="button" variant={showAvailable ? "default" : "outline"} aria-pressed={showAvailable} onClick={() => setShowAvailable(true)}>Available</Button><Button type="button" variant={!showAvailable ? "default" : "outline"} aria-pressed={!showAvailable} onClick={() => setShowAvailable(false)}>All cards</Button></div>
      {visibleCards.length === 0 ? <div className="rounded-2xl border bg-card p-10 text-center"><p className="font-display text-xl font-semibold">{available === 0 ? "All 40 cards have been claimed." : "No cards match your search."}</p><p className="mt-2 text-sm text-muted-foreground">{available === 0 ? "You can still claim MockUSDC and explore lending." : "Try a different name or show all cards."}</p>{query ? <Button type="button" variant="outline" className="mt-5" onClick={() => setQuery("")}>Clear search</Button> : null}</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{visibleCards.map((card) => {
        const isClaimed = card.claimed || claimedHere.includes(card.id);
        const atLimit = typeof claimedCount.data === "bigint" && claimedCount.data >= 3n;
        return <article key={card.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card"><div className="flex h-56 items-center justify-center bg-secondary p-4"><img src={card.imageUrl} alt={`${card.name} Base Set card artwork`} width={164} height={226} loading="lazy" className="h-full w-auto max-w-full object-contain drop-shadow-sm" /></div><div className="flex flex-1 flex-col p-5"><div className="flex items-baseline justify-between gap-2"><h3 className="font-display text-xl font-semibold">{card.name}</h3><span className="font-serial text-xs text-muted-foreground">#{String(card.id.slice(-3))}</span></div><p className="mt-1 text-sm text-muted-foreground">Base Set · Demo PSA {card.grade} · {card.printing.split(" #")[0]}</p><p className="mt-5 text-sm text-muted-foreground">PSA guide estimate</p><p className="font-display text-2xl font-semibold tabular-nums">{formatUsdc(card.valueMicroUsdc)}</p><Button type="button" variant={isClaimed ? "outline" : "default"} className="mt-5 w-full" disabled={isClaimed || !onSepolia || !contracts.cardFaucet || Boolean(claimingId) || atLimit || gasMissing || typeof claimedCount.data !== "bigint"} aria-busy={claimingId === card.id} onClick={() => void claimCard(card)}>{isClaimed ? "Claimed" : claimingId === card.id ? "Claiming…" : onSepolia && claimedCount.isPending ? "Checking…" : atLimit ? "Limit reached" : "Claim card"}</Button></div></article>;
      })}</div>}
      <p className="text-sm leading-6 text-muted-foreground">These are simulated NFTs. No physical cards are held. PSA guide amounts are examples for the demo and may change.</p>
    </section>
  </div>;
}
