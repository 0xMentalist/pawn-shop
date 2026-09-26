import "server-only";

import { readFile } from "node:fs/promises";
import { createPublicClient, http, isAddress, parseAbiItem, type Address } from "viem";
import { sepolia } from "viem/chains";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cards, indexerCursors } from "@/db/schema";
import { FAUCET_CARDS } from "@/lib/faucet-cards";

export async function syncFaucetCards() {
  const faucetAddress = process.env.NEXT_PUBLIC_CARD_FAUCET_ADDRESS;
  const cardAddress = process.env.NEXT_PUBLIC_CARD_ADDRESS;
  if (!faucetAddress || !isAddress(faucetAddress) || !cardAddress || !isAddress(cardAddress)) return;
  let deployment: { address: Address; blockNumber: number };
  try { deployment = JSON.parse(await readFile("deployments/card-faucet-sepolia.json", "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  if (deployment.address.toLowerCase() !== faucetAddress.toLowerCase()) throw new Error("Faucet deployment mismatch");
  const cursorId = `card-faucet:${faucetAddress.toLowerCase()}`;
  const [cursor] = await db.select().from(indexerCursors).where(eq(indexerCursors.id, cursorId));
  const chain = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
  const latest = await chain.getBlockNumber();
  let from = BigInt(cursor?.nextBlock ?? deployment.blockNumber);
  const event = parseAbiItem("event CardClaimed(uint8 indexed number, address indexed owner, uint256 indexed tokenId)");
  while (from <= latest) {
    const to = from + 1999n < latest ? from + 1999n : latest;
    const logs = await chain.getLogs({ address: faucetAddress, event, fromBlock: from, toBlock: to });
    for (const log of logs) {
      const number = Number(log.args.number);
      const card = FAUCET_CARDS[number - 1];
      if (!card || log.args.tokenId === undefined) continue;
      await db.update(cards).set({ tokenId: log.args.tokenId.toString(), tokenContract: cardAddress, custodyStatus: "vaulted" }).where(eq(cards.id, card.id));
    }
    const nextBlock = Number(to + 1n);
    await db.insert(indexerCursors).values({ id: cursorId, nextBlock, updatedAt: new Date() })
      .onConflictDoUpdate({ target: indexerCursors.id, set: { nextBlock, updatedAt: new Date() } });
    from = to + 1n;
  }
}
