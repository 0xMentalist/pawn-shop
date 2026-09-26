"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount, useEnsAddress } from "wagmi";
import { ENS_ROOT_NAME, ENS_SEPOLIA_CHAIN_ID } from "@/lib/ens";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WalletButton() {
  if (!process.env.NEXT_PUBLIC_REOWN_PROJECT_ID) {
    return <span className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Wallet setup pending</span>;
  }
  return <ConnectedWalletButton />;
}

function ConnectedWalletButton() {
  const { open } = useAppKit();
  const { address, isConnected, chainId } = useAccount();
  const ens = useEnsAddress({ name: ENS_ROOT_NAME, chainId: ENS_SEPOLIA_CHAIN_ID, query: { enabled: isConnected && chainId === ENS_SEPOLIA_CHAIN_ID } });
  const named = address && ens.data?.toLowerCase() === address.toLowerCase();
  const label = isConnected && address ? named ? ENS_ROOT_NAME : `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect wallet";
  return <Button type="button" variant="outline" onClick={() => open()} aria-label={isConnected ? `Wallet ${address}, open account menu` : "Connect wallet"}>
    <Wallet className="size-4" aria-hidden="true" />
    {label}
    {isConnected && chainId !== 11155111 ? <span className="text-warning-foreground">Wrong network</span> : null}
  </Button>;
}
