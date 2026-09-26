import type { Metadata } from "next";
import { BorrowFlow } from "@/components/borrow-flow";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { getDemoCards } from "@/lib/data";

export const metadata: Metadata = { title: "Borrow" };
export const dynamic = "force-dynamic";

export default async function BorrowPage() {
  const records = await getDemoCards();
  const worldConfig = process.env.WORLD_APP_ID && process.env.WORLD_RP_ID && ["production", "staging"].includes(process.env.WORLD_ENVIRONMENT ?? "")
    ? { appId: process.env.WORLD_APP_ID, rpId: process.env.WORLD_RP_ID, environment: process.env.WORLD_ENVIRONMENT as "production" | "staging" }
    : null;
  return <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 md:px-6 md:py-12">
    <PageHeading title="Borrow against your card" />
    {records.length === 0 ? <Card><CardHeader><CardTitle>No cards available</CardTitle><CardDescription>Try again later.</CardDescription></CardHeader></Card> : <BorrowFlow assets={records.map(({ card, valuation }) => ({ id: card.id, name: card.name, setName: card.setName, year: card.year, grader: card.grader, grade: card.grade, certificationNumber: card.certificationNumber, tokenId: card.tokenId, valueMicroUsdc: valuation.appraisedMicroUsdc }))} worldConfig={worldConfig} />}
  </main>;
}
