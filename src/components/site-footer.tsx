import Link from "next/link";

export function SiteFooter() {
  return <footer className="mt-auto border-t border-border bg-card">
    <div className="mx-auto flex max-w-7xl items-center px-4 py-6 text-sm text-muted-foreground md:px-6 lg:px-8">
      <nav aria-label="More information" className="ml-auto flex gap-5">
        <Link href="/docs" className="inline-flex min-h-10 items-center rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">How it works</Link>
        <Link href="/identity" className="inline-flex min-h-10 items-center rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Protocol</Link>
      </nav>
    </div>
  </footer>;
}
