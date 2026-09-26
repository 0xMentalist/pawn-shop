import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WalletProvider } from "@/components/wallet-provider";
import { HowItWorksProvider } from "@/components/how-it-works-dialog";
import "./globals.css";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Prawn Shop", template: "%s · Prawn Shop" },
  description: "Keep your cards. Access their value. Borrow against vaulted graded cards or earn by lending to collectors.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${plex.variable} min-h-screen antialiased`}><WalletProvider><HowItWorksProvider><div className="flex min-h-screen flex-col"><SiteHeader />{children}<SiteFooter /></div></HowItWorksProvider></WalletProvider></body></html>;
}
