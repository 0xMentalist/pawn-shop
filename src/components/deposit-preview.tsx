"use client";

import { useState } from "react";
import { parseUnits, zeroAddress, type Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { abis, contracts, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { formatUsdc } from "@/lib/loan-math";

export function DepositPreview() {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hex>();
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const configured = Boolean(contracts.pool && contracts.mockUsdc);
  const ready = configured && isConnected && chainId === SEPOLIA_CHAIN_ID && Boolean(publicClient);
  const tokenBalance = useReadContract({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "balanceOf", args: [address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready, refetchInterval: 15_000 } });
  const shares = useReadContract({ address: contracts.pool, abi: abis.pool, functionName: "balanceOf", args: [address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready, refetchInterval: 15_000 } });
  const withdrawable = useReadContract({ address: contracts.pool, abi: abis.pool, functionName: "maxWithdraw", args: [address ?? zeroAddress], chainId: SEPOLIA_CHAIN_ID, query: { enabled: ready, refetchInterval: 15_000 } });
  const validAmount = /^\d+(\.\d{0,6})?$/.test(amount) && Number(amount) > 0;
  const amountError = amount && !validAmount ? "Enter a positive MockUSDC amount with up to six decimals." : null;

  async function confirm(hashToWait: Hex) {
    if (!publicClient) throw new Error("Sepolia RPC is unavailable");
    setHash(hashToWait);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: hashToWait });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
    await Promise.all([tokenBalance.refetch(), shares.refetch(), withdrawable.refetch()]);
  }

  async function run(action: "faucet" | "deposit" | "withdraw") {
    if (!ready || !address || !contracts.mockUsdc || !contracts.pool || !publicClient) return;
    setBusy(true);
    setMessage("");
    setHash(undefined);
    try {
      if (action === "faucet") {
        setMessage("Confirm the test token faucet in your wallet.");
        await confirm(await writeContractAsync({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "faucet", chainId: SEPOLIA_CHAIN_ID }));
        setMessage("MockUSDC received.");
      } else if (action === "deposit") {
        if (!validAmount) throw new Error("Enter a valid deposit amount.");
        const amountUnits = parseUnits(amount, 6);
        const allowance = await publicClient.readContract({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "allowance", args: [address, contracts.pool] });
        if (typeof allowance !== "bigint" || allowance < amountUnits) {
          setMessage("Approve MockUSDC spending in your wallet.");
          await confirm(await writeContractAsync({ address: contracts.mockUsdc, abi: abis.mockUsdc, functionName: "approve", args: [contracts.pool, amountUnits], chainId: SEPOLIA_CHAIN_ID }));
        }
        setMessage("Confirm the pool deposit in your wallet.");
        await confirm(await writeContractAsync({ address: contracts.pool, abi: abis.pool, functionName: "deposit", args: [amountUnits, address], chainId: SEPOLIA_CHAIN_ID }));
        setAmount("");
        setMessage("Deposit confirmed. Pool shares are in your wallet.");
      } else {
        const available = withdrawable.data;
        if (typeof available !== "bigint" || available <= 0n) throw new Error("No liquidity is currently withdrawable.");
        setMessage("Confirm the withdrawal in your wallet.");
        await confirm(await writeContractAsync({ address: contracts.pool, abi: abis.pool, functionName: "withdraw", args: [available, address, address], chainId: SEPOLIA_CHAIN_ID }));
        setMessage("Available liquidity withdrawn.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message.split("\n")[0] : "Transaction failed.");
    } finally { setBusy(false); }
  }

  return <div className="space-y-4">
    {!configured ? <p className="text-sm text-muted-foreground">Deposits are temporarily unavailable.</p> : !isConnected ? <p className="text-sm text-muted-foreground">Connect your wallet to deposit.</p> : chainId !== SEPOLIA_CHAIN_ID ? <p className="text-sm text-muted-foreground">Switch your wallet to Sepolia.</p> : null}
    {ready ? <div className="grid grid-cols-2 gap-3 rounded-md bg-secondary p-3 text-xs"><div><span className="text-muted-foreground">Your MockUSDC</span><p className="mt-1 font-semibold tabular-nums">{typeof tokenBalance.data === "bigint" ? formatUsdc(tokenBalance.data) : "—"}</p></div><div><span className="text-muted-foreground">Your shares</span><p className="mt-1 font-semibold tabular-nums">{typeof shares.data === "bigint" ? formatUsdc(shares.data) : "—"}</p></div></div> : null}
    <Button type="button" variant="outline" className="w-full" disabled={!ready || busy} onClick={() => void run("faucet")}>Claim test MockUSDC</Button>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void run("deposit"); }}>
      <div className="space-y-1.5"><label htmlFor="deposit-amount" className="text-sm font-medium">Deposit amount</label><Input id="deposit-amount" type="text" inputMode="decimal" autoComplete="off" placeholder="1000.00" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={Boolean(amountError)} aria-describedby={amountError ? "deposit-error" : "deposit-hint"} />{amountError ? <p id="deposit-error" className="text-xs text-warning-foreground">{amountError}</p> : <p id="deposit-hint" className="text-xs text-muted-foreground">MockUSDC is valueless test currency on Sepolia.</p>}</div>
      <Button type="submit" className="w-full" disabled={!ready || busy || !validAmount}>{busy ? "Waiting for confirmation…" : "Deposit into pool"}</Button>
    </form>
    {ready ? <div className="border-t border-border pt-4"><p className="text-xs text-muted-foreground">Available to withdraw: {typeof withdrawable.data === "bigint" ? formatUsdc(withdrawable.data) : "—"}</p><Button type="button" variant="outline" className="mt-3 w-full" disabled={busy || typeof withdrawable.data !== "bigint" || withdrawable.data <= 0n} onClick={() => void run("withdraw")}>Withdraw available liquidity</Button></div> : null}
    {message ? <p className="text-xs leading-5" role="status">{message}</p> : null}
    {hash ? <a className="block text-xs underline underline-offset-4" target="_blank" rel="noopener noreferrer" href={`https://sepolia.etherscan.io/tx/${hash}`}>View latest transaction</a> : null}
  </div>;
}
