import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WalletProvider } from "@/components/wallet-provider";
import { HowItWorksProvider } from "@/components/how-it-works-dialog";
import "./globals.css";

const body = localFont({ src: "../assets/fonts/dm-sans-latin.woff2", weight: "100 1000", variable: "--font-body", display: "swap" });
const display = localFont({ src: "../assets/fonts/sora-latin.woff2", weight: "100 800", variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Pawn Shop", template: "%s · Pawn Shop" },
  description: "Keep your cards. Make your next move. Borrow against graded collectibles or supply liquidity to fellow collectors.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${body.variable} ${display.variable} min-h-screen antialiased`}><WalletProvider><HowItWorksProvider><div className="flex min-h-screen flex-col"><SiteHeader />{children}<SiteFooter /></div></HowItWorksProvider></WalletProvider></body></html>;
}
