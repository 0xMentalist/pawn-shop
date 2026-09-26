import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WalletProvider } from "@/components/wallet-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Collector Credit", template: "%s · Collector Credit" },
  description: "Borrow MockUSDC on Sepolia against tokenized, vaulted graded cards.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="min-h-screen antialiased"><WalletProvider><div className="flex min-h-screen flex-col"><SiteHeader />{children}<SiteFooter /></div></WalletProvider></body></html>;
}
