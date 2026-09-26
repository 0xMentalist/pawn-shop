import "server-only";

import { readFile } from "node:fs/promises";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { sepolia } from "viem/chains";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cards, chainEvents, valuationFixtures } from "@/db/schema";
import { DEMO_CARDS, isDemoCardId } from "@/lib/demo-cards";

export async function getDemoCard(cardId = "demo-charizard-001") {
  if (!isDemoCardId(cardId)) return null;
  const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
  if (!card) return null;
  const [valuation] = await db.select().from(valuationFixtures).where(eq(valuationFixtures.cardId, card.id));
  return { card, valuation: valuation ?? null };
}

export async function getDemoCards() {
  const records = await Promise.all(DEMO_CARDS.map((card) => getDemoCard(card.id)));
  return records.flatMap((record) => record?.valuation ? [{ card: record.card, valuation: record.valuation }] : []);
}

export async function getActivity() {
  return db.select().from(chainEvents).orderBy(desc(chainEvents.blockNumber), desc(chainEvents.logIndex)).limit(50);
}

export async function getAuctionLoanIds() {
  const deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as {
    chainId: number; contracts: { LiquidationAuction?: Address; LoanManager?: Address };
  };
  const auction = deployment.contracts.LiquidationAuction;
  const manager = deployment.contracts.LoanManager;
  if (deployment.chainId !== sepolia.id || !auction || !manager) return [];
  const client = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
  const abi = parseAbi([
    "function nextLoanId() view returns (uint256)",
    "function auctions(uint256) view returns (uint256,uint256,address,uint64,address,uint256,bool)",
  ]);
  const nextLoanId = await client.readContract({ address: manager, abi, functionName: "nextLoanId" });
  const ids: string[] = [];
  for (let upper = nextLoanId - 1n; upper > 0n && ids.length < 50;) {
    const lower = upper > 49n ? upper - 49n : 1n;
    const batch = Array.from({ length: Number(upper - lower + 1n) }, (_, index) => upper - BigInt(index));
    const auctions = await client.multicall({
      contracts: batch.map((loanId) => ({ address: auction, abi, functionName: "auctions" as const, args: [loanId] })),
      allowFailure: false,
    });
    for (const [index, details] of auctions.entries()) {
      if (details[3] !== 0n && !details[6]) ids.push(batch[index].toString());
      if (ids.length === 50) break;
    }
    upper = lower - 1n;
  }
  return ids;
}

export async function getCachedAuctionLoanIds() {
  const deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as {
    chainId: number; blockNumbers?: { LiquidationAuction?: number };
  };
  const deployedAt = deployment.blockNumbers?.LiquidationAuction;
  if (deployment.chainId !== sepolia.id || !Number.isSafeInteger(deployedAt)) return [];
  const events = await db.select({ loanId: chainEvents.loanId, eventName: chainEvents.eventName })
    .from(chainEvents)
    .where(and(
      eq(chainEvents.chainId, sepolia.id),
      gte(chainEvents.blockNumber, deployedAt!),
      inArray(chainEvents.eventName, ["AuctionStarted", "AuctionSettled"]),
    ))
    .orderBy(desc(chainEvents.blockNumber), desc(chainEvents.logIndex))
    .limit(500);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const event of events) {
    if (!event.loanId || seen.has(event.loanId)) continue;
    seen.add(event.loanId);
    if (event.eventName === "AuctionStarted") ids.push(event.loanId);
    if (ids.length === 50) break;
  }
  return ids;
}
