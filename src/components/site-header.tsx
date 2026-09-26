"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/wallet-button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/borrow", label: "Borrow" },
  { href: "/earn", label: "Earn" },
  { href: "/auctions", label: "Auctions" },
  { href: "/activity", label: "Activity" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return <header className="border-b border-border bg-card">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-6 lg:px-8">
      <Link href="/borrow" className="inline-flex min-h-10 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card" aria-label="Collector Credit home">
        <span className="flex size-9 -rotate-3 items-center justify-center border border-primary bg-primary font-display text-lg font-bold italic text-primary-foreground" aria-hidden="true">C</span>
        <span className="flex flex-col leading-none"><span className="font-display text-xl font-semibold tracking-tight">Collector</span><span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Credit</span></span>
      </Link>
      <div className="order-2 ml-auto flex items-center lg:order-3">
        <WalletButton />
      </div>
      <nav aria-label="Main navigation" className="order-3 -mx-2 flex w-full gap-1 overflow-x-auto lg:order-2 lg:ml-auto lg:w-auto">
        {links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("inline-flex min-h-10 items-center border-b-2 border-transparent px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === href && "border-primary text-primary")}>{label}</Link>)}
      </nav>
    </div>
  </header>;
}
