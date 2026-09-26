"use client";

import { createContext, useContext, useId, useRef } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OpenDialogContext = createContext<(() => void) | null>(null);

const borrowSteps = [
  { title: "Choose your card", detail: "Connect your wallet to see the supported cards you own." },
  { title: "Review and verify", detail: "Check the sale reference and loan terms, then verify with World ID." },
  { title: "Borrow and reclaim", detail: "Confirm the loan in your wallet. Repay to get your card back." },
];

const earnSteps = [
  { title: "Get test funds", detail: "Connect on Sepolia and claim MockUSDC from the faucet." },
  { title: "Deposit", detail: "Choose an amount to add to the shared lending pool." },
  { title: "Track and withdraw", detail: "Your pool shares track your position. Withdraw when funds are available." },
];

function Steps({ items }: { items: typeof borrowSteps }) {
  return <ol className="mt-6 space-y-5">
    {items.map((item, index) => <li key={item.title} className="flex gap-4">
      <span className="font-serial pt-0.5 text-xs font-semibold text-primary">0{index + 1}</span>
      <div><h4 className="font-semibold leading-5">{item.title}</h4><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p></div>
    </li>)}
  </ol>;
}

export function HowItWorksProvider({ children }: { children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => dialogRef.current?.close();
  const open = () => { if (!dialogRef.current?.open) dialogRef.current?.showModal(); };

  return <OpenDialogContext.Provider value={open}>
    {children}
    <dialog ref={dialogRef} aria-labelledby={titleId} onClick={(event) => { if (event.target === event.currentTarget) close(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-md border border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-foreground/55">
      <div className="flex items-start justify-between gap-6 border-b border-border px-5 py-5 sm:px-7 sm:py-6">
        <div><h2 id={titleId} className="font-display text-3xl font-semibold sm:text-4xl">How it works</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Borrow against a card or earn by lending to fellow collectors.</p></div>
        <button type="button" onClick={close} aria-label="Close how it works" className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-5" aria-hidden="true" /></button>
      </div>
      <div className="grid md:grid-cols-2">
        <section className="border-b border-border px-5 py-6 sm:px-7 md:border-b-0 md:border-r"><h3 className="font-display text-xl font-semibold">Borrow</h3><Steps items={borrowSteps} /></section>
        <section className="px-5 py-6 sm:px-7"><h3 className="font-display text-xl font-semibold">Earn</h3><Steps items={earnSteps} /></section>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-border px-5 py-5 sm:px-7">
        <Link href="/borrow" onClick={close} className={buttonVariants({ size: "sm" })}>Explore borrowing<ArrowRight className="size-4" aria-hidden="true" /></Link>
        <Link href="/earn" onClick={close} className={buttonVariants({ variant: "outline", size: "sm" })}>Explore lending<ArrowRight className="size-4" aria-hidden="true" /></Link>
      </div>
    </dialog>
  </OpenDialogContext.Provider>;
}

export function HowItWorksTrigger({ className, arrow = false }: { className?: string; arrow?: boolean }) {
  const open = useContext(OpenDialogContext);
  if (!open) throw new Error("HowItWorksTrigger must be inside HowItWorksProvider");
  return <button type="button" onClick={open} className={cn("cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>How it works{arrow ? <ArrowRight className="size-4" aria-hidden="true" /> : null}</button>;
}
