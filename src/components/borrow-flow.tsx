"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Flame, RefreshCw } from "lucide-react";
import { useAccount, useReadContract, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BorrowActions } from "@/components/borrow-actions";
import { WalletButton } from "@/components/wallet-button";
import { abis, contracts, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { cardCustodyStatus } from "@/lib/card-custody";
import type { DemoPrice } from "@/lib/demo-price";
import { formatUsdc, GRACE_DAYS, maximumPrincipal, simpleInterest, TERM_DAYS } from "@/lib/loan-math";

type Asset = { id: string; name: string; setName: string; year: number; grader: string; grade: string; certificationNumber: string; tokenId: string | null };
type WorldConfig = { appId: string; rpId: string; environment: "production" | "staging" } | null;
const maximumDemoPrincipal = 3_500_000_000n;

export function BorrowFlow({ asset, worldConfig }: { asset: Asset; worldConfig: WorldConfig }) {
  const [view, setView] = useState<"card" | "offer">("card");
  const [price, setPrice] = useState<DemoPrice | null>(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [networkError, setNetworkError] = useState("");
  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync, isPending: switchingNetwork } = useSwitchChain();
  const onSepolia = isConnected && chainId === SEPOLIA_CHAIN_ID;
  const tokenId = asset.tokenId ? BigInt(asset.tokenId) : 0n;
  const custody = useReadContract({ address: contracts.card, abi: abis.card, functionName: "cardDetails", args: [tokenId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: Boolean(asset.tokenId && contracts.card), refetchInterval: 15_000 } });
  const loanId = useReadContract({ address: contracts.manager, abi: abis.manager, functionName: "activeLoanForToken", args: [tokenId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: onSepolia && Boolean(asset.tokenId && contracts.manager), refetchInterval: 15_000 } });
  const hasLoan = typeof loanId.data === "bigint" && loanId.data > 0n;
  const activeLoan = useReadContract({ address: contracts.manager, abi: abis.manager, functionName: "loans", args: [typeof loanId.data === "bigint" ? loanId.data : 0n], chainId: SEPOLIA_CHAIN_ID, query: { enabled: onSepolia && hasLoan, refetchInterval: 15_000 } });
  const isBorrower = Boolean(address && Array.isArray(activeLoan.data) && typeof activeLoan.data[0] === "string" && activeLoan.data[0].toLowerCase() === address.toLowerCase());
  const custodyStatus = cardCustodyStatus(custody.data);
  const canBorrowAgainstCard = custodyStatus === 1 || custodyStatus === 3;
  const value = price ? BigInt(price.assumedValueMicroUsdc) : null;
  const ltvPrincipal = value === null ? null : maximumPrincipal(value);
  const principal = ltvPrincipal === null ? null : ltvPrincipal > maximumDemoPrincipal ? maximumDemoPrincipal : ltvPrincipal;
  const interest = principal === null ? null : simpleInterest(principal, TERM_DAYS * 24n * 60n * 60n);

  async function switchToSepolia() {
    setNetworkError("");
    try { await switchChainAsync({ chainId: SEPOLIA_CHAIN_ID }); }
    catch { setNetworkError("Your wallet did not switch networks. Open it and select Sepolia, then retry."); }
  }

  async function fetchDemoPrice() {
    if (priceBusy) return;
    setPriceBusy(true);
    setPriceError("");
    try {
      const response = await fetch(`/api/demo-price?cardId=${encodeURIComponent(asset.id)}`, { cache: "no-store" });
      const body = await response.json() as DemoPrice & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not get an estimate.");
      if (body.cardId !== asset.id || body.source !== "mock-realyse" || !Number.isSafeInteger(body.assumedValueMicroUsdc) || body.assumedValueMicroUsdc <= 0) throw new Error("The estimate did not match this card.");
      setPrice(body);
    } catch (error) {
      setPrice(null);
      setPriceError(error instanceof Error ? error.message : "Could not get an estimate.");
    } finally { setPriceBusy(false); }
  }

  return <div className="mx-auto max-w-2xl">
    {view === "card" ? <Card>
      <CardHeader className="border-b border-border">
        <CardTitle className="text-2xl">{asset.year} {asset.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{asset.setName} · {asset.grader} {asset.grade}</p>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="flex items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-md bg-secondary"><Flame className="size-9 text-foreground" aria-hidden="true" /></div>
          <p className="min-w-0 break-all text-sm text-muted-foreground">Certificate {asset.certificationNumber}</p>
        </div>
        {hasLoan && isBorrower ? <Button type="button" className="w-full" onClick={() => setView("offer")}>Manage your loan<ArrowRight className="size-4" aria-hidden="true" /></Button> : null}
        {custodyStatus === 4 ? <p role="status" className="text-sm text-destructive">This card was liquidated and cannot back another loan.</p> : null}
        {custody.isError ? <p role="alert" className="text-sm text-destructive">Could not check this card’s custody status. Try again shortly.</p> : null}
        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">Estimated card value</p>
          {priceBusy ? <div aria-busy="true" className="mt-3 space-y-3"><div className="h-10 w-44 animate-pulse rounded bg-muted" /><div className="h-4 w-32 animate-pulse rounded bg-muted" /></div>
            : price ? <><p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{formatUsdc(price.assumedValueMicroUsdc)}</p><p className="mt-1 text-sm text-muted-foreground">Test estimate · {new Date(price.assumptionRecordedAt).toLocaleDateString()}</p></>
            : <p className="mt-1 text-4xl font-semibold tracking-tight" aria-label="Estimate not available">—</p>}
        </div>
        {price && !price.freshForSignedQuote ? <p role="status" className="text-sm text-warning-foreground">This estimate has expired. A new appraisal is needed before borrowing.</p> : null}
        {priceError ? <p role="alert" className="text-sm text-destructive">{priceError} Please try again.</p> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant={price ? "outline" : "default"} onClick={() => void fetchDemoPrice()} disabled={priceBusy} aria-busy={priceBusy}><RefreshCw className="size-4" aria-hidden="true" />{priceBusy ? "Getting estimate…" : price ? "Refresh estimate" : "Get estimate"}</Button>
          {price && !hasLoan ? <Button type="button" onClick={() => setView("offer")} disabled={!canBorrowAgainstCard}>Review offer<ArrowRight className="size-4" aria-hidden="true" /></Button> : null}
        </div>
      </CardContent>
    </Card> : <Card>
      <CardHeader className="border-b border-border"><CardTitle className="text-2xl">{hasLoan && isBorrower ? "Your loan" : "Loan offer"}</CardTitle></CardHeader>
      <CardContent className="space-y-6 pt-6">
        {hasLoan && !isBorrower ? <p className="text-sm text-muted-foreground">This card is currently in a loan.</p> : null}
        {!hasLoan && price && principal !== null && interest !== null ? <>
          <div><p className="text-sm text-muted-foreground">You could borrow</p><p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">{formatUsdc(principal)}</p><p className="mt-2 text-sm text-muted-foreground">MockUSDC on Sepolia · test funds</p></div>
          <dl className="divide-y divide-border border-y border-border text-sm">
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Card value</dt><dd className="font-medium tabular-nums">{formatUsdc(price.assumedValueMicroUsdc)}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Loan to value</dt><dd className="font-medium">35%, capped at $3,500</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Fixed APR</dt><dd className="font-medium">20%</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Term and grace</dt><dd className="font-medium">{TERM_DAYS.toString()} + {GRACE_DAYS.toString()} days</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Interest at maturity</dt><dd className="font-medium tabular-nums">{formatUsdc(interest)}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="font-semibold">Total at maturity</dt><dd className="font-semibold tabular-nums">{formatUsdc(principal + interest)}</dd></div>
          </dl>
          {!price.freshForSignedQuote ? <p role="status" className="text-sm text-warning-foreground">This estimate has expired. A new appraisal is needed before borrowing.</p> : null}
        </> : null}
        {(!hasLoan || isBorrower) ? onSepolia ? <BorrowActions key={address} cardId={asset.id} tokenId={asset.tokenId} custodyStatus={custodyStatus} expectedValueMicroUsdc={price?.assumedValueMicroUsdc} worldConfig={worldConfig} /> : <div className="space-y-3"><WalletButton />{isConnected ? <Button type="button" variant="outline" onClick={() => void switchToSepolia()} disabled={switchingNetwork}>{switchingNetwork ? "Switching…" : "Switch to Sepolia"}</Button> : null}{networkError ? <p role="alert" className="text-sm text-destructive">{networkError}</p> : null}</div> : null}
        <Button type="button" variant="ghost" onClick={() => setView("card")}><ArrowLeft className="size-4" aria-hidden="true" />Back to card</Button>
      </CardContent>
    </Card>}
  </div>;
}
