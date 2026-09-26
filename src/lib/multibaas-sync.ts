import "server-only";

import { ingestMultiBaasDeliveries } from "@/lib/curvegrid-events";

type MultiBaasResponse<T> = { status: number; message: string; result: T };
type MultiBaasEvent = {
  triggeredAt?: string;
  event?: { name?: string; rawFields?: string; contract?: { address?: string } };
};

function config() {
  const deploymentUrl = process.env.CURVEGRID_DEPLOYMENT_URL;
  const key = process.env.CURVEGRID_API_KEY;
  if (!deploymentUrl || !key) return null;
  const url = new URL(deploymentUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".multibaas.com") || url.pathname !== "/") throw new Error("Invalid CURVEGRID_DEPLOYMENT_URL");
  return { base: new URL("/api/v0/", url), key };
}

async function request<T>(base: URL, key: string, path: string): Promise<T> {
  const response = await fetch(new URL(path, base), {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`MultiBaas API returned HTTP ${response.status}`);
  const body = await response.json() as MultiBaasResponse<T>;
  if ((body.status !== 0 && body.status !== response.status) || body.message !== "success") throw new Error("MultiBaas API returned an error");
  return body.result;
}

/** Read recent indexed events, then insert them with the same onchain log ID used by the RPC reader. */
export async function syncMultiBaasEvents(): Promise<{ configured: boolean; indexed: number }> {
  const credentials = config();
  if (!credentials) return { configured: false, indexed: 0 };
  const { base, key } = credentials;
  const count = await request<number>(base, key, "events/count");
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid MultiBaas event count");
  if (count === 0) return { configured: true, indexed: 0 };
  const pageSize = 50;
  const offsets = new Set<number>();
  for (let offset = 0; offset < Math.min(count, 100); offset += pageSize) offsets.add(offset);
  if (count > 100) {
    const lastPage = Math.floor((count - 1) / pageSize) * pageSize;
    offsets.add(Math.max(0, lastPage - pageSize));
    offsets.add(lastPage);
  }
  let indexed = 0;
  for (const offset of [...offsets].sort((a, b) => a - b)) {
    const events = await request<MultiBaasEvent[]>(base, key, `events?limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(events)) throw new Error("Invalid MultiBaas event list");
    indexed += await ingestMultiBaasDeliveries(events.map((event) => ({ event: "event.emitted", data: event })));
  }
  return { configured: true, indexed };
}
