"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { sepolia } from "@reown/appkit/networks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
const adapter = projectId ? new WagmiAdapter({ projectId, networks: [sepolia], ssr: true }) : null;
const queryClient = new QueryClient();
const fallbackConfig = createConfig({ chains: [sepolia], transports: { [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) }, ssr: true });
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

if (projectId && adapter) {
  createAppKit({
    adapters: [adapter],
    projectId,
    networks: [sepolia],
    defaultNetwork: sepolia,
    metadata: {
      name: "Pawn Shop",
      description: "Keep your cards. Access their value.",
      url: appUrl,
      icons: [new URL("/icon.svg", appUrl).toString()],
    },
    features: { analytics: false },
  });
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return <WagmiProvider config={adapter?.wagmiConfig ?? fallbackConfig}><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></WagmiProvider>;
}
