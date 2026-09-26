"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient, useReadContract, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BorrowActions } from "@/components/borrow-actions";
import { WalletButton } from "@/components/wallet-button";
import { abis, contracts, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { cardCustodyStatus } from "@/lib/card-custody";
import type { DemoPrice } from "@/lib/demo-price";
import { formatUsdc, GRACE_DAYS, maximumPrincipal, simpleInterest, TERM_DAYS } from "@/lib/loan-math";
import { cardBelongsToWallet } from "@/lib/wallet-cards";

type Asset = { id: string; name: string; setName: string; printing: string; year: number; grader: string; grade: string; certificationNumber: string; psaReferenceNumber: string; tokenId: string | null; imageUrl: string; saleObservedAt: string; saleSourceUrl: string; valueMicroUsdc: number };
type WorldConfig = { appId: string; rpId: string; environment: "production" | "staging" } | null;
const maximumDemoPrincipal = 3_500_000_000n;

export function BorrowFlow({ assets, worldConfig }: { assets: Asset[]; worldConfig: WorldConfig }) {
  const { address, isConnected, status } = useAccount();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const inventory = useQuery({
    queryKey: ["wallet-cards", address?.toLowerCase(), assets.map((asset) => `${asset.id}:${asset.tokenId}`).join("|")],
    enabled: isConnected && Boolean(address && publicClient && contracts.card && contracts.manager),
    refetchInterval: 15_000,
    queryFn: async () => {
      const cardAddress = contracts.card;
      const managerAddress = contracts.manager;
      if (!address || !publicClient || !cardAddress || !managerAddress) throw new Error("Card service unavailable.");
      const matches = await Promise.all(assets.map(async (asset) => {
        if (!asset.tokenId) return null;
        const tokenId = BigInt(asset.tokenId);
        const [owner, loanId] = await Promise.all([
          publicClient.readContract({ address: cardAddress, abi: abis.card, functionName: "ownerOf", args: [tokenId] }),
          publicClient.readContract({ address: managerAddress, abi: abis.manager, functionName: "activeLoanForToken", args: [tokenId] }),
        ]);
        const loan = typeof loanId === "bigint" && loanId > 0n
          ? await publicClient.readContract({ address: managerAddress, abi: abis.manager, functionName: "loans", args: [loanId] })
          : null;
        return cardBelongsToWallet(address, owner, loan) ? asset.id : null;
      }));
      return matches.filter((id): id is string => Boolean(id));
    },
  });

  if (status === "reconnecting" || (isConnected && !address)) return <div className="mx-auto max-w-xl py-20 text-center"><h1 className="font-display text-4xl font-semibold">Your cards</h1><p className="mt-3 text-muted-foreground">Finding your wallet…</p></div>;
  if (!isConnected) return <div className="mx-auto max-w-xl py-16 text-center md:py-24"><div className="font-serial mx-auto mb-8 flex size-14 items-center justify-center border border-primary text-2xl font-semibold text-primary" aria-hidden="true">C</div><h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">Your cards live here.</h1><p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">Connect your wallet to see the cards you own and any cards backing your active loans.</p><div className="mt-8 flex justify-center"><WalletButton /></div></div>;
  if (!contracts.card || !contracts.manager || !publicClient) return <div className="py-16 text-center"><h1 className="font-display text-4xl font-semibold">Your cards</h1><p role="alert" className="mt-4 text-muted-foreground">The card service is temporarily unavailable.</p></div>;
  if (inventory.isPending) return <div className="py-16 text-center" aria-busy="true"><h1 className="font-display text-4xl font-semibold">Your cards</h1><p className="mt-4 text-muted-foreground">Checking cards on Sepolia…</p></div>;
  if (inventory.isError) return <div className="py-16 text-center"><h1 className="font-display text-4xl font-semibold">Your cards</h1><p role="alert" className="mt-4 text-muted-foreground">Could not check your cards on Sepolia.</p><Button type="button" variant="outline" className="mt-6" onClick={() => void inventory.refetch()}>Try again</Button></div>;

  const walletAssets = assets.filter((asset) => inventory.data.includes(asset.id));
  if (walletAssets.length === 0) return <div className="mx-auto max-w-xl py-16 text-center md:py-24"><h1 className="font-display text-4xl font-semibold">No cards in this wallet.</h1><p className="mt-4 text-muted-foreground">We could not find a supported vaulted card owned by this wallet or backing one of its active loans.</p></div>;

  return <BorrowCollection key={address.toLowerCase()} assets={walletAssets} worldConfig={worldConfig} />;
}

function BorrowCollection({ assets, worldConfig }: { assets: Asset[]; worldConfig: WorldConfig }) {
  const [selectedId, setSelectedId] = useState(assets[0]?.id);
  const selected = assets.find((asset) => asset.id === selectedId) ?? assets[0];
  return <div className="space-y-6">
    <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">Pick your card.</h1>
    <div className="flex items-end justify-between gap-4 border-b pb-3"><h2 className="font-display text-2xl font-semibold">The collection</h2><span className="font-serial text-xs text-muted-foreground">{assets.length} CARDS</span></div>
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">{assets.map((asset) => <button key={asset.id} type="button" aria-pressed={selected?.id === asset.id} aria-label={`Select ${asset.name}, PSA ${asset.grade}, comparable PSA reference ${asset.psaReferenceNumber}, sale ${formatUsdc(asset.valueMicroUsdc)}`} onClick={() => setSelectedId(asset.id)} className={`collection-slot group w-40 shrink-0 snap-start rounded-md border p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-44 lg:min-w-0 lg:grow ${selected?.id === asset.id ? "border-primary bg-accent" : "border-border bg-card hover:border-primary"}`}>
      <span className="relative flex h-36 items-center justify-center bg-secondary p-2"><img src={asset.imageUrl} alt="" className="collection-art h-full w-auto max-w-full object-contain drop-shadow-sm" /><span className="font-serial absolute right-2 top-2 border border-border bg-card px-1.5 py-1 text-xs font-semibold text-foreground">PSA {asset.grade}</span></span>
      <span className="block px-1 pb-1 pt-3"><span className="block truncate font-display text-lg font-semibold leading-tight">{asset.name}</span><span className="mt-1 block text-xs text-muted-foreground">{asset.year} · {asset.setName}</span><span className="mt-3 block text-base font-semibold tabular-nums">{formatUsdc(asset.valueMicroUsdc)}</span><span className="font-serial mt-1 block text-xs text-muted-foreground">PSA REF #{asset.psaReferenceNumber}</span></span>
    </button>)}</div>
    {selected ? <BorrowDetail key={selected.id} asset={selected} worldConfig={worldConfig} /> : null}
  </div>;
}

