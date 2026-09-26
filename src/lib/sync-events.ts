import "server-only";

import { readFile } from "node:fs/promises";
import { decodeEventLog, createPublicClient, http, type Abi, type Address } from "viem";
import { sepolia } from "viem/chains";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chainEvents, indexerCursors } from "@/db/schema";
import { abis } from "@/lib/contracts";
import { INDEXED_EVENT_NAMES } from "@/lib/event-names";

const INDEXER_ID = "sepolia-rpc";
const CHUNK_SIZE = 1_000n;
const MAX_CHUNKS_PER_READ = 5;

const eventAbi = [...abis.mockUsdc, ...abis.card, ...abis.verifier, ...abis.registry, ...abis.pool, ...abis.manager, ...abis.auction] as Abi;

type Deployment = { chainId: number; contracts: Record<string, Address>; blockNumbers?: Record<string, number> };

export async function syncRecentEvents() {
  let deployment: Deployment;
  try { deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as Deployment; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  if (deployment.chainId !== sepolia.id || !deployment.blockNumbers || Object.keys(deployment.blockNumbers).length === 0) return;
  const firstBlock = Math.min(...Object.values(deployment.blockNumbers));
  if (!Number.isSafeInteger(firstBlock)) return;
  const addresses = Object.values(deployment.contracts).filter((value) => value?.startsWith("0x"));
  if (addresses.length === 0) return;
  const [cursor] = await db.select().from(indexerCursors).where(eq(indexerCursors.id, INDEXER_ID));
  let from = BigInt(cursor?.nextBlock ?? firstBlock);
  const client = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
  const latest = await client.getBlockNumber();
  const blockTimes = new Map<bigint, Date>();

  for (let chunk = 0; chunk < MAX_CHUNKS_PER_READ && from <= latest; chunk++) {
    const to = from + CHUNK_SIZE - 1n < latest ? from + CHUNK_SIZE - 1n : latest;
    const logs = await client.getLogs({ address: addresses, fromBlock: from, toBlock: to });
    for (const log of logs) {
      if (!log.transactionHash || log.logIndex === null || log.blockNumber === null) continue;
      let decoded: { eventName: string; args?: unknown };
      try { decoded = decodeEventLog({ abi: eventAbi, data: log.data, topics: log.topics, strict: false }); } catch { continue; }
      if (!INDEXED_EVENT_NAMES.has(decoded.eventName)) continue;
      const args = decoded.args && !Array.isArray(decoded.args) ? decoded.args as Record<string, unknown> : {};
      let occurredAt = blockTimes.get(log.blockNumber);
      if (!occurredAt) {
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        occurredAt = new Date(Number(block.timestamp) * 1000);
        blockTimes.set(log.blockNumber, occurredAt);
      }
      const actor = ["borrower", "caller", "bidder", "owner", "payer", "wallet", "winner"].map((key) => args[key]).find((value) => typeof value === "string" && value.startsWith("0x"));
      await db.insert(chainEvents).values({
        id: `${sepolia.id}:${log.transactionHash}:${log.logIndex}`,
        chainId: sepolia.id,
        txHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber: Number(log.blockNumber),
        eventName: decoded.eventName,
        actorAddress: typeof actor === "string" ? actor : null,
        loanId: typeof args.loanId === "bigint" ? args.loanId.toString() : null,
        payloadJson: JSON.stringify(args, (_key, value) => typeof value === "bigint" ? value.toString() : value),
        occurredAt,
      }).onConflictDoNothing();
    }
    await db.insert(indexerCursors).values({ id: INDEXER_ID, nextBlock: Number(to + 1n), updatedAt: new Date() }).onConflictDoUpdate({ target: indexerCursors.id, set: { nextBlock: sql`max(${indexerCursors.nextBlock}, ${Number(to + 1n)})`, updatedAt: new Date() } });
    from = to + 1n;
  }
}
