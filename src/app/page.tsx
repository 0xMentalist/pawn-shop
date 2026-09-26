import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { HowItWorksTrigger } from "@/components/how-it-works-dialog";
import { buttonVariants } from "@/components/ui/button";
import { DEMO_CARDS } from "@/lib/demo-cards";
import { formatUsdc, maximumPrincipal } from "@/lib/loan-math";
import { cn } from "@/lib/utils";

const example = DEMO_CARDS.find((card) => card.id === "demo-charizard-001")!;

export default function Home() {
  const exampleOffer = maximumPrincipal(BigInt(example.valueMicroUsdc));

  return <main className="w-full">
    <section className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pb-16 pt-14 md:px-6 md:pb-24 md:pt-20 lg:grid-cols-[minmax(0,.98fr)_minmax(0,1fr)] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
      <div className="relative z-10">
        <h1 className="font-display max-w-3xl text-[clamp(3.1rem,5.2vw,5.4rem)] font-semibold leading-[1.07]">
          Keep your cards.<br /><span className="text-primary">Make your next move.</span>
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground md:text-xl">Borrow against graded collectibles you own, or supply liquidity to fellow collectors.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/borrow" className={cn(buttonVariants({ size: "lg" }), "gap-3")}>Explore borrowing<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          <Link href="/earn" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-3")}>Supply liquidity<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
        <HowItWorksTrigger arrow className="mt-6 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-8 hover:text-foreground hover:decoration-primary" />
      </div>

      <div className="hero-stage overflow-hidden rounded-[2rem] px-5 pb-5 pt-10 sm:px-8 sm:pb-8 sm:pt-12">
        <div className="relative flex min-h-80 items-center justify-center sm:min-h-[22rem]">
          <img src={example.imageUrl} width={240} height={335} alt="1999 Base Set Charizard card artwork" className="relative z-10 h-72 w-auto max-w-full rotate-[-5deg] object-contain drop-shadow-[0_24px_28px_rgba(24,47,34,0.2)] sm:h-80" />
        </div>
        <div className="relative z-10 rounded-2xl bg-card p-5 shadow-[0_12px_40px_rgba(24,47,34,0.08)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-display text-2xl font-semibold">Charizard</h2><p className="mt-1 text-sm text-muted-foreground">1999 Base Set · PSA 9</p></div>
            <span className="font-serial text-xs text-muted-foreground">#4/102</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5">
            <div><p className="text-xs font-medium text-muted-foreground">Last sale</p><p className="font-display mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{formatUsdc(example.valueMicroUsdc)}</p></div>
            <div><p className="text-xs font-medium text-muted-foreground">Borrow up to</p><p className="font-display mt-1 text-xl font-semibold text-primary tabular-nums sm:text-2xl">{formatUsdc(exampleOffer)}</p></div>
          </div>
          <a href={example.saleSourceUrl} target="_blank" rel="noopener noreferrer" className="font-serial mt-4 inline-flex min-h-8 items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-primary">PSA comparable #{example.psaReferenceNumber}<ArrowUpRight className="size-3" aria-hidden="true" /></a>
        </div>
      </div>
    </section>

    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24 lg:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <h2 className="font-display max-w-xl text-4xl font-semibold leading-tight md:text-5xl">A better way to play your hand.</h2>
          <p className="max-w-sm text-base leading-7 text-muted-foreground">Choose the side of the market that works for you.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/borrow" className="group flex min-h-64 flex-col justify-between rounded-2xl bg-secondary p-7 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-9">
            <span className="flex items-start justify-between"><span className="font-display text-4xl font-semibold">Borrow</span><ArrowUpRight className="size-6 text-primary transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" /></span>
            <p className="max-w-sm text-lg leading-7 text-muted-foreground">Unlock liquidity from a graded card in your collection. Repay and reclaim it.</p>
          </Link>
          <Link href="/earn" className="group flex min-h-64 flex-col justify-between rounded-2xl bg-background p-7 ring-1 ring-inset ring-border transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-9">
            <span className="flex items-start justify-between"><span className="font-display text-4xl font-semibold">Earn</span><ArrowUpRight className="size-6 text-primary transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" /></span>
            <p className="max-w-sm text-lg leading-7 text-muted-foreground">Supply to the pool that backs collectors&apos; loans. Track your position and available liquidity.</p>
          </Link>
        </div>
      </div>
    </section>
  </main>;
}
