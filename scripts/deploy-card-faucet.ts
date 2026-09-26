import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, http, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

process.loadEnvFile(".env.local");
const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("DEPLOYER_PRIVATE_KEY is required");
const account = privateKeyToAccount(key);
const deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as { chainId: number; contracts: { VaultedCardNFT: Address } };
if (deployment.chainId !== sepolia.id) throw new Error("Expected Sepolia");
const cardAddress = deployment.contracts.VaultedCardNFT;
const faucetArtifact = JSON.parse(await readFile("artifacts/contracts/DemoCardFaucet.sol/DemoCardFaucet.json", "utf8")) as { abi: Abi; bytecode: Hex };
const cardArtifact = JSON.parse(await readFile("artifacts/contracts/VaultedCardNFT.sol/VaultedCardNFT.json", "utf8")) as { abi: Abi };
const chain = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
const wallet = createWalletClient({ chain: sepolia, account, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
const path = "deployments/card-faucet-sepolia.json";
let saved: { chainId: number; address: Address; blockNumber: number; txHash: Hex } | null = null;
try { saved = JSON.parse(await readFile(path, "utf8")); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }

let address: Address;
if (saved) {
  if (saved.chainId !== sepolia.id || !await chain.getCode({ address: saved.address })) throw new Error("Saved faucet deployment is invalid");
  address = saved.address;
  console.log(`DemoCardFaucet: ${address} (existing)`);
} else {
  const hash = await wallet.deployContract({ abi: faucetArtifact.abi, bytecode: faucetArtifact.bytecode, args: [cardAddress, account.address] });
  const receipt = await chain.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`Deployment failed: ${hash}`);
  address = receipt.contractAddress;
  saved = { chainId: sepolia.id, address, blockNumber: Number(receipt.blockNumber), txHash: hash };
  await writeFile(path, `${JSON.stringify(saved, null, 2)}\n`);
  console.log(`DemoCardFaucet: ${address} (${hash})`);
}

const role = await chain.readContract({ address: cardAddress, abi: cardArtifact.abi, functionName: "CUSTODIAN_ROLE" }) as Hex;
const authorized = await chain.readContract({ address: cardAddress, abi: cardArtifact.abi, functionName: "hasRole", args: [role, address] });
if (!authorized) {
  const hash = await wallet.writeContract({ address: cardAddress, abi: cardArtifact.abi, functionName: "grantRole", args: [role, address] });
  const receipt = await chain.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Custodian grant failed: ${hash}`);
  console.log(`Custodian role granted: ${hash}`);
}

const env = await readFile(".env.local", "utf8");
const name = "NEXT_PUBLIC_CARD_FAUCET_ADDRESS";
const next = new RegExp(`^${name}=.*$`, "m").test(env)
  ? env.replace(new RegExp(`^${name}=.*$`, "m"), `${name}=${address}`)
  : `${env.trimEnd()}\n${name}=${address}\n`;
await writeFile(".env.local", next, { mode: 0o600 });
console.log(`Configured ${name}`);
