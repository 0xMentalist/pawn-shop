"use client";

import { useReadContract } from "wagmi";
import { Card, CardContent } from "@/components/ui/card";
import { abis, contracts, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { estimatedLpApyBps, formatUsdc } from "@/lib/loan-math";

export function PoolStats() {
  const enabled = Boolean(contracts.pool);
  const base = { address: contracts.pool, abi: abis.pool, chainId: SEPOLIA_CHAIN_ID, query: { enabled, refetchInterval: 15_000 } } as const;
  const assets = useReadContract({ ...base, functionName: "totalAssets" });
  const available = useReadContract({ ...base, functionName: "availableLiquidity" });
  const principal = useReadContract({ ...base, functionName: "deployedPrincipal" });
  const utilization = useReadContract({ ...base, functionName: "utilizationBps" });
  const reserve = useReadContract({ ...base, functionName: "reserveBalance" });
  const losses = useReadContract({ ...base, functionName: "realizedLoss" });
  const rawUtilization = typeof utilization.data === "bigint" ? utilization.data : 0n;
  const items = [
    { label: "Pool assets", value: typeof assets.data === "bigint" ? formatUsdc(assets.data) : "—" },
    { label: "Available", value: typeof available.data === "bigint" ? formatUsdc(available.data) : "—" },
    { label: "In loans", value: typeof principal.data === "bigint" ? formatUsdc(principal.data) : "—" },
    { label: "Estimated APY", value: enabled && utilization.data !== undefined ? `${(Number(estimatedLpApyBps(rawUtilization)) / 100).toFixed(2)}%` : "—" },
  ];
  return <>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => <Card key={item.label}><CardContent className="pt-6"><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="mt-3 text-3xl font-semibold tabular-nums">{item.value}</p></CardContent></Card>)}</div>
    {enabled ? <p className="text-xs text-muted-foreground">Reserve {typeof reserve.data === "bigint" ? formatUsdc(reserve.data) : "—"} · Realized losses {typeof losses.data === "bigint" ? formatUsdc(losses.data) : "—"}</p> : null}
  </>;
}
