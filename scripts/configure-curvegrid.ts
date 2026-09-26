import { readFile } from "node:fs/promises";
import type { Address } from "viem";

process.loadEnvFile(".env.local");
const deploymentUrl = process.env.CURVEGRID_DEPLOYMENT_URL;
const key = process.env.CURVEGRID_API_KEY;
if (!deploymentUrl || !key) throw new Error("Set CURVEGRID_DEPLOYMENT_URL and CURVEGRID_API_KEY in .env.local");
const url = new URL(deploymentUrl);
if (url.protocol !== "https:" || !url.hostname.endsWith(".multibaas.com") || url.pathname !== "/") throw new Error("CURVEGRID_DEPLOYMENT_URL must be the HTTPS MultiBaas deployment origin");
const base = new URL("/api/v0/", url);
const deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as { chainId: number; contracts: Record<string, Address> };
if (deployment.chainId !== 11155111) throw new Error("Local contracts are not deployed on Sepolia");
const names = ["LoanManager", "LendingPool", "LiquidationAuction", "VaultedCardNFT", "HumanVerificationRegistry", "ValuationVerifier"] as const;

type Response<T> = { status: number; message: string; result: T };
async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let data: Response<T>;
  try { data = await response.json() as Response<T>; }
  catch { throw new Error(`MultiBaas ${method} ${path}: HTTP ${response.status}`); }
  if (!response.ok || (data.status !== 0 && data.status !== response.status)) throw new Error(`MultiBaas ${method} ${path}: HTTP ${response.status}, ${data.message}`);
  return data.result;
}

const status = await api<{ chainID: number; blockNumber: number }>("GET", "chains/ethereum/status");
if (status.chainID !== 11155111) throw new Error(`MultiBaas deployment is on chain ${status.chainID}, expected Sepolia`);
const plan = await api<{ limits: { name: string; limit: number | null; count?: number }[] }>("GET", "plan");
const linkedLimit = plan.limits.find((limit) => limit.name === "linked_contracts")?.limit;
const maxDepth = plan.limits.find((limit) => limit.name === "past_logs_max_depth")?.limit;
console.log(`MultiBaas Sepolia block ${status.blockNumber}; linked contract limit ${linkedLimit ?? "unknown"}; past-log depth ${maxDepth ?? "unknown"}.`);
const existing = await api<{ label: string }[]>("GET", "contracts");
const knownLabels = new Set(existing.map((contract) => contract.label));
const setup = process.argv.includes("--setup");
if (!setup && !process.argv.includes("--check")) throw new Error("Pass --check or --setup");
for (const name of names) {
  const label = name.toLowerCase();
  const address = deployment.contracts[name];
  if (!address) throw new Error(`Missing ${name} deployment address`);
  if (!knownLabels.has(label) && setup) {
    const rawAbi = (await readFile(`src/lib/abi/${name}.json`, "utf8")).trim();
    await api("POST", "contracts", [{ label, contractName: name, version: "1.0", bin: "0x", rawAbi }]);
    console.log(`Added ${name} ABI to MultiBaas library.`);
  }
  let linked: { address: string; contracts: { label: string }[] } | null = null;
  try { linked = await api("GET", `chains/ethereum/addresses/${address}`); }
  catch (error) {
    if (!(error instanceof Error) || !error.message.includes("HTTP 404")) throw error;
  }
  if (!setup) {
    const isLinked = linked?.address.toLowerCase() === address.toLowerCase() && linked.contracts.some((contract) => contract.label === label);
    console.log(`${name}: ABI ${knownLabels.has(label) ? "present" : "missing"}, active address ${isLinked ? "linked" : "missing"}`);
    if (!knownLabels.has(label) || !isLinked) process.exitCode = 1;
    continue;
  }
  if (!linked) {
    await api("POST", "chains/ethereum/addresses", { alias: `${label}-${address.slice(2, 8).toLowerCase()}`, address });
    console.log(`Added ${name} address alias.`);
    linked = await api("GET", `chains/ethereum/addresses/${address}`);
  }
  if (!linked) throw new Error(`Could not load ${name} address from MultiBaas`);
  if (linked.address.toLowerCase() !== address.toLowerCase()) throw new Error(`MultiBaas ${name} address mismatch`);
  if (!linked.contracts.some((contract) => contract.label === label)) {
    const startingBlock = maxDepth && maxDepth > 0 ? `-${Math.min(maxDepth, 100)}` : "latest";
    await api("POST", `chains/ethereum/addresses/${address}/contracts`, { label, version: "1.0", startingBlock });
    console.log(`Linked ${name} with event syncing from ${startingBlock}.`);
  } else {
    console.log(`${name}: already linked.`);
  }
}
if (setup) console.log("MultiBaas contract setup complete.");
