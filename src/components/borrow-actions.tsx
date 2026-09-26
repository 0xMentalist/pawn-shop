"use client";

import { useState } from "react";
import Link from "next/link";
import { zeroAddress, zeroHash, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { WorldVerification } from "@/components/world-verification";
import { abis, contracts, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { cardCustodyStatus } from "@/lib/card-custody";
import { borrowLimit, formatUsdc, isLoanTermDays, maximumRepayment, type LoanTermDays } from "@/lib/loan-math";

type SignedQuote = {
  chainId: number;
  valuation: { cardContract: Hex; tokenId: string; value: string; currency: Hex; issuedAt: string; expiresAt: string; nonce: Hex };
  signature: Hex;
};

export function BorrowActions({ cardId, tokenId, managerAddress, custodyStatus, expectedValueMicroUsdc, principalMicroUsdc, termDays, onBusyChange, worldConfig }: { cardId: string; tokenId: string | null; managerAddress: Address | undefined; custodyStatus: number | null; expectedValueMicroUsdc?: number; principalMicroUsdc: bigint | null; termDays: LoanTermDays | null; onBusyChange?: (busy: boolean) => void; worldConfig: { appId: string; rpId: string; environment: "production" | "staging" } | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hex>();
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const configured = Boolean(contracts.card && managerAddress && contracts.registry && contracts.mockUsdc);
  const ready = configured && Boolean(tokenId) && isConnected && chainId === SEPOLIA_CHAIN_ID && Boolean(publicClient);
  const id = tokenId ? BigInt(tokenId) : 0n;
  const owner = useReadContract({ address: contracts.card, abi: abis.card, functionName: "ownerOf", args: [id], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready } });
  const ownsCard = Boolean(address && typeof owner.data === "string" && owner.data.toLowerCase() === address.toLowerCase());
  const verified = useReadContract({ address: contracts.registry, abi: abis.registry, functionName: "isVerifiedBorrower", args: [address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready, refetchInterval: 15_000 } });
  const activeLoanId = useReadContract({ address: managerAddress, abi: abis.manager, functionName: "activeLoanForToken", args: [id], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready, refetchInterval: 15_000 } });
  const loanId = typeof activeLoanId.data === "bigint" ? activeLoanId.data : 0n;
  const loan = useReadContract({ address: managerAddress, abi: abis.manager, functionName: "loans", args: [loanId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready && loanId > 0n, refetchInterval: 15_000 } });
  const repayment = useReadContract({ address: managerAddress, abi: abis.manager, functionName: "repaymentDue", args: [loanId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready && loanId > 0n, refetchInterval: 15_000 } });
  const walletBalance = useReadContract({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "balanceOf", args: [address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready && loanId > 0n, refetchInterval: 15_000 } });
  const demoMode = useReadContract({ address: managerAddress, abi: abis.manager, functionName: "demoMode", chainId: SEPOLIA_CHAIN_ID, query: { enabled: configured } });
  const demoAccelerated = useReadContract({ address: managerAddress, abi: abis.manager, functionName: "demoAccelerated", args: [loanId], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready && loanId > 0n, refetchInterval: 15_000 } });
  const isOperator = useReadContract({ address: managerAddress, abi: abis.manager, functionName: "hasRole", args: [zeroHash, address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready } });
  const loanTuple = Array.isArray(loan.data) ? loan.data : null;
  const loanStatus = loanTuple ? Number(loanTuple[6]) : 0;
  const fullTermRepayment = loanTuple && typeof loanTuple[3] === "bigint" && typeof loanTuple[4] === "bigint" && typeof loanTuple[5] === "bigint"
    ? maximumRepayment(loanTuple[3], loanTuple[5] - loanTuple[4]) : null;
  const activeTermDays = loanTuple && typeof loanTuple[4] === "bigint" && typeof loanTuple[5] === "bigint"
    ? Number((loanTuple[5] - loanTuple[4]) / 86_400n) : null;
  const accruedInterest = loanTuple && typeof loanTuple[3] === "bigint" && typeof repayment.data === "bigint"
    ? repayment.data - loanTuple[3] : null;
  const repaymentShortfall = typeof repayment.data === "bigint" && typeof walletBalance.data === "bigint" && walletBalance.data < repayment.data
    ? repayment.data - walletBalance.data : 0n;
  const isBorrower = Boolean(address && typeof loanTuple?.[0] === "string" && loanTuple[0].toLowerCase() === address.toLowerCase());
  const canAccelerate = ready && loanStatus === 1 && demoMode.data === true && demoAccelerated.data !== true && (isBorrower || isOperator.data === true);
  const canOriginate = ready && managerAddress === contracts.manager && ownsCard && activeLoanId.data === 0n && (custodyStatus === 1 || custodyStatus === 3 || custodyStatus === 4) && principalMicroUsdc !== null && principalMicroUsdc > 0n && isLoanTermDays(termDays) && verified.data === true;

  function setActionBusy(next: boolean) {
    setBusy(next);
    onBusyChange?.(next);
  }

  async function confirm(tx: Hex) {
    if (!publicClient) throw new Error("Sepolia RPC is unavailable");
    setHash(tx);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
    await Promise.all([verified.refetch(), activeLoanId.refetch()]);
    if (loanId > 0n) await Promise.all([loan.refetch(), repayment.refetch(), walletBalance.refetch(), demoAccelerated.refetch()]);
  }

  async function originate() {
    if (!canOriginate || !principalMicroUsdc || !isLoanTermDays(termDays) || !address || !contracts.card || !managerAddress || !publicClient) return;
    const principal = principalMicroUsdc;
    setActionBusy(true);
    setMessage("Checking the card valuation…");
    try {
      const response = await fetch("/api/valuations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId }) });
      const quote = await response.json() as SignedQuote & { error?: string };
      if (!response.ok) throw new Error(quote.error ?? "Could not get a signed valuation.");
      if (quote.chainId !== SEPOLIA_CHAIN_ID || quote.valuation.tokenId !== tokenId) throw new Error("Valuation does not match this card on Sepolia.");
      if (expectedValueMicroUsdc !== undefined && quote.valuation.value !== String(expectedValueMicroUsdc)) throw new Error("The card value changed. Go back and reopen the offer.");
      if (Date.now() / 1000 >= Number(quote.valuation.expiresAt)) throw new Error("Valuation expired. Please try again.");
      if (principal > borrowLimit(BigInt(quote.valuation.value))) throw new Error("This amount exceeds the signed card limit. Choose a lower amount.");
      if (contracts.pool) {
        const available = await publicClient.readContract({ address: contracts.pool, abi: abis.pool, functionName: "availableLiquidity" });
        if (typeof available === "bigint" && available < principal) throw new Error(`Only ${formatUsdc(available)} is available to borrow right now. Choose a lower amount.`);
      }
      const details = await publicClient.readContract({ address: contracts.card, abi: abis.card, functionName: "cardDetails", args: [id] });
      const status = cardCustodyStatus(details);
      if (status !== 1 && status !== 3 && status !== 4) throw new Error("This card is no longer eligible for a loan. Refresh the page.");
      const approval = await publicClient.readContract({ address: contracts.card, abi: abis.card, functionName: "getApproved", args: [id] });
      if (approval !== managerAddress) {
        setMessage("Approve the card transfer in your wallet.");
        await confirm(await writeContractAsync({ address: contracts.card, abi: abis.card, functionName: "approve", args: [managerAddress, id], chainId: SEPOLIA_CHAIN_ID }));
      }
      if (Date.now() / 1000 >= Number(quote.valuation.expiresAt)) throw new Error("Valuation expired after approval. Please try again.");
      setMessage("Confirm the loan transaction in your wallet.");
      await confirm(await writeContractAsync({ address: managerAddress, abi: abis.manager, functionName: "originate", args: [principal, termDays, {
        cardContract: quote.valuation.cardContract,
        tokenId: BigInt(quote.valuation.tokenId),
        value: BigInt(quote.valuation.value),
        currency: quote.valuation.currency,
        issuedAt: BigInt(quote.valuation.issuedAt),
        expiresAt: BigInt(quote.valuation.expiresAt),
        nonce: quote.valuation.nonce,
      }, quote.signature], chainId: SEPOLIA_CHAIN_ID }));
      setMessage("Loan opened. MockUSDC was sent to your wallet and the card is in escrow.");
    } catch (error) { setMessage(error instanceof Error ? error.message.split("\n")[0] : "Loan transaction failed."); }
    finally { setActionBusy(false); }
  }

  async function repay() {
    if (!ready || !address || !publicClient || !contracts.mockUsdc || !managerAddress || loanId === 0n || fullTermRepayment === null) return;
    setActionBusy(true);
    setMessage("");
    try {
      const [due, balance, allowance] = await Promise.all([
        publicClient.readContract({ address: managerAddress, abi: abis.manager, functionName: "repaymentDue", args: [loanId] }),
        publicClient.readContract({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "balanceOf", args: [address] }),
        publicClient.readContract({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "allowance", args: [address, managerAddress] }),
      ]);
      if (typeof due !== "bigint" || typeof balance !== "bigint" || typeof allowance !== "bigint") throw new Error("Could not check your repayment. Try again.");
      if (balance < due) throw new Error(`You need ${formatUsdc(due - balance)} more MockUSDC to repay. Get test funds from Earn.`);
      if (allowance < fullTermRepayment) {
        setMessage(`Approve up to ${formatUsdc(fullTermRepayment)} in your wallet. Only the amount due will be collected.`);
        await confirm(await writeContractAsync({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "approve", args: [managerAddress, fullTermRepayment], chainId: SEPOLIA_CHAIN_ID }));
      }
      const [latestDue, latestBalance] = await Promise.all([
        publicClient.readContract({ address: managerAddress, abi: abis.manager, functionName: "repaymentDue", args: [loanId] }),
        publicClient.readContract({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "balanceOf", args: [address] }),
      ]);
      if (typeof latestDue !== "bigint" || typeof latestBalance !== "bigint") throw new Error("Could not check your repayment. Try again.");
      if (latestBalance < latestDue) throw new Error(`You need ${formatUsdc(latestDue - latestBalance)} more MockUSDC to repay. Get test funds from Earn.`);
      await publicClient.simulateContract({ account: address, address: managerAddress, abi: abis.manager, functionName: "repay", args: [loanId] });
      setMessage("Confirm repayment in your wallet.");
      await confirm(await writeContractAsync({ address: managerAddress, abi: abis.manager, functionName: "repay", args: [loanId], chainId: SEPOLIA_CHAIN_ID }));
      setMessage("Loan repaid. The card has returned to its owner.");
    } catch (error) { setMessage(error instanceof Error ? error.message.split("\n")[0] : "Repayment failed."); }
    finally { setActionBusy(false); }
  }

  async function accelerateDemoMaturity() {
    if (!canAccelerate || !managerAddress) return;
    setActionBusy(true);
    setMessage("");
    try {
      await confirm(await writeContractAsync({ address: managerAddress, abi: abis.manager, functionName: "accelerateDemoMaturity", args: [loanId], chainId: SEPOLIA_CHAIN_ID }));
      setMessage("Demo clock advanced. Full-term interest is due and this loan can now enter auction.");
    } catch (error) { setMessage(error instanceof Error ? error.message.split("\n")[0] : "Demo clock transaction failed."); }
    finally { setActionBusy(false); }
  }

  async function markDefault() {
    if (!ready || !managerAddress || loanId === 0n) return;
    setActionBusy(true);
    setMessage("");
    try {
      await confirm(await writeContractAsync({ address: managerAddress, abi: abis.manager, functionName: "markDefault", args: [loanId], chainId: SEPOLIA_CHAIN_ID }));
      setMessage("Default recorded. The card is now in auction.");
    } catch (error) { setMessage(error instanceof Error ? error.message.split("\n")[0] : "Default transaction failed."); }
    finally { setActionBusy(false); }
  }

  const graceEnd = loanTuple ? Number(loanTuple[5]) + 7 * 24 * 60 * 60 : 0;
  const canMarkDefault = Date.now() / 1000 > graceEnd || demoAccelerated.data === true;
  return <div className="space-y-3">
    {!configured ? <p className="text-xs text-muted-foreground">Borrowing is temporarily unavailable.</p> : !tokenId ? <p className="text-xs text-muted-foreground">This card is unavailable.</p> : !isConnected ? <p className="text-xs text-muted-foreground">Connect your wallet to continue.</p> : chainId !== SEPOLIA_CHAIN_ID ? <p className="text-xs text-muted-foreground">Switch your wallet to Sepolia.</p> : owner.isPending ? <p className="text-xs text-muted-foreground">Checking card ownership…</p> : !ownsCard && loanId === 0n ? <p className="text-xs text-muted-foreground">Only the card owner can request a loan.</p> : null}
    {ready && verified.isError ? <div className="text-sm"><p>Could not check your verification.</p><Button type="button" variant="outline" className="mt-2" onClick={() => void verified.refetch()}>Try again</Button></div> : null}
    {ready && ownsCard && loanId === 0n && address && verified.data === false && (custodyStatus === 1 || custodyStatus === 3 || custodyStatus === 4) ? <WorldVerification config={worldConfig} wallet={address} onVerified={() => void verified.refetch()} /> : null}
    {loanId > 0n && loanTuple ? <dl className="divide-y divide-border border-y border-border text-sm"><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Loan</dt><dd className="font-medium">#{loanId.toString()}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Status</dt><dd className="font-medium">{loanStatus === 1 ? "Active" : loanStatus === 3 ? "In auction" : "Settled"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Term</dt><dd className="font-medium">{activeTermDays === null ? "—" : `${activeTermDays} days`}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Interest accrued</dt><dd className="font-medium tabular-nums">{accruedInterest === null ? "—" : formatUsdc(accruedInterest)}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Repayment due</dt><dd className="font-medium tabular-nums">{typeof repayment.data === "bigint" ? formatUsdc(repayment.data) : "—"}</dd></div>{loanStatus === 1 ? <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Your MockUSDC</dt><dd className="font-medium tabular-nums">{typeof walletBalance.data === "bigint" ? formatUsdc(walletBalance.data) : "—"}</dd></div> : null}<div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Due date</dt><dd className="font-medium">{new Date(Number(loanTuple[5]) * 1000).toLocaleDateString()}</dd></div>{demoAccelerated.data === true ? <div className="py-3 text-warning-foreground">Full-term interest is due.</div> : null}</dl> : null}
    {loanId > 0n && loanStatus === 1 ? <>{repaymentShortfall > 0n ? <p className="text-sm text-warning-foreground">You need {formatUsdc(repaymentShortfall)} more MockUSDC. <Link href="/earn" className="font-semibold underline underline-offset-4">Get test funds</Link></p> : null}<Button type="button" className="w-full" disabled={busy || fullTermRepayment === null || repaymentShortfall > 0n} onClick={() => void repay()}>{busy ? "Waiting for confirmation…" : "Repay and reclaim card"}</Button>{canAccelerate || canMarkDefault ? <details className="pt-2 text-sm"><summary className="cursor-pointer text-muted-foreground">Test controls</summary><div className="mt-3 space-y-2">{canAccelerate ? <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void accelerateDemoMaturity()}>Advance loan to default</Button> : null}{canMarkDefault ? <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void markDefault()}>Mark loan in default</Button> : null}</div></details> : null}</> : null}
    {loanId > 0n && loanStatus === 3 ? <Link href="/auctions" prefetch={false} className="inline-flex min-h-10 items-center text-sm font-semibold text-primary underline underline-offset-4">View auction</Link> : null}
    {loanId === 0n ? <Button type="button" className="w-full" disabled={!canOriginate || busy} onClick={() => void originate()}>{busy ? "Waiting for confirmation…" : "Confirm & deposit card"}</Button> : null}
    {message ? <p className="text-xs leading-5" role="status">{message}</p> : null}
    {hash ? <a className="inline-flex min-h-10 items-center rounded-sm text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" target="_blank" rel="noopener noreferrer" href={`https://sepolia.etherscan.io/tx/${hash}`}>View latest transaction</a> : null}
  </div>;
}
