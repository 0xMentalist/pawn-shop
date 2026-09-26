import { readFile } from "node:fs/promises";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { sepolia } from "viem/chains";

process.loadEnvFile(".env.local");

const deploymentUrl = process.env.CURVEGRID_DEPLOYMENT_URL;
const key = process.env.CURVEGRID_API_KEY;
if (!deploymentUrl || !key) throw new Error("Set CURVEGRID_DEPLOYMENT_URL and CURVEGRID_API_KEY");
const base = new URL("/api/v0/", deploymentUrl);
if (base.protocol !== "https:" || !base.hostname.endsWith(".multibaas.com")) throw new Error("Expected a MultiBaas HTTPS deployment");
type Deployment = { chainId: number; deployer: Address; contracts: { LoanManager: Address; LendingPool: Address; LiquidationAuction: Address } };
const previous = JSON.parse(await readFile("deployments/sepolia-previous.json", "utf8")) as Deployment;
const active = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as Deployment;
if (previous.chainId !== sepolia.id || active.chainId !== sepolia.id ||
    previous.deployer.toLowerCase() !== active.deployer.toLowerCase() ||
    previous.contracts.LoanManager.toLowerCase() === active.contracts.LoanManager.toLowerCase()) {
  throw new Error("Expected separate previous and active Sepolia markets");
}

const client = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
const abi = parseAbi([
  "function deployedPrincipal() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function nextLoanId() view returns (uint256)",
  "function auctions(uint256) view returns (uint256,uint256,address,uint64,address,uint256,bool)",
]);
const [principal, totalShares, deployerShares, nextLoanId] = await Promise.all([
  client.readContract({ address: previous.contracts.LendingPool, abi, functionName: "deployedPrincipal" }),
  client.readContract({ address: previous.contracts.LendingPool, abi, functionName: "totalSupply" }),
  client.readContract({ address: previous.contracts.LendingPool, abi, functionName: "balanceOf", args: [active.deployer] }),
  client.readContract({ address: previous.contracts.LoanManager, abi, functionName: "nextLoanId" }),
]);
if (principal !== 0n || totalShares !== deployerShares) throw new Error("Previous pool still has a loan or external depositor shares");
for (let loanId = 1n; loanId < nextLoanId; loanId++) {
  const auction = await client.readContract({ address: previous.contracts.LiquidationAuction, abi, functionName: "auctions", args: [loanId] });
  if (auction[3] !== 0n && !auction[6]) throw new Error(`Previous auction ${loanId} is not settled`);
}

for (const name of ["LoanManager", "LendingPool", "LiquidationAuction"] as const) {
  const address = previous.contracts[name];
  const label = name.toLowerCase();
  const path = `chains/ethereum/addresses/${address}`;
  const response = await fetch(new URL(path, base), { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
  if (!response.ok) throw new Error(`MultiBaas GET ${path}: HTTP ${response.status}`);
  const data = await response.json() as { result?: { contracts?: { label: string }[] } };
  if (!data.result?.contracts?.some((contract) => contract.label === label)) {
    console.log(`${name}: already unlinked`);
    continue;
  }
  const unlinked = await fetch(new URL(`${path}/contracts/${label}`, base), {
    method: "DELETE", headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!unlinked.ok) throw new Error(`MultiBaas unlink ${name}: HTTP ${unlinked.status}`);
  console.log(`${name}: retired MultiBaas link for ${address}`);
}
