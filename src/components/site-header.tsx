"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/wallet-button";
import { BrandMark } from "@/components/brand-mark";
import { HowItWorksTrigger } from "@/components/how-it-works-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/borrow", label: "Borrow" },
  { href: "/earn", label: "Earn" },
  { href: "/auctions", label: "Auctions" },
  { href: "/activity", label: "Activity" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const landing = pathname === "/";
  return <header className="border-b border-border bg-card/95">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 md:px-6 lg:px-8">
      <Link href="/" className="inline-flex min-h-10 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card" aria-label="Pawn Shop home">
        <BrandMark />
        <span className="font-display text-lg font-semibold tracking-tight">pawn shop<span className="text-primary">.</span></span>
      </Link>
      {landing ? <nav aria-label="Main navigation" className="ml-auto flex items-center gap-3 sm:gap-6"><HowItWorksTrigger className="hidden min-h-10 items-center text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex" /><Link href="/borrow" className={cn(buttonVariants({ size: "sm" }), "gap-2")}>Open app<ArrowUpRight className="size-4" aria-hidden="true" /></Link></nav> : <>
        <div className="order-2 ml-auto flex items-center lg:order-3"><WalletButton /></div>
        <nav aria-label="Main navigation" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto lg:order-2 lg:ml-auto lg:w-auto">
          {links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("inline-flex min-h-10 items-center rounded-full px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 sm:text-sm", pathname === href && "bg-secondary text-primary")}>{label}</Link>)}
        </nav>
      </>}
    </div>
  </header>;
}
