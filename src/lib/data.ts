import "server-only";

import { readFile, readdir } from "node:fs/promises";
import { createPublicClient, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";
import { desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { cards, chainEvents, valuationFixtures } from "@/db/schema";
import { isDemoCardId } from "@/lib/demo-cards";
import { auctionMarkets, discoverAuctionListings, type AuctionDeployment, type AuctionState } from "@/lib/auction-discovery";

export async function getDemoCard(cardId = "demo-charizard-001") {
  if (!isDemoCardId(cardId)) return null;
  const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
  if (!card) return null;
  const [valuation] = await db.select().from(valuationFixtures).where(eq(valuationFixtures.cardId, card.id));
  return { card, valuation: valuation ?? null };
}

export async function getDemoCards() {
  const records = await db.select({ card: cards, valuation: valuationFixtures }).from(cards)
    .innerJoin(valuationFixtures, eq(cards.id, valuationFixtures.cardId)).where(isNotNull(cards.tokenId));
  return records.filter((record) => isDemoCardId(record.card.id));
}

export async function getActivity() {
  return db.select().from(chainEvents).orderBy(desc(chainEvents.blockNumber), desc(chainEvents.logIndex)).limit(50);
}

export async function getAuctionListings() {
  let archiveFiles: string[] = [];
  try { archiveFiles = (await readdir("deployments/archive")).filter((file) => file.endsWith(".json")).map((file) => `deployments/archive/${file}`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const deploymentFiles = ["deployments/sepolia.json", "deployments/sepolia-previous.json", ...archiveFiles];
  const deployments: AuctionDeployment[] = [];
  for (const file of deploymentFiles) {
    try { deployments.push(JSON.parse(await readFile(file, "utf8")) as AuctionDeployment); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const markets = auctionMarkets(deployments, sepolia.id);
  if (markets.length === 0) throw new Error("No Sepolia auction markets are configured");
  const client = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
  const abi = parseAbi([
    "function nextLoanId() view returns (uint256)",
    "function auctions(uint256) view returns (uint256,uint256,address,uint64,address,uint256,bool)",
  ]);
  return discoverAuctionListings(markets, {
    nextLoanId: (managerAddress) => client.readContract({ address: managerAddress, abi, functionName: "nextLoanId" }),
    auctionStates: async (auctionAddress, loanIds) => {
      const contracts = loanIds.map((loanId) => ({ address: auctionAddress, abi, functionName: "auctions" as const, args: [loanId] as const }));
      let results: (AuctionState | null)[];
      try {
        const batches = await client.multicall({ contracts, allowFailure: true });
        results = await Promise.all(batches.map(async (batch, index) => {
          const details = batch.status === "success" ? batch.result : await client.readContract(contracts[index]);
          return { endsAt: details[3], settled: details[6] };
        }));
      } catch {
        results = await Promise.all(contracts.map(async (contract) => {
          const details = await client.readContract(contract);
          return { endsAt: details[3], settled: details[6] };
        }));
      }
      return results;
    },
  });
}
