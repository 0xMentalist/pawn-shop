import type { Metadata } from "next";
import { EnsIdentityCard } from "@/components/ens-identity-card";
import { ProtocolEnsDirectory } from "@/components/protocol-ens-directory";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Identity" };

export default function IdentityPage() {
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6 md:py-12 lg:px-8">
    <PageHeading title="Identity" description="Verified names and roles behind the lending pool." />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
      <ProtocolEnsDirectory />
      <EnsIdentityCard />
    </div>
  </main>;
}
