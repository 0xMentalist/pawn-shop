import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WalletProvider } from "@/components/wallet-provider";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Collector Credit", template: "%s · Collector Credit" },
  description: "Borrow MockUSDC on Sepolia against tokenized, vaulted graded cards.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${fraunces.variable} ${plex.variable} min-h-screen antialiased`}><WalletProvider><div className="flex min-h-screen flex-col"><SiteHeader />{children}<SiteFooter /></div></WalletProvider></body></html>;
}
