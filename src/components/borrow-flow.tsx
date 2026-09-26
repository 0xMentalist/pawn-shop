"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileCheck2, Flame, RefreshCw, ScanSearch, Wallet } from "lucide-react";
import { useAccount, useReadContract, useSwitchChain } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BorrowActions } from "@/components/borrow-actions";
import { RealyseMarketSignal } from "@/components/realyse-market-signal";
import { WalletButton } from "@/components/wallet-button";
import { abis, contracts, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import type { DemoPrice } from "@/lib/demo-price";
import { formatUsdc, GRACE_DAYS, maximumPrincipal, simpleInterest, TERM_DAYS } from "@/lib/loan-math";

type Asset = { id: string; name: string; setName: string; year: number; grader: string; grade: string; certificationNumber: string; tokenId: string | null };
type WorldConfig = { appId: string; rpId: string; environment: "production" | "staging" } | null;
const steps = [
  { label: "Wallet", icon: Wallet },
  { label: "Card", icon: Flame },
  { label: "Value", icon: ScanSearch },
  { label: "Loan", icon: FileCheck2 },
] as const;
const maximumDemoPrincipal = 3_500_000_000n;

export function BorrowFlow({ asset, worldConfig }: { asset: Asset; worldConfig: WorldConfig }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(false);
  const [price, setPrice] = useState<DemoPrice | null>(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [networkError, setNetworkError] = useState("");
  const { address, chainId, isConnected } = useAccount();
  const previousAddress = useRef(address);
  const { switchChainAsync, isPending: switchingNetwork } = useSwitchChain();
  const onSepolia = isConnected && chainId === SEPOLIA_CHAIN_ID;
  const tokenId = asset.tokenId ? BigInt(asset.tokenId) : 0n;
  const owner = useReadContract({ address: contracts.card, abi: abis.card, functionName: "ownerOf", args: [tokenId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: onSepolia && Boolean(asset.tokenId && contracts.card) } });
  const loanId = useReadContract({ address: contracts.manager, abi: abis.manager, functionName: "activeLoanForToken", args: [tokenId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: onSepolia && Boolean(asset.tokenId && contracts.manager), refetchInterval: 15_000 } });
  const hasLoan = typeof loanId.data === "bigint" && loanId.data > 0n;
  const ownsCard = Boolean(address && typeof owner.data === "string" && owner.data.toLowerCase() === address.toLowerCase());
  const value = price ? BigInt(price.assumedValueMicroUsdc) : null;
  const ltvPrincipal = value === null ? null : maximumPrincipal(value);
  const principal = ltvPrincipal === null ? null : ltvPrincipal > maximumDemoPrincipal ? maximumDemoPrincipal : ltvPrincipal;
  const interest = principal === null ? null : simpleInterest(principal, TERM_DAYS * 24n * 60n * 60n);

  useEffect(() => {
    if (previousAddress.current && address && previousAddress.current.toLowerCase() !== address.toLowerCase()) {
      setStep(0);
      setSelected(false);
      setPrice(null);
      setPriceError("");
    }
    previousAddress.current = address;
  }, [address]);

  async function switchToSepolia() {
    setNetworkError("");
    try { await switchChainAsync({ chainId: SEPOLIA_CHAIN_ID }); }
    catch { setNetworkError("Your wallet did not switch networks. Open it and select Sepolia, then retry."); }
  }

  async function fetchDemoPrice() {
    if (!selected || priceBusy) return;
    setPriceBusy(true);
    setPriceError("");
    try {
      const response = await fetch(`/api/demo-price?cardId=${encodeURIComponent(asset.id)}`, { cache: "no-store" });
      const body = await response.json() as DemoPrice & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not fetch the demo price.");
      if (body.cardId !== asset.id || body.source !== "mock-realyse" || !Number.isSafeInteger(body.assumedValueMicroUsdc) || body.assumedValueMicroUsdc <= 0) throw new Error("The price response did not match this card.");
      setPrice(body);
    } catch (error) {
      setPrice(null);
      setPriceError(error instanceof Error ? error.message : "Could not fetch the demo price.");
    } finally { setPriceBusy(false); }
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
    <div className="min-w-0 space-y-5">
      <nav aria-label="Borrowing progress" className="rounded-lg border border-border bg-card p-3 sm:p-4">
        <ol className="grid grid-cols-4 gap-1 sm:gap-3">{steps.map(({ label, icon: Icon }, index) => {
          const completed = index < step && (index !== 0 || onSepolia);
          return <li key={label} aria-current={step === index ? "step" : undefined} className="min-w-0">
          <div className={`flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium sm:text-sm ${step === index ? "bg-primary text-primary-foreground" : completed ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-current/30">{completed ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}</span>
            <span className="hidden truncate sm:block">{label}</span><span className="sr-only sm:hidden">{label}</span>
          </div>
        </li>; })}</ol>
      </nav>

      {step === 0 ? <Card>
        <CardHeader><CardTitle className="text-2xl">Connect your wallet</CardTitle><p className="text-sm text-muted-foreground">Use the wallet that holds your card.</p></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-3"><WalletButton />{isConnected && address ? <p className="min-w-0 break-all text-sm text-muted-foreground">{address}</p> : null}</div>
          {isConnected && !onSepolia ? <div className="space-y-2"><p className="text-sm text-muted-foreground">Switch to Sepolia to continue.</p><Button type="button" variant="outline" onClick={() => void switchToSepolia()} disabled={switchingNetwork} aria-busy={switchingNetwork}>{switchingNetwork ? "Switching…" : "Switch network"}</Button>{networkError ? <p role="alert" className="text-sm text-destructive">{networkError}</p> : null}</div> : null}
          {hasLoan ? <Button type="button" variant="outline" onClick={() => { setSelected(true); setStep(3); }}>Manage active loan #{loanId.data?.toString()}</Button> : null}
          <div className="flex flex-wrap justify-end gap-2">{!isConnected ? <Button type="button" variant="outline" onClick={() => setStep(1)}>Preview an offer</Button> : null}<Button type="button" disabled={!onSepolia} onClick={() => setStep(1)}>Choose card<ArrowRight className="size-4" aria-hidden="true" /></Button></div>
        </CardContent>
      </Card> : null}

      {step === 1 ? <Card>
        <CardHeader><CardTitle className="text-2xl">Choose your card</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <button type="button" aria-pressed={selected} onClick={() => { setSelected(true); setPrice(null); }} className={`flex min-h-36 w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? "border-primary bg-secondary/60" : "border-border hover:bg-secondary/40"}`}>
            <span className="flex size-20 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-muted"><Flame className="size-8 text-muted-foreground" aria-hidden="true" /><span className="mt-1 text-xs font-semibold">PSA {asset.grade}</span></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold">{asset.year} {asset.name}</span><span className="mt-1 block text-sm text-muted-foreground">{asset.setName} · {asset.grader} {asset.grade}</span><span className="mt-2 block text-xs text-muted-foreground">Certificate {asset.certificationNumber}</span></span>
            <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{selected ? <Check className="size-3" aria-hidden="true" /> : null}</span>
          </button>
          <div className="text-sm leading-6 text-muted-foreground">{!isConnected ? "You can preview the offer before connecting a wallet." : !onSepolia ? "Switch to Sepolia to check ownership." : owner.isPending ? "Checking card ownership…" : owner.isError ? <div className="space-y-2"><p>Could not check card ownership.</p><Button type="button" variant="outline" onClick={() => void owner.refetch()}>Retry</Button></div> : ownsCard ? "Ready to get an estimate." : hasLoan ? "This card is in an active loan." : "Only the card owner can borrow against it."}</div>
          <div className="flex items-center justify-between gap-3"><Button type="button" variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="size-4" aria-hidden="true" />Back</Button><Button type="button" disabled={!selected} onClick={() => setStep(2)}>See card value<ArrowRight className="size-4" aria-hidden="true" /></Button></div>
        </CardContent>
      </Card> : null}

      {step === 2 ? <Card>
        <CardHeader><CardTitle className="text-2xl">Your card value</CardTitle><p className="text-sm text-muted-foreground">This test estimate determines your loan offer.</p></CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md bg-secondary/40 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Estimated value</p><Badge variant="outline">Test estimate</Badge></div>
            {priceBusy ? <div aria-busy="true" className="mt-4 space-y-3"><div className="h-9 w-40 animate-pulse rounded bg-muted" /><div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" /></div> : price ? <><p className="mt-3 text-4xl font-semibold tabular-nums">{formatUsdc(price.assumedValueMicroUsdc)}</p><p className="mt-2 text-sm text-muted-foreground">Updated {new Date(price.assumptionRecordedAt).toLocaleDateString()}.</p></> : <p className="mt-3 text-sm text-muted-foreground">Get an estimate to continue.</p>}
          </div>
          {price && !price.freshForSignedQuote ? <p role="status" className="text-sm text-warning-foreground">This estimate has expired. A new appraisal is needed before you can borrow.</p> : null}
          {priceError ? <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{priceError} Try fetching the price again.</p> : null}
          <Button type="button" variant={price ? "outline" : "default"} onClick={() => void fetchDemoPrice()} disabled={priceBusy} aria-busy={priceBusy}><RefreshCw className="size-4" aria-hidden="true" />{priceBusy ? "Getting estimate…" : price ? "Refresh estimate" : "Get estimate"}</Button>
          <RealyseMarketSignal />
          <div className="flex items-center justify-between gap-3 border-t border-border pt-5"><Button type="button" variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="size-4" aria-hidden="true" />Back</Button><Button type="button" disabled={!price} onClick={() => setStep(3)}>Review loan<ArrowRight className="size-4" aria-hidden="true" /></Button></div>
        </CardContent>
      </Card> : null}

      {step === 3 ? <Card>
        <CardHeader><CardTitle className="text-2xl">{hasLoan ? "Manage your loan" : "Your loan offer"}</CardTitle>{!hasLoan ? <p className="text-sm text-muted-foreground">Review the terms, verify your identity, and confirm in your wallet.</p> : null}</CardHeader>
        <CardContent className="space-y-6">
          {!hasLoan && price && principal !== null && interest !== null ? <><div className="rounded-md bg-secondary p-5"><p className="text-sm text-muted-foreground">You could borrow</p><p className="mt-1 text-4xl font-semibold tabular-nums">{formatUsdc(principal)}</p><p className="mt-1 text-sm text-muted-foreground">Test MockUSDC · Sepolia</p></div>
            <dl className="space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Test card estimate</dt><dd className="font-medium tabular-nums">{formatUsdc(price.assumedValueMicroUsdc)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Maximum LTV</dt><dd className="font-medium">35%, capped at $3,500</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Fixed APR</dt><dd className="font-medium">20%</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Term + grace</dt><dd className="font-medium">{TERM_DAYS.toString()} + {GRACE_DAYS.toString()} days</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Interest at maturity</dt><dd className="font-medium tabular-nums">{formatUsdc(interest)}</dd></div><div className="flex justify-between gap-4 border-t border-border pt-3"><dt className="font-medium">Total at maturity</dt><dd className="font-semibold tabular-nums">{formatUsdc(principal + interest)}</dd></div></dl>
            {!price.freshForSignedQuote ? <p role="status" className="text-sm text-warning-foreground">This estimate has expired. A new appraisal is needed before you can borrow.</p> : null}</> : null}
          <div className="border-t border-border pt-5">{onSepolia ? <BorrowActions key={address} cardId={asset.id} tokenId={asset.tokenId} expectedValueMicroUsdc={price?.assumedValueMicroUsdc} worldConfig={worldConfig} /> : <div className="space-y-3"><p className="text-sm text-muted-foreground">Connect the card owner wallet on Sepolia to continue.</p><WalletButton />{isConnected ? <Button type="button" variant="outline" onClick={() => void switchToSepolia()} disabled={switchingNetwork}>{switchingNetwork ? "Switching…" : "Switch to Sepolia"}</Button> : null}{networkError ? <p role="alert" className="text-sm text-destructive">{networkError}</p> : null}</div>}</div>
          <Button type="button" variant="ghost" onClick={() => setStep(hasLoan ? 0 : 2)}><ArrowLeft className="size-4" aria-hidden="true" />Back</Button>
        </CardContent>
      </Card> : null}
    </div>

    <aside className="lg:sticky lg:top-24"><Card><CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
      <div className="flex items-start justify-between gap-3 border-t border-border pt-4"><span className="text-muted-foreground">Wallet</span><span className="max-w-40 truncate text-right font-medium">{address && onSepolia ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected"}</span></div>
      <div className="flex items-start justify-between gap-3 border-t border-border pt-4"><span className="text-muted-foreground">Collateral</span><span className="max-w-40 text-right font-medium">{selected ? `${asset.name} · ${asset.grader} ${asset.grade}` : "Not selected"}</span></div>
      <div className="flex items-start justify-between gap-3 border-t border-border pt-4"><span className="text-muted-foreground">Test estimate</span><span className="font-semibold tabular-nums">{value === null ? "—" : formatUsdc(value)}</span></div>
      <div className="flex items-start justify-between gap-3 border-t border-border pt-4"><span className="text-muted-foreground">Max loan</span><span className="font-semibold tabular-nums">{principal === null ? "—" : formatUsdc(principal)}</span></div>
      <p className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">Test funds only. Physical custody is simulated.</p>
    </CardContent></Card></aside>
  </div>;
}
