"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/wallet-button";
import { BrandMark } from "@/components/brand-mark";
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
  return <header className="border-b border-border bg-card">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-6 lg:px-8">
      <Link href="/" className="inline-flex min-h-10 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card" aria-label="Prawn Shop home">
        <BrandMark />
        <span className="font-display text-lg font-semibold tracking-tight">Prawn Shop</span>
      </Link>
      {landing ? <nav aria-label="Main navigation" className="ml-auto flex items-center gap-3 sm:gap-6"><a href="#how-it-works" className="hidden min-h-10 items-center text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex">How it works</a><Link href="/borrow" className={cn(buttonVariants({ size: "sm" }), "gap-2")}>Go to app<ArrowUpRight className="size-4" aria-hidden="true" /></Link></nav> : <>
        <div className="order-2 ml-auto flex items-center lg:order-3"><WalletButton /></div>
        <nav aria-label="Main navigation" className="order-3 -mx-2 flex w-full gap-1 overflow-x-auto lg:order-2 lg:ml-auto lg:w-auto">
          {links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("inline-flex min-h-10 items-center border-b-2 border-transparent px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === href && "border-primary text-primary")}>{label}</Link>)}
        </nav>
      </>}
    </div>
  </header>;
}
