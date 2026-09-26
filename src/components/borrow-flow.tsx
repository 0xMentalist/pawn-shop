"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import type { Address } from "viem";
import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient, useReadContract, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BorrowAmountInput } from "@/components/borrow-amount-input";
import { BorrowActions } from "@/components/borrow-actions";
import { WalletButton } from "@/components/wallet-button";
import { BrandMark } from "@/components/brand-mark";
import { abis, contracts, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { cardCustodyStatus } from "@/lib/card-custody";
import type { DemoPrice } from "@/lib/demo-price";
import { borrowCostBpsForPeriod, borrowLimit, formatUsdc, GRACE_DAYS, LOAN_TERMS_DAYS, parseBorrowAmount, simpleInterest, type LoanTermDays } from "@/lib/loan-math";
import { cardBelongsToWallet } from "@/lib/wallet-cards";

type Asset = { id: string; name: string; setName: string; printing: string; year: number; grader: string; grade: string; psaReferenceNumber: string; tokenId: string | null; imageUrl: string; saleObservedAt: string; saleSourceUrl: string; priceSource: DemoPrice["source"]; valueMicroUsdc: number };
type WalletAsset = Asset & { previousManager?: Address };
type WorldConfig = { appId: string; rpId: string; environment: "production" | "staging" } | null;

export function BorrowFlow({ assets, worldConfig }: { assets: Asset[]; worldConfig: WorldConfig }) {
  const { address, isConnected, status } = useAccount();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const inventory = useQuery({
    queryKey: ["wallet-cards", address?.toLowerCase(), contracts.legacyManagers.join(","), assets.map((asset) => `${asset.id}:${asset.tokenId}`).join("|")],
    enabled: isConnected && Boolean(address && publicClient && contracts.card && contracts.manager),
    refetchInterval: 15_000,
    queryFn: async () => {
      const cardAddress = contracts.card;
      const managerAddress = contracts.manager;
      const legacyManagers = contracts.legacyManagers.filter((manager) => manager.toLowerCase() !== managerAddress?.toLowerCase());
      if (!address || !publicClient || !cardAddress || !managerAddress) throw new Error("Card service unavailable.");
      const matches = await Promise.all(assets.map(async (asset) => {
        if (!asset.tokenId) return null;
        const tokenId = BigInt(asset.tokenId);
        const [owner, loanId, legacyLoanIds] = await Promise.all([
          publicClient.readContract({ address: cardAddress, abi: abis.card, functionName: "ownerOf", args: [tokenId] }),
          publicClient.readContract({ address: managerAddress, abi: abis.manager, functionName: "activeLoanForToken", args: [tokenId] }),
          Promise.all(legacyManagers.map((manager) => publicClient.readContract({ address: manager, abi: abis.manager, functionName: "activeLoanForToken", args: [tokenId] }))),
        ]);
        const loan = typeof loanId === "bigint" && loanId > 0n
          ? await publicClient.readContract({ address: managerAddress, abi: abis.manager, functionName: "loans", args: [loanId] })
          : null;
        if (cardBelongsToWallet(address, owner, loan)) return { id: asset.id };
        const legacyLoans = await Promise.all(legacyLoanIds.map((legacyLoanId, index) => typeof legacyLoanId === "bigint" && legacyLoanId > 0n
          ? publicClient.readContract({ address: legacyManagers[index], abi: abis.manager, functionName: "loans", args: [legacyLoanId] })
          : Promise.resolve(null)));
        const legacyIndex = legacyLoans.findIndex((legacyLoan) => cardBelongsToWallet(address, owner, legacyLoan));
        if (legacyIndex >= 0) return { id: asset.id, previousManager: legacyManagers[legacyIndex] };
        return null;
      }));
      return matches.filter((match): match is { id: string; previousManager?: Address } => match !== null);
    },
  });

  if (status === "reconnecting" || (isConnected && !address)) return <div className="mx-auto max-w-xl py-20 text-center"><h1 className="font-display text-4xl font-semibold">Your cards</h1><p className="mt-3 text-muted-foreground">Finding your wallet…</p></div>;
  if (!isConnected) return <div className="mx-auto max-w-3xl py-12 text-center md:py-24"><BrandMark className="mx-auto mb-8 size-14" /><h1 className="font-display text-4xl font-semibold leading-tight md:text-6xl">Your cards. More possibilities.</h1><p className="mx-auto mt-5 max-w-lg text-lg leading-7 text-muted-foreground">Get a loan on your cards or earn by lending to fellow collectors.</p><div className="mt-8 flex justify-center"><WalletButton /></div><Link href="/earn" className="mt-5 inline-flex min-h-10 items-center text-sm font-semibold text-primary underline underline-offset-4 hover:text-foreground">Explore lending<ArrowRight className="ml-2 size-4" aria-hidden="true" /></Link></div>;
  if (!contracts.card || !contracts.manager || !publicClient) return <div className="py-16 text-center"><h1 className="font-display text-4xl font-semibold">Your cards</h1><p role="alert" className="mt-4 text-muted-foreground">The card service is temporarily unavailable.</p></div>;
  if (inventory.isPending) return <div className="py-16 text-center" aria-busy="true"><h1 className="font-display text-4xl font-semibold">Your cards</h1><p className="mt-4 text-muted-foreground">Checking cards on Sepolia…</p></div>;
  if (inventory.isError) return <div className="py-16 text-center"><h1 className="font-display text-4xl font-semibold">Your cards</h1><p role="alert" className="mt-4 text-muted-foreground">Could not check your cards on Sepolia.</p><Button type="button" variant="outline" className="mt-6" onClick={() => void inventory.refetch()}>Try again</Button></div>;

  const walletAssets: WalletAsset[] = assets.flatMap((asset) => { const match = inventory.data.find((item) => item.id === asset.id); return match ? [{ ...asset, previousManager: match.previousManager }] : []; });
  if (walletAssets.length === 0) return <div className="mx-auto max-w-xl py-16 text-center md:py-24"><h1 className="font-display text-4xl font-semibold">No cards in this wallet.</h1><p className="mt-4 text-muted-foreground">We could not find a supported vaulted card owned by this wallet or backing one of its active loans.</p></div>;

  return <BorrowCollection key={address.toLowerCase()} assets={walletAssets} worldConfig={worldConfig} />;
}

function BorrowCollection({ assets, worldConfig }: { assets: WalletAsset[]; worldConfig: WorldConfig }) {
  const [selectedId, setSelectedId] = useState(assets[0]?.id);
  const [direction, setDirection] = useState<"next" | "previous" | "none">("none");
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userScrollingRef = useRef(false);
  const selected = assets.find((asset) => asset.id === selectedId) ?? assets[0];
  const selectedIndex = Math.max(0, assets.findIndex((asset) => asset.id === selected?.id));

  useEffect(() => {
    if (!assets.some((asset) => asset.id === selectedId)) setSelectedId(assets[0]?.id);
  }, [assets, selectedId]);
  useEffect(() => () => { if (scrollEndRef.current) clearTimeout(scrollEndRef.current); }, []);

  function selectCard(index: number, focus = false) {
    const next = assets[index];
    if (!next) return;
    if (scrollEndRef.current) clearTimeout(scrollEndRef.current);
    if (index !== selectedIndex) setDirection(index > selectedIndex ? "next" : "previous");
    setSelectedId(next.id);
    userScrollingRef.current = false;
    const track = trackRef.current;
    const card = track?.querySelectorAll<HTMLButtonElement>("[data-collection-card]")[index];
    if (!track || !card) return;
    const offset = card.getBoundingClientRect().left - track.getBoundingClientRect().left - 4;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    track.scrollTo({ left: track.scrollLeft + offset, behavior });
    if (focus) card.focus();
  }

  function onUserScroll() {
    if (!userScrollingRef.current || !trackRef.current) return;
    if (scrollEndRef.current) clearTimeout(scrollEndRef.current);
    scrollEndRef.current = setTimeout(() => {
      if (!userScrollingRef.current) return;
      const track = trackRef.current;
      if (!track) return;
      const cards = [...track.querySelectorAll<HTMLButtonElement>("[data-collection-card]")];
      const anchor = track.getBoundingClientRect().left + (cards[0]?.clientWidth ?? 0) / 2 + 4;
      const nearest = cards.reduce((best, card, index) => {
        const distance = Math.abs(card.getBoundingClientRect().left + card.clientWidth / 2 - anchor);
        return distance < best.distance ? { index, distance } : best;
      }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
      if (nearest !== selectedIndex) {
        setDirection(nearest > selectedIndex ? "next" : "previous");
        setSelectedId(assets[nearest].id);
      }
      userScrollingRef.current = false;
    }, 120);
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">Your cards</h1>
      <div className="flex items-center gap-2" aria-label="Card carousel controls">
        <span className="font-serial mr-2 text-sm tabular-nums text-muted-foreground">{String(selectedIndex + 1).padStart(2, "0")} / {String(assets.length).padStart(2, "0")}</span>
        <Button type="button" variant="outline" className="size-11 min-h-11 px-0" aria-label="Previous card" aria-controls="collection-carousel" disabled={selectedIndex === 0} onClick={() => selectCard(selectedIndex - 1)}><ArrowLeft className="size-4" aria-hidden="true" /></Button>
        <Button type="button" variant="outline" className="size-11 min-h-11 px-0" aria-label="Next card" aria-controls="collection-carousel" disabled={selectedIndex === assets.length - 1} onClick={() => selectCard(selectedIndex + 1)}><ArrowRight className="size-4" aria-hidden="true" /></Button>
      </div>
    </div>
    <div id="collection-carousel" ref={trackRef} className="collection-carousel-track -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-5 pt-2 md:mx-0 md:px-1" role="group" aria-roledescription="carousel" aria-label="Your cards" onPointerDown={() => { userScrollingRef.current = true; }} onWheel={() => { userScrollingRef.current = true; }} onScroll={onUserScroll}>
      {assets.map((asset, index) => <button key={asset.id} data-collection-card type="button" aria-pressed={selected?.id === asset.id} aria-label={`Select ${asset.name}, PSA ${asset.grade}, ${asset.priceSource === "psa-price-guide" ? "PSA guide estimate" : "comparable sale"} ${formatUsdc(asset.valueMicroUsdc)}`} onClick={() => selectCard(index)} onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          selectCard(Math.max(0, Math.min(assets.length - 1, index + (event.key === "ArrowRight" ? 1 : -1))), true);
        }
      }} className={`collection-slot group w-64 shrink-0 snap-start rounded-2xl border p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-72 ${selected?.id === asset.id ? "border-primary bg-card shadow-lg" : "border-border bg-card hover:border-primary"}`}>
        <span className="flex h-44 items-center justify-center rounded-xl bg-secondary p-3"><img src={asset.imageUrl} alt="" className="collection-art h-full w-auto max-w-full object-contain drop-shadow-sm" /></span>
        <span className="block px-2 pb-2 pt-4"><span className="block truncate font-display text-xl font-semibold leading-tight">{asset.name}</span><span className="mt-1 block text-xs text-muted-foreground">{asset.year} · {asset.setName} · PSA {asset.grade}</span><span className="mt-4 block text-lg font-semibold tabular-nums">{formatUsdc(asset.valueMicroUsdc)}</span><span className="font-serial mt-1 block text-xs text-muted-foreground">{asset.priceSource === "psa-price-guide" ? "PSA GUIDE" : `PSA REF #${asset.psaReferenceNumber}`}</span></span>
      </button>)}
    </div>
    <p className="sr-only" aria-live="polite">{selected?.name}, card {selectedIndex + 1} of {assets.length}</p>
    {selected ? <div key={selected.id} className="collection-detail" data-direction={direction}><BorrowDetail asset={selected} worldConfig={worldConfig} /></div> : null}
  </div>;
}

