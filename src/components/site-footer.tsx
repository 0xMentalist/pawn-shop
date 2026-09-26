import Link from "next/link";

export function SiteFooter() {
  return <footer className="mt-auto border-t border-border bg-card">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-7 text-sm text-muted-foreground md:px-6 lg:px-8">
      <p><span className="font-display font-semibold text-foreground">pawn shop.</span> A new move for your collection.</p>
      <nav aria-label="More information" className="flex gap-5">
        <Link href="/identity" className="inline-flex min-h-10 items-center rounded-full hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Protocol</Link>
      </nav>
    </div>
  </footer>;
}
