import type { Metadata } from "next";
import { DepositPreview } from "@/components/deposit-preview";
import { PoolStats } from "@/components/pool-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Earn" };

export default function EarnPage() {
  return <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
    <PageHeading title="Put liquidity to work." description="Supply to the pool that backs collectors’ loans, then manage your position here." />
    <PoolStats />
    <Card className="max-w-2xl"><CardHeader><CardTitle>Your position</CardTitle></CardHeader><CardContent><DepositPreview /></CardContent></Card>
  </main>;
}
