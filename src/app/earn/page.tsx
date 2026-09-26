import type { Metadata } from "next";
import { DepositPreview } from "@/components/deposit-preview";
import { PoolStats } from "@/components/pool-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Earn" };

export default function EarnPage() {
  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
    <PageHeading title="Earn with your funds" description="Supply test tokens to the lending pool and withdraw available funds when you need them." />
    <PoolStats />
    <Card className="max-w-2xl"><CardHeader><CardTitle>Your deposit</CardTitle><CardDescription>Test funds on Sepolia. Estimated returns change with borrowing activity.</CardDescription></CardHeader><CardContent><DepositPreview /></CardContent></Card>
  </main>;
}
