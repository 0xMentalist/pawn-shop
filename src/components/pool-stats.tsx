"use client";

import { useReadContract } from "wagmi";
import { Card, CardContent } from "@/components/ui/card";
import { abis, contracts, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { estimatedSupplyAprBps, formatUsdc } from "@/lib/loan-math";

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
    { label: "TVL", value: typeof assets.data === "bigint" ? formatUsdc(assets.data) : "—" },
    { label: "Available liquidity", value: typeof available.data === "bigint" ? formatUsdc(available.data) : "—" },
    { label: "Total borrowed", value: typeof principal.data === "bigint" ? formatUsdc(principal.data) : "—" },
    { label: "Est. supply APR", value: enabled && utilization.data !== undefined ? `${(Number(estimatedSupplyAprBps(rawUtilization)) / 100).toFixed(2)}%` : "—" },
  ];
  return <>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map((item, index) => <Card key={item.label} className={index === 0 ? "border-primary bg-primary text-primary-foreground" : undefined}><CardContent className="p-4 sm:p-6"><p className={index === 0 ? "text-sm text-primary-foreground/85" : "text-sm text-muted-foreground"}>{item.label}</p><p className="font-display mt-3 break-words text-xl font-semibold tabular-nums sm:text-2xl xl:text-3xl">{item.value}</p></CardContent></Card>)}</div>
    {enabled ? <p className="text-xs text-muted-foreground">Protocol reserves {typeof reserve.data === "bigint" ? formatUsdc(reserve.data) : "—"} · Realized losses {typeof losses.data === "bigint" ? formatUsdc(losses.data) : "—"}</p> : null}
  </>;
}
