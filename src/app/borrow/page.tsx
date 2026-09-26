import type { Metadata } from "next";
import { BorrowFlow } from "@/components/borrow-flow";
import { getDemoCards } from "@/lib/data";
import { getDemoCardEvidence } from "@/lib/demo-cards";

export const metadata: Metadata = { title: "Borrow" };
export const dynamic = "force-dynamic";

export default async function BorrowPage() {
  const records = await getDemoCards();
  const worldConfig = process.env.WORLD_APP_ID && process.env.WORLD_RP_ID && ["production", "staging"].includes(process.env.WORLD_ENVIRONMENT ?? "")
    ? { appId: process.env.WORLD_APP_ID, rpId: process.env.WORLD_RP_ID, environment: process.env.WORLD_ENVIRONMENT as "production" | "staging" }
    : null;
  return <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 md:px-6 md:py-12">
    <BorrowFlow assets={records.map(({ card, valuation }) => {
      const evidence = getDemoCardEvidence(card.id);
      if (!evidence) throw new Error(`Missing card evidence for ${card.id}`);
      return { id: card.id, name: card.name, setName: card.setName, printing: evidence.printing, year: card.year, grader: card.grader, grade: card.grade, psaReferenceNumber: evidence.psaReferenceNumber, tokenId: card.tokenId, imageUrl: evidence.imageUrl, saleObservedAt: evidence.saleObservedAt, saleSourceUrl: evidence.saleSourceUrl, valueMicroUsdc: valuation.appraisedMicroUsdc };
    })} worldConfig={worldConfig} />
  </main>;
}
