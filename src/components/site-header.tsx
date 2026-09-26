"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WalletButton } from "@/components/wallet-button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/borrow", label: "Borrow" },
  { href: "/earn", label: "Earn" },
  { href: "/auctions", label: "Auctions" },
  { href: "/activity", label: "Activity" },
  { href: "/docs", label: "How it works" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return <header className="border-b border-border bg-card">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
      <Link href="/borrow" className="inline-flex min-h-10 items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Collector Credit home">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><Layers3 className="size-5" aria-hidden="true" /></span>
        Collector Credit
      </Link>
      <div className="flex items-center gap-2 md:order-3">
        <Badge variant="outline" className="hidden sm:inline-flex"><span className="size-1.5 rounded-full bg-foreground" aria-hidden="true" />Sepolia testnet</Badge>
        <WalletButton />
      </div>
      <nav aria-label="Main navigation" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto md:order-2 md:mx-0 md:w-auto">
        {links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathname === href && "bg-secondary text-foreground")}>{label}</Link>)}
      </nav>
    </div>
  </header>;
}
