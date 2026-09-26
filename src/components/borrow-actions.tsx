"use client";

import { useState } from "react";
import { zeroAddress, zeroHash, type Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { WorldVerification } from "@/components/world-verification";
import { abis, contracts, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { cardCustodyStatus } from "@/lib/card-custody";
import { formatUsdc, maximumPrincipal } from "@/lib/loan-math";

type SignedQuote = {
  chainId: number;
  valuation: { cardContract: Hex; tokenId: string; value: string; currency: Hex; issuedAt: string; expiresAt: string; nonce: Hex };
  signature: Hex;
};

export function BorrowActions({ cardId, tokenId, custodyStatus, expectedValueMicroUsdc, worldConfig }: { cardId: string; tokenId: string | null; custodyStatus: number | null; expectedValueMicroUsdc?: number; worldConfig: { appId: string; rpId: string; environment: "production" | "staging" } | null }) {
  const [quote, setQuote] = useState<SignedQuote>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hex>();
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const configured = Boolean(contracts.card && contracts.manager && contracts.registry && contracts.mockUsdc);
  const ready = configured && Boolean(tokenId) && isConnected && chainId === SEPOLIA_CHAIN_ID && Boolean(publicClient);
  const id = tokenId ? BigInt(tokenId) : 0n;
  const owner = useReadContract({ address: contracts.card, abi: abis.card, functionName: "ownerOf", args: [id], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready } });
  const ownsCard = Boolean(address && typeof owner.data === "string" && owner.data.toLowerCase() === address.toLowerCase());
  const verified = useReadContract({ address: contracts.registry, abi: abis.registry, functionName: "isVerifiedBorrower", args: [address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready, refetchInterval: 15_000 } });
  const activeLoanId = useReadContract({ address: contracts.manager, abi: abis.manager, functionName: "activeLoanForToken", args: [id], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready, refetchInterval: 15_000 } });
  const loanId = typeof activeLoanId.data === "bigint" ? activeLoanId.data : 0n;
  const loan = useReadContract({ address: contracts.manager, abi: abis.manager, functionName: "loans", args: [loanId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready && loanId > 0n, refetchInterval: 15_000 } });
  const repayment = useReadContract({ address: contracts.manager, abi: abis.manager, functionName: "repaymentDue", args: [loanId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready && loanId > 0n, refetchInterval: 15_000 } });
  const demoMode = useReadContract({ address: contracts.manager, abi: abis.manager, functionName: "demoMode", chainId: SEPOLIA_CHAIN_ID, query: { enabled: configured } });
  const demoAccelerated = useReadContract({ address: contracts.manager, abi: abis.manager, functionName: "demoAccelerated", args: [loanId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready && loanId > 0n, refetchInterval: 15_000 } });
  const isOperator = useReadContract({ address: contracts.manager, abi: abis.manager, functionName: "hasRole", args: [zeroHash, address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready } });
  const loanTuple = Array.isArray(loan.data) ? loan.data : null;
  const loanStatus = loanTuple ? Number(loanTuple[6]) : 0;
  const isBorrower = Boolean(address && typeof loanTuple?.[0] === "string" && loanTuple[0].toLowerCase() === address.toLowerCase());
  const canAccelerate = ready && loanStatus === 1 && demoMode.data === true && demoAccelerated.data !== true && (isBorrower || isOperator.data === true);
  const canFetchQuote = ready && ownsCard && activeLoanId.data === 0n && (custodyStatus === 1 || custodyStatus === 3);
  const canOriginate = canFetchQuote && verified.data === true;
  const signedValue = quote ? BigInt(quote.valuation.value) : 0n;
  const principal = maximumPrincipal(signedValue) > 3_500_000_000n ? 3_500_000_000n : maximumPrincipal(signedValue);

  async function confirm(tx: Hex) {
    if (!publicClient) throw new Error("Sepolia RPC is unavailable");
    setHash(tx);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
    await Promise.all([verified.refetch(), activeLoanId.refetch()]);
    if (loanId > 0n) await Promise.all([loan.refetch(), repayment.refetch(), demoAccelerated.refetch()]);
  }

  async function fetchQuote() {
    if (!canFetchQuote) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/valuations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId }) });
      const result = await response.json() as SignedQuote & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not get a signed valuation.");
      if (result.chainId !== SEPOLIA_CHAIN_ID || result.valuation.tokenId !== tokenId) throw new Error("Valuation does not match this card on Sepolia.");
      if (expectedValueMicroUsdc !== undefined && result.valuation.value !== String(expectedValueMicroUsdc)) throw new Error("The quote changed. Refresh your estimate and try again.");
      setQuote(result);
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not get a quote."); }
    finally { setBusy(false); }
  }

  async function originate() {
    if (!canOriginate || !quote || !address || !contracts.card || !contracts.manager || !publicClient) return;
    setBusy(true);
    setMessage("");
    try {
      if (Date.now() / 1000 >= Number(quote.valuation.expiresAt)) throw new Error("Valuation expired. Request a new quote.");
      const details = await publicClient.readContract({ address: contracts.card, abi: abis.card, functionName: "cardDetails", args: [id] });
      const status = cardCustodyStatus(details);
      if (status !== 1 && status !== 3) throw new Error("This card is no longer eligible for a loan. Refresh the page.");
      const approval = await publicClient.readContract({ address: contracts.card, abi: abis.card, functionName: "getApproved", args: [id] });
      if (approval !== contracts.manager) {
        setMessage("Approve the card transfer in your wallet.");
        await confirm(await writeContractAsync({ address: contracts.card, abi: abis.card, functionName: "approve", args: [contracts.manager, id], chainId: SEPOLIA_CHAIN_ID }));
      }
      if (Date.now() / 1000 >= Number(quote.valuation.expiresAt)) throw new Error("Valuation expired after approval. Request a new quote.");
      setMessage("Confirm the loan transaction in your wallet.");
      await confirm(await writeContractAsync({ address: contracts.manager, abi: abis.manager, functionName: "originate", args: [principal, {
        cardContract: quote.valuation.cardContract,
        tokenId: BigInt(quote.valuation.tokenId),
        value: BigInt(quote.valuation.value),
        currency: quote.valuation.currency,
        issuedAt: BigInt(quote.valuation.issuedAt),
        expiresAt: BigInt(quote.valuation.expiresAt),
        nonce: quote.valuation.nonce,
      }, quote.signature], chainId: SEPOLIA_CHAIN_ID }));
      setQuote(undefined);
      setMessage("Loan opened. MockUSDC was sent to your wallet and the card is in escrow.");
    } catch (error) { setMessage(error instanceof Error ? error.message.split("\n")[0] : "Loan transaction failed."); }
    finally { setBusy(false); }
  }

  async function repay() {
    if (!ready || !address || !publicClient || !contracts.mockUsdc || !contracts.manager || loanId === 0n || typeof repayment.data !== "bigint") return;
    setBusy(true);
    setMessage("");
    try {
      const amount = repayment.data;
      const allowance = await publicClient.readContract({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "allowance", args: [address, contracts.manager] });
      if (typeof allowance !== "bigint" || allowance < amount) {
        setMessage("Approve MockUSDC repayment in your wallet.");
        await confirm(await writeContractAsync({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "approve", args: [contracts.manager, amount], chainId: SEPOLIA_CHAIN_ID }));
      }
      setMessage("Confirm repayment in your wallet.");
      await confirm(await writeContractAsync({ address: contracts.manager, abi: abis.manager, functionName: "repay", args: [loanId], chainId: SEPOLIA_CHAIN_ID }));
      setMessage("Loan repaid. The card has returned to its owner.");
    } catch (error) { setMessage(error instanceof Error ? error.message.split("\n")[0] : "Repayment failed."); }
    finally { setBusy(false); }
  }

  async function accelerateDemoMaturity() {
    if (!canAccelerate || !contracts.manager) return;
    setBusy(true);
    setMessage("");
    try {
      await confirm(await writeContractAsync({ address: contracts.manager, abi: abis.manager, functionName: "accelerateDemoMaturity", args: [loanId], chainId: SEPOLIA_CHAIN_ID }));
      setMessage("Demo clock advanced. Full-term interest is due and this loan can now enter auction.");
    } catch (error) { setMessage(error instanceof Error ? error.message.split("\n")[0] : "Demo clock transaction failed."); }
    finally { setBusy(false); }
  }

  async function markDefault() {
    if (!ready || !contracts.manager || loanId === 0n) return;
    setBusy(true);
    setMessage("");
    try {
      await confirm(await writeContractAsync({ address: contracts.manager, abi: abis.manager, functionName: "markDefault", args: [loanId], chainId: SEPOLIA_CHAIN_ID }));
      setMessage("Default recorded. The card is now in auction.");
    } catch (error) { setMessage(error instanceof Error ? error.message.split("\n")[0] : "Default transaction failed."); }
    finally { setBusy(false); }
  }

  const graceEnd = loanTuple ? Number(loanTuple[5]) + 7 * 24 * 60 * 60 : 0;
  const canMarkDefault = Date.now() / 1000 > graceEnd || demoAccelerated.data === true;
  return <div className="space-y-3">
    {!configured ? <p className="text-xs text-muted-foreground">Borrowing is temporarily unavailable.</p> : !tokenId ? <p className="text-xs text-muted-foreground">This card is unavailable.</p> : !isConnected ? <p className="text-xs text-muted-foreground">Connect your wallet to continue.</p> : chainId !== SEPOLIA_CHAIN_ID ? <p className="text-xs text-muted-foreground">Switch your wallet to Sepolia.</p> : owner.isPending ? <p className="text-xs text-muted-foreground">Checking card ownership…</p> : !ownsCard && loanId === 0n ? <p className="text-xs text-muted-foreground">Only the card owner can request a loan.</p> : null}
    {ready && verified.isError ? <div className="text-sm"><p>Could not check your verification.</p><Button type="button" variant="outline" className="mt-2" onClick={() => void verified.refetch()}>Try again</Button></div> : null}
    {ready && ownsCard && loanId === 0n && address && verified.data === false && (custodyStatus === 1 || custodyStatus === 3) ? <WorldVerification config={worldConfig} wallet={address} onVerified={() => void verified.refetch()} /> : null}
    {loanId > 0n && loanTuple ? <dl className="divide-y divide-border border-y border-border text-sm"><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Loan</dt><dd className="font-medium">#{loanId.toString()}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Status</dt><dd className="font-medium">{loanStatus === 1 ? "Active" : loanStatus === 3 ? "In auction" : "Settled"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Repayment due</dt><dd className="font-medium tabular-nums">{typeof repayment.data === "bigint" ? formatUsdc(repayment.data) : "—"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Due date</dt><dd className="font-medium">{new Date(Number(loanTuple[5]) * 1000).toLocaleDateString()}</dd></div>{demoAccelerated.data === true ? <div className="py-3 text-warning-foreground">Full-term interest is due.</div> : null}</dl> : null}
    {loanId > 0n && loanStatus === 1 ? <><Button type="button" className="w-full" disabled={busy || typeof repayment.data !== "bigint"} onClick={() => void repay()}>{busy ? "Waiting for confirmation…" : "Repay and reclaim card"}</Button>{canAccelerate || canMarkDefault ? <details className="pt-2 text-sm"><summary className="cursor-pointer text-muted-foreground">Test controls</summary><div className="mt-3 space-y-2">{canAccelerate ? <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void accelerateDemoMaturity()}>Advance loan to default</Button> : null}{canMarkDefault ? <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void markDefault()}>Mark loan in default</Button> : null}</div></details> : null}</> : null}
    {loanId === 0n ? <>{custodyStatus === 4 ? <p role="status" className="text-sm text-destructive">This card was liquidated and cannot back another loan.</p> : null}{quote ? <p className="text-sm text-muted-foreground">Quote valid until {new Date(Number(quote.valuation.expiresAt) * 1000).toLocaleTimeString()}.</p> : null}<Button type="button" variant={quote ? "outline" : "default"} className="w-full" disabled={!canFetchQuote || busy} onClick={() => void fetchQuote()}>{quote ? "Refresh quote" : "Get loan quote"}</Button>{quote ? <Button type="button" className="w-full" disabled={!canOriginate || busy} onClick={() => void originate()}>{busy ? "Waiting for confirmation…" : "Accept loan offer"}</Button> : null}</> : null}
    {message ? <p className="text-xs leading-5" role="status">{message}</p> : null}
    {hash ? <a className="inline-flex min-h-10 items-center rounded-sm text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" target="_blank" rel="noopener noreferrer" href={`https://sepolia.etherscan.io/tx/${hash}`}>View latest transaction</a> : null}
  </div>;
}
