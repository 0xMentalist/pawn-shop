import { readFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

process.loadEnvFile(".env.local");
const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set DEPLOYER_PRIVATE_KEY");
const previous = JSON.parse(await readFile("deployments/sepolia-previous.json", "utf8")) as { chainId: number; contracts: { LoanManager?: Address } };
const manager = previous.contracts.LoanManager;
if (previous.chainId !== sepolia.id || !manager) throw new Error("Previous Sepolia manager is missing");
const account = privateKeyToAccount(key);
const transport = http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL);
const publicClient = createPublicClient({ chain: sepolia, transport });
const walletClient = createWalletClient({ account, chain: sepolia, transport });
const abi = parseAbi(["function paused() view returns (bool)", "function pauseOriginations()"]);

if (await publicClient.readContract({ address: manager, abi, functionName: "paused" })) {
  console.log("Previous manager already has originations paused.");
} else {
  const hash = await walletClient.writeContract({ address: manager, abi, functionName: "pauseOriginations" });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Pause failed: ${hash}`);
  console.log(`Paused previous manager originations: ${hash}`);
}