function BorrowDetail({ asset, worldConfig }: { asset: WalletAsset; worldConfig: WorldConfig }) {
  const [view, setView] = useState<"card" | "offer" | "confirm">("card");
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  const [price, setPrice] = useState<DemoPrice | null>(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [networkError, setNetworkError] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [termDays, setTermDays] = useState<LoanTermDays | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync, isPending: switchingNetwork } = useSwitchChain();
  const onSepolia = isConnected && chainId === SEPOLIA_CHAIN_ID;
  const managerAddress = asset.previousManager ?? contracts.manager;
  const tokenId = asset.tokenId ? BigInt(asset.tokenId) : 0n;
  const custody = useReadContract({ address: contracts.card, abi: abis.card, functionName: "cardDetails", args: [tokenId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: Boolean(asset.tokenId && contracts.card), refetchInterval: 15_000 } });
  const loanId = useReadContract({ address: managerAddress, abi: abis.manager, functionName: "activeLoanForToken", args: [tokenId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: onSepolia && Boolean(asset.tokenId && managerAddress), refetchInterval: 15_000 } });
  const hasLoan = typeof loanId.data === "bigint" && loanId.data > 0n;
  const activeLoan = useReadContract({ address: managerAddress, abi: abis.manager, functionName: "loans", args: [typeof loanId.data === "bigint" ? loanId.data : 0n], chainId: SEPOLIA_CHAIN_ID, query: { enabled: onSepolia && hasLoan, refetchInterval: 15_000 } });
  const isBorrower = Boolean(address && Array.isArray(activeLoan.data) && typeof activeLoan.data[0] === "string" && activeLoan.data[0].toLowerCase() === address.toLowerCase());
  const custodyStatus = cardCustodyStatus(custody.data);
  const canBorrowAgainstCard = custodyStatus === 1 || custodyStatus === 3 || custodyStatus === 4;
  const value = price ? BigInt(price.lastSaleMicroUsdc) : null;
  const maximumAmount = value === null ? null : borrowLimit(value);
  const enteredAmount = parseBorrowAmount(borrowAmount);
  const principal = enteredAmount !== null && maximumAmount !== null && enteredAmount > 0n && enteredAmount <= maximumAmount ? enteredAmount : null;
  const termSeconds = termDays === null ? null : BigInt(termDays) * 24n * 60n * 60n;
  const interest = principal === null || termSeconds === null ? null : simpleInterest(principal, termSeconds);
  const periodCostBps = termSeconds === null ? null : borrowCostBpsForPeriod(termSeconds);

  useEffect(() => { if (view !== "card") stepTitleRef.current?.focus(); }, [view]);

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
      if (body.cardId !== asset.id || body.source !== asset.priceSource || !Number.isSafeInteger(body.lastSaleMicroUsdc) || body.lastSaleMicroUsdc !== asset.valueMicroUsdc || body.saleSourceUrl !== asset.saleSourceUrl) throw new Error("The estimate did not match this card.");
      setPrice(body);
      if (body.freshForSignedQuote) setView("offer");
    } catch (error) {
      setPrice(null);
      setPriceError(error instanceof Error ? error.message : "Could not get an estimate.");
    } finally { setPriceBusy(false); }
  }

  return <div>
    {view === "card" ? <section className="grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-2">
      <div className="hero-stage flex min-h-80 flex-col items-center justify-center px-6 py-8 lg:min-h-[32rem]"><img src={asset.imageUrl} alt={`${asset.name} ${asset.printing} card artwork`} className="max-h-96 w-auto max-w-full object-contain drop-shadow-lg" /></div>
      <div className="flex flex-col p-6 md:p-8 lg:p-10">
        <h2 className="font-display text-4xl font-semibold leading-tight md:text-5xl">{asset.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{asset.year} {asset.setName} · {asset.printing} · {asset.grader} {asset.grade}</p>
        <div className="mt-8 border-t pt-6"><p className="text-sm text-muted-foreground">{asset.priceSource === "psa-price-guide" ? "PSA guide estimate" : "Last recorded auction sale"}</p><p className="font-display mt-1 text-5xl font-semibold tabular-nums">{formatUsdc(asset.valueMicroUsdc)}</p><p className="mt-1 text-sm text-muted-foreground">{asset.priceSource === "psa-price-guide" ? "Guide snapshot" : "Sold"} {new Date(asset.saleObservedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</p></div>
        <dl className="mt-7 border-t pt-6 text-sm"><div className="flex flex-wrap items-baseline justify-between gap-2"><dt className="text-muted-foreground">{asset.priceSource === "psa-price-guide" ? "Price source" : "Comparable PSA reference"}</dt><dd><a aria-label={asset.priceSource === "psa-price-guide" ? "View PSA price guide" : `View comparable PSA certificate ${asset.psaReferenceNumber}`} className="font-serial inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4 hover:text-foreground" href={asset.saleSourceUrl} target="_blank" rel="noopener noreferrer">{asset.priceSource === "psa-price-guide" ? "PSA price guide" : `#${asset.psaReferenceNumber}`}<ExternalLink className="size-3" aria-hidden="true" /></a></dd></div></dl>
        <div className="mt-auto pt-8">
          {hasLoan && isBorrower ? <Button type="button" className="w-full" onClick={() => setView("offer")}>Manage your loan<ArrowRight className="size-4" aria-hidden="true" /></Button> : null}
          {custody.isError ? <p role="alert" className="text-sm text-destructive">Could not check this card’s custody status. Try again shortly.</p> : null}
          {price && !price.freshForSignedQuote ? <p role="status" className="mb-3 text-sm text-warning-foreground">This PSA estimate is too old for a loan quote.</p> : null}
          {priceError ? <p role="alert" className="mb-3 text-sm text-destructive">{priceError} Please try again.</p> : null}
          {!hasLoan ? <Button type="button" className="w-full" onClick={() => void fetchDemoPrice()} disabled={priceBusy || !canBorrowAgainstCard || custody.isPending} aria-busy={priceBusy}>{priceBusy ? "Checking estimate…" : custody.isPending ? "Checking card…" : "See loan offer"}<ArrowRight className="size-4" aria-hidden="true" /></Button> : null}
        </div>
      </div>
    </section> : <Card className="mx-auto max-w-2xl">
      <CardHeader className="border-b border-border"><Button type="button" variant="ghost" className="mb-3 self-start px-0" disabled={actionBusy} onClick={() => setView(view === "confirm" && !hasLoan ? "offer" : "card")}><ArrowLeft className="size-4" aria-hidden="true" />{view === "confirm" && !hasLoan ? "Edit offer" : "Back to card"}</Button><CardTitle ref={stepTitleRef} tabIndex={-1} className="font-display text-3xl focus:outline-none">{hasLoan && isBorrower ? "Your loan" : view === "confirm" ? "Confirm & deposit" : "Loan offer"}</CardTitle><p className="text-sm text-muted-foreground">{asset.name} · PSA {asset.grade} · {asset.priceSource === "psa-price-guide" ? "PSA guide estimate" : `Comparable #${asset.psaReferenceNumber}`}</p></CardHeader>
      <CardContent className="space-y-6 pt-6">
        {hasLoan && !isBorrower ? <p className="text-sm text-muted-foreground">This card is currently in a loan.</p> : null}
        {view === "offer" && !hasLoan && price && maximumAmount !== null ? <>
          <div className="rounded-2xl bg-secondary px-5 py-6"><p className="text-sm text-muted-foreground">Maximum borrow amount</p><p className="font-display mt-1 text-5xl font-semibold tabular-nums">{formatUsdc(maximumAmount)}</p></div>
          <BorrowAmountInput id={`borrow-amount-${asset.id}`} value={borrowAmount} maximumAmount={maximumAmount} valid={principal !== null} disabled={actionBusy} onChange={setBorrowAmount} />
          <fieldset disabled={actionBusy} className="space-y-3"><legend className="text-sm font-semibold">Loan term</legend><div className="grid grid-cols-3 gap-2">{LOAN_TERMS_DAYS.map((days) => <Button key={days} type="button" variant={termDays === days ? "default" : "outline"} aria-pressed={termDays === days} onClick={() => setTermDays(days)} className="w-full">{days} days</Button>)}</div></fieldset>
          <dl className="divide-y divide-border border-y border-border text-sm">
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{asset.priceSource === "psa-price-guide" ? "PSA guide estimate" : "Last auction sale"}</dt><dd className="font-medium tabular-nums">{formatUsdc(price.lastSaleMicroUsdc)}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Borrow limit</dt><dd className="font-medium">35% of estimate, up to $3,500</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Borrow APR</dt><dd className="font-medium">20%</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Interest for {termDays === null ? "selected term" : `${termDays} days`}</dt><dd className="font-medium tabular-nums">{periodCostBps === null ? "—" : `${(Number(periodCostBps) / 100).toFixed(2)}%`}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Grace after due date</dt><dd className="font-medium">{GRACE_DAYS.toString()} days</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Interest at maturity</dt><dd className="font-medium tabular-nums">{interest === null ? "—" : formatUsdc(interest)}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="font-semibold">Total at maturity</dt><dd className="font-semibold tabular-nums">{principal === null || interest === null ? "—" : formatUsdc(principal + interest)}</dd></div>
          </dl>
          {!price.freshForSignedQuote ? <p role="status" className="text-sm text-warning-foreground">This PSA estimate is too old for a loan quote.</p> : null}
          <Button type="button" className="w-full" disabled={principal === null || termDays === null || !price.freshForSignedQuote} onClick={() => setView("confirm")}>Next: confirm & deposit<ArrowRight className="size-4" aria-hidden="true" /></Button>
        </> : null}
        {view === "confirm" && !hasLoan && principal !== null && termDays !== null && interest !== null ? <>
          <div><p className="text-sm text-muted-foreground">You’re borrowing</p><p className="font-display mt-1 text-5xl font-semibold tabular-nums">{formatUsdc(principal)}</p></div>
          <dl className="divide-y divide-border border-y border-border text-sm">
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Card to deposit</dt><dd className="text-right font-medium">{asset.name} · PSA {asset.grade}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Term</dt><dd className="font-medium">{termDays} days + {GRACE_DAYS.toString()} grace</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Borrow APR</dt><dd className="font-medium">20%</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Interest at maturity</dt><dd className="font-medium tabular-nums">{formatUsdc(interest)}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="font-semibold">Total at maturity</dt><dd className="font-semibold tabular-nums">{formatUsdc(principal + interest)}</dd></div>
          </dl>
          <p className="text-sm text-muted-foreground">Your card moves into escrow when the loan opens and returns after repayment. Your wallet may ask you to approve the card transfer first.</p>
        </> : null}
        {(view === "confirm" || (hasLoan && isBorrower)) ? onSepolia ? <BorrowActions key={address} cardId={asset.id} tokenId={asset.tokenId} managerAddress={managerAddress} custodyStatus={custodyStatus} expectedValueMicroUsdc={price?.lastSaleMicroUsdc} principalMicroUsdc={principal} termDays={termDays} onBusyChange={setActionBusy} worldConfig={worldConfig} /> : <div className="space-y-3"><WalletButton />{isConnected ? <Button type="button" variant="outline" onClick={() => void switchToSepolia()} disabled={switchingNetwork}>{switchingNetwork ? "Switching…" : "Switch to Sepolia"}</Button> : null}{networkError ? <p role="alert" className="text-sm text-destructive">{networkError}</p> : null}</div> : null}
      </CardContent>
    </Card>}
  </div>;
}