function BorrowDetail({ asset, worldConfig }: { asset: Asset; worldConfig: WorldConfig }) {
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
  const value = price ? BigInt(price.lastSaleMicroUsdc) : null;
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
      if (body.cardId !== asset.id || body.source !== "psa-auction-comparable" || !Number.isSafeInteger(body.lastSaleMicroUsdc) || body.lastSaleMicroUsdc !== asset.valueMicroUsdc || body.saleSourceUrl !== asset.saleSourceUrl) throw new Error("The estimate did not match this card.");
      setPrice(body);
      if (body.freshForSignedQuote) setView("offer");
    } catch (error) {
      setPrice(null);
      setPriceError(error instanceof Error ? error.message : "Could not get an estimate.");
    } finally { setPriceBusy(false); }
  }

  return <div>
    {view === "card" ? <section className="grid overflow-hidden rounded-md border bg-card lg:grid-cols-2">
      <div className="flex min-h-80 flex-col items-center justify-center bg-secondary px-6 py-8 lg:min-h-[32rem]"><img src={asset.imageUrl} alt={`${asset.name} ${asset.printing} card artwork`} className="max-h-96 w-auto max-w-full object-contain drop-shadow-lg" /></div>
      <div className="flex flex-col p-6 md:p-8 lg:p-10">
        <div className="font-serial text-xs font-semibold uppercase tracking-widest text-primary">{asset.year} / {asset.setName}</div>
        <h2 className="font-display mt-3 text-4xl font-semibold leading-tight md:text-5xl">{asset.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{asset.printing} · {asset.grader} {asset.grade}</p>
        <div className="mt-8 border-t pt-6"><p className="text-sm text-muted-foreground">Last recorded auction sale</p><p className="font-display mt-1 text-5xl font-semibold tabular-nums">{formatUsdc(asset.valueMicroUsdc)}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(asset.saleObservedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</p></div>
        <dl className="mt-7 space-y-3 border-t pt-6 text-sm"><div className="flex flex-wrap items-baseline justify-between gap-2"><dt className="text-muted-foreground">Comparable PSA reference</dt><dd><a aria-label={`View comparable PSA certificate ${asset.psaReferenceNumber}`} className="font-serial inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4 hover:text-foreground" href={asset.saleSourceUrl} target="_blank" rel="noopener noreferrer">#{asset.psaReferenceNumber}<ExternalLink className="size-3" aria-hidden="true" /></a></dd></div><div className="flex flex-wrap items-baseline justify-between gap-2"><dt className="text-muted-foreground">Demo receipt</dt><dd className="font-serial">{asset.certificationNumber}</dd></div></dl>
        <div className="mt-auto pt-8">
          {hasLoan && isBorrower ? <Button type="button" className="w-full" onClick={() => setView("offer")}>Manage your loan<ArrowRight className="size-4" aria-hidden="true" /></Button> : null}
          {custodyStatus === 4 ? <p role="status" className="text-sm text-destructive">This card was liquidated and cannot back another loan.</p> : null}
          {custody.isError ? <p role="alert" className="text-sm text-destructive">Could not check this card’s custody status. Try again shortly.</p> : null}
          {price && !price.freshForSignedQuote ? <p role="status" className="mb-3 text-sm text-warning-foreground">This sale record is too old for a loan quote.</p> : null}
          {priceError ? <p role="alert" className="mb-3 text-sm text-destructive">{priceError} Please try again.</p> : null}
          {!hasLoan && custodyStatus !== 4 ? <Button type="button" className="w-full" onClick={() => void fetchDemoPrice()} disabled={priceBusy || !canBorrowAgainstCard || custody.isPending} aria-busy={priceBusy}>{priceBusy ? "Checking sale…" : custody.isPending ? "Checking card…" : "See loan offer"}<ArrowRight className="size-4" aria-hidden="true" /></Button> : null}
        </div>
      </div>
    </section> : <Card className="mx-auto max-w-2xl">
      <CardHeader className="border-b border-border"><Button type="button" variant="ghost" className="mb-3 self-start px-0" onClick={() => setView("card")}><ArrowLeft className="size-4" aria-hidden="true" />Back to card</Button><CardTitle className="font-display text-3xl">{hasLoan && isBorrower ? "Your loan" : "Loan offer"}</CardTitle><p className="text-sm text-muted-foreground">{asset.name} · PSA {asset.grade} · Comparable #{asset.psaReferenceNumber}</p></CardHeader>
      <CardContent className="space-y-6 pt-6">
        {hasLoan && !isBorrower ? <p className="text-sm text-muted-foreground">This card is currently in a loan.</p> : null}
        {!hasLoan && price && principal !== null && interest !== null ? <>
          <div><p className="text-sm text-muted-foreground">You could borrow</p><p className="font-display mt-1 text-5xl font-semibold tabular-nums">{formatUsdc(principal)}</p><p className="mt-2 text-sm text-muted-foreground">MockUSDC on Sepolia · test funds</p></div>
          <dl className="divide-y divide-border border-y border-border text-sm">
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Last auction sale</dt><dd className="font-medium tabular-nums">{formatUsdc(price.lastSaleMicroUsdc)}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Loan to value</dt><dd className="font-medium">35%, capped at $3,500</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Fixed APR</dt><dd className="font-medium">20%</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Term and grace</dt><dd className="font-medium">{TERM_DAYS.toString()} + {GRACE_DAYS.toString()} days</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Interest at maturity</dt><dd className="font-medium tabular-nums">{formatUsdc(interest)}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="font-semibold">Total at maturity</dt><dd className="font-semibold tabular-nums">{formatUsdc(principal + interest)}</dd></div>
          </dl>
          {!price.freshForSignedQuote ? <p role="status" className="text-sm text-warning-foreground">This sale record is too old for a loan quote.</p> : null}
        </> : null}
        {(!hasLoan || isBorrower) ? onSepolia ? <BorrowActions key={address} cardId={asset.id} tokenId={asset.tokenId} custodyStatus={custodyStatus} expectedValueMicroUsdc={price?.lastSaleMicroUsdc} worldConfig={worldConfig} /> : <div className="space-y-3"><WalletButton />{isConnected ? <Button type="button" variant="outline" onClick={() => void switchToSepolia()} disabled={switchingNetwork}>{switchingNetwork ? "Switching…" : "Switch to Sepolia"}</Button> : null}{networkError ? <p role="alert" className="text-sm text-destructive">{networkError}</p> : null}</div> : null}
      </CardContent>
    </Card>}
  </div>;
}
