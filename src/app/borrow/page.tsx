import type { Metadata } from "next";
import { BorrowFlow } from "@/components/borrow-flow";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { getDemoCard } from "@/lib/data";

export const metadata: Metadata = { title: "Borrow" };
export const dynamic = "force-dynamic";

export default async function BorrowPage() {
  const record = await getDemoCard();
  const worldConfig = process.env.WORLD_APP_ID && process.env.WORLD_RP_ID && ["production", "staging"].includes(process.env.WORLD_ENVIRONMENT ?? "")
    ? { appId: process.env.WORLD_APP_ID, rpId: process.env.WORLD_RP_ID, environment: process.env.WORLD_ENVIRONMENT as "production" | "staging" }
    : null;
  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
    <PageHeading title="Borrow against your card" description="See what you could borrow without selling your collection." />
    {!record?.valuation ? <Card><CardHeader><CardTitle>No cards available</CardTitle><CardDescription>Try again later.</CardDescription></CardHeader></Card> : <BorrowFlow asset={{ id: record.card.id, name: record.card.name, setName: record.card.setName, year: record.card.year, grader: record.card.grader, grade: record.card.grade, certificationNumber: record.card.certificationNumber, tokenId: record.card.tokenId }} worldConfig={worldConfig} />}
  </main>;
}
