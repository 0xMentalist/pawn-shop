import type { Metadata } from "next";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { FaucetExperience } from "@/components/faucet-experience";
import { FAUCET_CARDS } from "@/lib/faucet-cards";
import { syncFaucetCards } from "@/lib/faucet-sync";

export const metadata: Metadata = { title: "Faucet" };
export const dynamic = "force-dynamic";

export default async function FaucetPage() {
  let refreshError = false;
  try { await syncFaucetCards(); }
  catch (error) { refreshError = true; console.error("Could not sync card faucet", error); }
  const records = await db.select({ id: cards.id, tokenId: cards.tokenId }).from(cards);
  const claimed = new Set(records.filter((record) => record.tokenId !== null).map((record) => record.id));
  return <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-12 lg:px-8">
    <FaucetExperience cards={FAUCET_CARDS.map((card) => ({ ...card, claimed: claimed.has(card.id) }))} refreshError={refreshError} />
  </main>;
}
