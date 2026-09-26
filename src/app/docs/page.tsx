import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "How it works" };

const sections = [
  {
    title: "Borrow",
    text: "Connect your wallet to see the supported cards you own. Choose a card, review its sale reference and loan terms, then verify with World ID. Accept the offer to receive test MockUSDC. Repaying returns the card to its owner.",
    href: "/borrow",
    action: "Explore borrowing",
  },
  {
    title: "Earn",
    text: "Deposit test MockUSDC into the lending pool. Your pool shares track your position, and you can withdraw when funds are available.",
    href: "/earn",
    action: "Explore earning",
  },
  {
    title: "Auctions",
    text: "A card can go to auction if its loan is not repaid after the term and grace period. Bids settle the loan before any surplus returns to the borrower.",
    href: "/auctions",
    action: "View auctions",
  },
] as const;

export default function DocsPage() {
  return <main className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8 md:px-6 md:py-12">
    <PageHeading title="How it works" />
    <div className="divide-y divide-border border-y border-border">
      {sections.map((section) => <section key={section.title} className="py-8 first:pt-0 last:pb-0">
        <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
        <p className="mt-3 max-w-prose text-sm leading-7 text-muted-foreground">{section.text}</p>
        <Link href={section.href} className="mt-4 inline-flex min-h-10 items-center rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{section.action}</Link>
      </section>)}
    </div>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">World ID</h2>
      <p className="max-w-prose text-sm leading-7 text-muted-foreground">Choose Orb, NFC Passport, My Number Card, or Selfie Check when you accept a loan. Each method unlocks the same test offer. A connected wallet must own the card.</p>
    </section>
    <p className="border-t border-border pt-6 text-sm leading-7 text-muted-foreground">Prawn Shop runs on Sepolia with valueless test funds and five simulated vaulted cards. Estimates use dated, grade-matched auction sales of comparable cards; the artwork is a reference image, not a photo of the demo asset. A liquidated card cannot back another loan.</p>
  </main>;
}
