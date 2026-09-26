import "server-only";

import { readFile } from "node:fs/promises";
import { decodeEventLog, type Abi, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { db } from "@/db";
import { chainEvents } from "@/db/schema";
import { abis } from "@/lib/contracts";
import { INDEXED_EVENT_NAMES } from "@/lib/event-names";

const eventAbi = [...abis.mockUsdc, ...abis.card, ...abis.verifier, ...abis.registry, ...abis.pool, ...abis.manager, ...abis.auction] as Abi;
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const dataPattern = /^0x(?:[0-9a-fA-F]{2})*$/;

type Delivery = {
  id?: string;
  event?: string;
  data?: {
    triggeredAt?: string;
    event?: { name?: string; rawFields?: string; contract?: { address?: string } };
  };
};

type RawFields = {
  address?: unknown;
  data?: unknown;
  topics?: unknown;
  blockNumber?: unknown;
  transactionHash?: unknown;
  logIndex?: unknown;
};

function safeInteger(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    const number = Number(BigInt(value));
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  } catch {
    return null;
  }
}

export async function ingestMultiBaasDeliveries(deliveries: Delivery[]): Promise<number> {
  let deployment: { chainId: number; contracts: Record<string, Address> };
  try {
    deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  if (deployment.chainId !== sepolia.id) throw new Error("MultiBaas deployment chain mismatch");
  const allowedAddresses = new Set(Object.values(deployment.contracts).map((address) => address.toLowerCase()));
  let indexed = 0;

  for (const delivery of deliveries) {
    if (delivery.event !== "event.emitted" || !INDEXED_EVENT_NAMES.has(delivery.data?.event?.name ?? "")) continue;
    const event = delivery.data?.event;
    if (!event?.rawFields) continue;
    let fields: RawFields;
    try { fields = JSON.parse(event.rawFields) as RawFields; } catch { continue; }
    if (!fields || typeof fields !== "object") continue;
    if (typeof fields.address !== "string" || !addressPattern.test(fields.address) || !allowedAddresses.has(fields.address.toLowerCase())) continue;
    if (event.contract?.address && event.contract.address.toLowerCase() !== fields.address.toLowerCase()) continue;
    if (typeof fields.data !== "string" || !dataPattern.test(fields.data)) continue;
    if (!Array.isArray(fields.topics) || fields.topics.length < 1 || fields.topics.length > 4 || !fields.topics.every((topic) => typeof topic === "string" && hashPattern.test(topic))) continue;
    if (typeof fields.transactionHash !== "string" || !hashPattern.test(fields.transactionHash)) continue;
    const blockNumber = safeInteger(fields.blockNumber);
    const logIndex = safeInteger(fields.logIndex);
    const occurredAt = new Date(delivery.data?.triggeredAt ?? "");
    if (blockNumber === null || logIndex === null || Number.isNaN(occurredAt.getTime())) continue;

    let decoded: { eventName: string; args?: unknown };
    try {
      decoded = decodeEventLog({ abi: eventAbi, data: fields.data as Hex, topics: fields.topics as [Hex, ...Hex[]], strict: false });
    } catch { continue; }
    if (decoded.eventName !== event.name) continue;
    const args = decoded.args && !Array.isArray(decoded.args) ? decoded.args as Record<string, unknown> : {};
    const actor = ["borrower", "caller", "bidder", "owner", "payer", "wallet", "winner"]
      .map((key) => args[key]).find((value) => typeof value === "string" && addressPattern.test(value));
    const inserted = await db.insert(chainEvents).values({
      id: `${sepolia.id}:${fields.transactionHash}:${logIndex}`,
      chainId: sepolia.id,
      txHash: fields.transactionHash,
      logIndex,
      blockNumber,
      eventName: decoded.eventName,
      actorAddress: typeof actor === "string" ? actor : null,
      loanId: typeof args.loanId === "bigint" ? args.loanId.toString() : null,
      payloadJson: JSON.stringify(args, (_key, value) => typeof value === "bigint" ? value.toString() : value),
      occurredAt,
    }).onConflictDoNothing().returning({ id: chainEvents.id });
    indexed += inserted.length;
  }
  return indexed;
}
