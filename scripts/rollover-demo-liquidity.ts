import { readFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, erc20Abi, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

process.loadEnvFile(".env.local");

const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env.local");
const account = privateKeyToAccount(key);
const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
const client = createPublicClient({ chain: sepolia, transport: http(rpc) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpc) });
const abi = parseAbi([
  "function availableLiquidity() view returns (uint256)",
  "function deployedPrincipal() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function maxWithdraw(address) view returns (uint256)",
  "function withdraw(uint256,address,address) returns (uint256)",
  "function deposit(uint256,address) returns (uint256)",
  "function OPENING_BID_BPS() view returns (uint256)",
  "function MIN_TERM_DAYS() view returns (uint16)",
  "function MAX_TERM_DAYS() view returns (uint16)",
]);

type Deployment = { chainId: number; deployer: Address; contracts: { MockUSDC: Address; LendingPool: Address; LoanManager: Address; LiquidationAuction: Address } };
const active = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as Deployment;
const staged = JSON.parse(await readFile("deployments/sepolia-next.json", "utf8")) as Deployment;
if (active.chainId !== sepolia.id || staged.chainId !== sepolia.id ||
    active.deployer.toLowerCase() !== account.address.toLowerCase() ||
    staged.deployer.toLowerCase() !== account.address.toLowerCase() ||
    active.contracts.MockUSDC.toLowerCase() !== staged.contracts.MockUSDC.toLowerCase() ||
    active.contracts.LendingPool.toLowerCase() === staged.contracts.LendingPool.toLowerCase()) {
  throw new Error("Expected separate Sepolia demo pools owned by this deployer and sharing MockUSDC");
}
const oldPool = active.contracts.LendingPool;
const newPool = staged.contracts.LendingPool;
const currency = active.contracts.MockUSDC;
const openingBps = await client.readContract({ address: staged.contracts.LiquidationAuction, abi, functionName: "OPENING_BID_BPS" });
if (openingBps !== 7_500n) throw new Error("Staged auction does not enforce the 75% fair-value opening bid");
const [minTerm, maxTerm] = await Promise.all([
  client.readContract({ address: staged.contracts.LoanManager, abi, functionName: "MIN_TERM_DAYS" }),
  client.readContract({ address: staged.contracts.LoanManager, abi, functionName: "MAX_TERM_DAYS" }),
]);
if (minTerm !== 30 || maxTerm !== 90) throw new Error("Staged manager does not support the selected loan terms");
const newLiquidity = await client.readContract({ address: newPool, abi, functionName: "availableLiquidity" });
if (newLiquidity >= 3_500_000_000n) {
  console.log("Staged pool already has enough liquidity for a capped demo loan.");
  process.exit(0);
}
const [oldLiquidity, deployedPrincipal, totalShares, ownedShares, maxWithdraw, walletBalance] = await Promise.all([
  client.readContract({ address: oldPool, abi, functionName: "availableLiquidity" }),
  client.readContract({ address: oldPool, abi, functionName: "deployedPrincipal" }),
  client.readContract({ address: oldPool, abi, functionName: "totalSupply" }),
  client.readContract({ address: oldPool, abi, functionName: "balanceOf", args: [account.address] }),
  client.readContract({ address: oldPool, abi, functionName: "maxWithdraw", args: [account.address] }),
  client.readContract({ address: currency, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
]);
if (totalShares !== ownedShares) throw new Error("Old pool has shares owned by someone else; rollover stopped");
const needed = 3_500_000_000n - newLiquidity;
const withdrawal = needed > walletBalance ? needed - walletBalance : 0n;
const oldPoolBuffer = deployedPrincipal > 0n ? 1_000_000_000n : 0n;
if (maxWithdraw < withdrawal || oldLiquidity < withdrawal + deployedPrincipal + oldPoolBuffer) throw new Error("Keep active loans funded in the old pool");

async function confirm(hash: Hex, label: string) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  console.log(`${label}: ${hash}`);
}

if (withdrawal > 0n) {
  await client.simulateContract({ account, address: oldPool, abi, functionName: "withdraw", args: [withdrawal, account.address, account.address] });
  await confirm(await wallet.writeContract({ address: oldPool, abi, functionName: "withdraw", args: [withdrawal, account.address, account.address] }), "Withdraw deployer-owned surplus liquidity");
}
const balance = await client.readContract({ address: currency, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
if (balance < needed) throw new Error("Not enough MockUSDC to seed the staged market");
const allowance = await client.readContract({ address: currency, abi: erc20Abi, functionName: "allowance", args: [account.address, newPool] });
if (allowance < needed) await confirm(await wallet.writeContract({ address: currency, abi: erc20Abi, functionName: "approve", args: [newPool, needed] }), "Approve staged pool");
await client.simulateContract({ account, address: newPool, abi, functionName: "deposit", args: [needed, account.address] });
await confirm(await wallet.writeContract({ address: newPool, abi, functionName: "deposit", args: [needed, account.address] }), "Seed staged pool");
const funded = await client.readContract({ address: newPool, abi, functionName: "availableLiquidity" });
if (funded < 3_500_000_000n) throw new Error("Staged pool has insufficient liquidity after deposit");
console.log(`Staged pool available liquidity: ${funded / 1_000_000n} MockUSDC`);
