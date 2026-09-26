import { readFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, erc20Abi, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

process.loadEnvFile(".env.local");
const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env.local");
const account = privateKeyToAccount(key);
const deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as { chainId: number; contracts: { MockUSDC?: Address; LendingPool?: Address } };
const currency = deployment.contracts.MockUSDC;
const pool = deployment.contracts.LendingPool;
if (deployment.chainId !== sepolia.id || !currency || !pool) throw new Error("Sepolia currency and pool must be deployed first");
const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
const client = createPublicClient({ chain: sepolia, transport: http(rpc) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpc) });
const target = 5_000_000_000n; // 5,000 valueless MockUSDC, enough for the 3,500 demo quote.
const poolAbi = parseAbi([
  "function availableLiquidity() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function deposit(uint256 assets,address receiver) returns (uint256)",
]);
const faucetAbi = parseAbi(["function faucet()"]);

async function confirm(hash: Hex, description: string) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${description} reverted: ${hash}`);
  console.log(`${description}: ${hash}`);
}

if (await client.getChainId() !== sepolia.id) throw new Error("RPC is not Sepolia");
const current = await client.readContract({ address: pool, abi: poolAbi, functionName: "availableLiquidity" });
if (current >= target) {
  console.log(`Pool already has at least 5,000 MockUSDC of available liquidity.`);
} else {
  const needed = target - current;
  let balance = await client.readContract({ address: currency, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
  if (balance < needed) {
    await confirm(await wallet.writeContract({ address: currency, abi: faucetAbi, functionName: "faucet" }), "Claim MockUSDC faucet");
    balance = await client.readContract({ address: currency, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
    if (balance < needed) throw new Error("Faucet balance is insufficient for the demo deposit");
  }
  const allowance = await client.readContract({ address: currency, abi: erc20Abi, functionName: "allowance", args: [account.address, pool] });
  if (allowance < needed) await confirm(await wallet.writeContract({ address: currency, abi: erc20Abi, functionName: "approve", args: [pool, needed] }), "Approve demo deposit");
  await confirm(await wallet.writeContract({ address: pool, abi: poolAbi, functionName: "deposit", args: [needed, account.address] }), "Deposit demo liquidity");
  const available = await client.readContract({ address: pool, abi: poolAbi, functionName: "availableLiquidity" });
  const shares = await client.readContract({ address: pool, abi: poolAbi, functionName: "balanceOf", args: [account.address] });
  if (available < target || shares === 0n) throw new Error("Demo liquidity deposit did not reach its target");
  console.log(`Pool has ${available / 1_000_000n} MockUSDC available; deployer owns ${shares} pool share base units.`);
}
