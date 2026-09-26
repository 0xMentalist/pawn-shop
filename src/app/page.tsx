import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DEMO_CARDS } from "@/lib/demo-cards";
import { formatUsdc, maximumPrincipal } from "@/lib/loan-math";
import { cn } from "@/lib/utils";

const example = DEMO_CARDS.find((card) => card.id === "demo-charizard-001")!;

export default function Home() {
  const exampleOffer = maximumPrincipal(BigInt(example.valueMicroUsdc));
  return <main>
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,.92fr)] lg:gap-20 lg:px-8 lg:py-28">
        <div>
          <p className="font-serial text-xs font-semibold uppercase tracking-widest text-primary">Collectible backed credit</p>
          <h1 className="font-display mt-6 max-w-2xl text-5xl font-semibold leading-none md:text-6xl lg:text-7xl">Your collection has another move.</h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-muted-foreground">Borrow against a vaulted graded card with a clear price reference, straightforward terms, and a wallet you control.</p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/borrow" className={cn(buttonVariants({ size: "lg" }), "gap-3")}>Go to app<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
            <a href="#how-it-works" className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-foreground underline decoration-border underline-offset-8 hover:decoration-primary">How it works<ArrowRight className="size-4" aria-hidden="true" /></a>
          </div>
          <p className="mt-10 text-xs text-muted-foreground">Sepolia testnet · Simulated cards and valueless test funds</p>
        </div>
        <div className="overflow-hidden rounded-md border border-foreground bg-foreground text-background">
          <div className="font-serial border-b border-background/20 px-6 py-4 text-xs uppercase tracking-widest text-background/70">Example card</div>
          <div className="grid gap-7 p-6 sm:grid-cols-[minmax(0,.8fr)_minmax(0,1fr)] sm:items-center sm:p-8">
            <div className="flex min-h-72 items-center justify-center rounded-sm bg-white/10 p-5"><img src={example.imageUrl} alt="1999 Charizard Base Set card artwork" className="max-h-72 w-auto max-w-full object-contain" /></div>
            <div><p className="font-serial text-xs uppercase tracking-widest text-background/60">1999 · Base Set</p><h2 className="font-display mt-3 text-4xl font-semibold">Charizard</h2><p className="mt-2 text-sm text-background/70">Unlimited holo #4 · PSA 9</p><div className="mt-8 border-t border-background/20 pt-5"><p className="text-sm text-background/60">Last recorded sale</p><p className="mt-1 text-3xl font-semibold tabular-nums">{formatUsdc(example.valueMicroUsdc)}</p><a href={example.saleSourceUrl} target="_blank" rel="noopener noreferrer" className="font-serial mt-3 inline-flex items-center gap-1 text-xs text-background/80 underline underline-offset-4 hover:text-background">Comparable PSA #{example.psaReferenceNumber}<ArrowUpRight className="size-3" aria-hidden="true" /></a></div></div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-background/20 px-6 py-5 sm:px-8"><span className="text-sm text-background/70">Illustrative loan at 35%</span><strong className="text-xl font-semibold tabular-nums">{formatUsdc(exampleOffer)}</strong></div>
        </div>
      </div>
    </section>
    <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28 lg:px-8">
      <div className="max-w-2xl"><p className="font-serial text-xs font-semibold uppercase tracking-widest text-primary">How it works</p><h2 className="font-display mt-4 text-4xl font-semibold leading-tight md:text-5xl">From collection to credit, in three steps.</h2></div>
      <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
        <div className="border-t border-border pt-5"><span className="font-serial text-sm text-primary">01</span><h3 className="font-display mt-6 text-2xl font-semibold">Connect</h3><p className="mt-3 leading-7 text-muted-foreground">See the vaulted cards held by your wallet and the cards backing your active loans.</p></div>
        <div className="border-t border-border pt-5"><span className="font-serial text-sm text-primary">02</span><h3 className="font-display mt-6 text-2xl font-semibold">Verify</h3><p className="mt-3 leading-7 text-muted-foreground">Use World ID to verify your eligibility before opening a loan.</p></div>
        <div className="border-t border-border pt-5"><span className="font-serial text-sm text-primary">03</span><h3 className="font-display mt-6 text-2xl font-semibold">Borrow</h3><p className="mt-3 leading-7 text-muted-foreground">Review the latest sale reference and your terms before confirming in your wallet.</p></div>
      </div>
      <div className="mt-16 border-t border-border pt-8"><Link href="/borrow" className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-primary hover:underline hover:underline-offset-4">Explore the app<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
    </section>
  </main>;
}
