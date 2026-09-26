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
const target = 11_000_000_000n; // Covers all five demo cards' maximum loans: 10,853.50 MockUSDC.
const poolAbi = parseAbi([
  "function availableLiquidity() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function deposit(uint256 assets,address receiver) returns (uint256)",
]);
const faucetAbi = parseAbi(["function faucet()", "function nextFaucetAt(address) view returns (uint256)"]);

async function confirm(hash: Hex, description: string) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${description} reverted: ${hash}`);
  console.log(`${description}: ${hash}`);
}

if (await client.getChainId() !== sepolia.id) throw new Error("RPC is not Sepolia");
const current = await client.readContract({ address: pool, abi: poolAbi, functionName: "availableLiquidity" });
if (current >= target) {
  console.log(`Pool already has at least 11,000 MockUSDC of available liquidity.`);
} else {
  const needed = target - current;
  let balance = await client.readContract({ address: currency, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
  if (balance < needed) {
    const nextFaucetAt = await client.readContract({ address: currency, abi: faucetAbi, functionName: "nextFaucetAt", args: [account.address] });
    const block = await client.getBlock();
    if (block.timestamp >= nextFaucetAt) {
      await confirm(await wallet.writeContract({ address: currency, abi: faucetAbi, functionName: "faucet" }), "Claim MockUSDC faucet");
      balance = await client.readContract({ address: currency, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
    }
  }
  const depositAmount = balance < needed ? balance : needed;
  if (depositAmount < 3_500_000_000n) throw new Error("At least 3,500 MockUSDC is needed to fund one capped demo loan");
  const allowance = await client.readContract({ address: currency, abi: erc20Abi, functionName: "allowance", args: [account.address, pool] });
  if (allowance < depositAmount) await confirm(await wallet.writeContract({ address: currency, abi: erc20Abi, functionName: "approve", args: [pool, depositAmount] }), "Approve demo deposit");
  await confirm(await wallet.writeContract({ address: pool, abi: poolAbi, functionName: "deposit", args: [depositAmount, account.address] }), "Deposit demo liquidity");
  const available = await client.readContract({ address: pool, abi: poolAbi, functionName: "availableLiquidity" });
  const shares = await client.readContract({ address: pool, abi: poolAbi, functionName: "balanceOf", args: [account.address] });
  if (available < current + depositAmount || shares === 0n) throw new Error("Demo liquidity deposit was not reflected in the pool");
  console.log(`Pool has ${available / 1_000_000n} MockUSDC available; deployer owns ${shares} pool share base units.`);
  if (available < target) console.log(`The 11,000 MockUSDC target needs another faucet claim after its cooldown.`);
}
