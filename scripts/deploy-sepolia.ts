import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPublicClient, createWalletClient, formatEther, http, isAddress, keccak256, toBytes, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

process.loadEnvFile(".env.local");

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const appraiserKey = process.env.APPRAISER_PRIVATE_KEY as Hex | undefined;
const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
if (!deployerKey || !/^0x[0-9a-fA-F]{64}$/.test(deployerKey)) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env.local");
if (!appraiserKey || !/^0x[0-9a-fA-F]{64}$/.test(appraiserKey)) throw new Error("Set APPRAISER_PRIVATE_KEY in .env.local");
const account = privateKeyToAccount(deployerKey);
const appraiser = privateKeyToAccount(appraiserKey).address;
const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
const outputPath = resolve("deployments/sepolia.json");
const admin = account.address;

type ContractName = "MockUSDC" | "VaultedCardNFT" | "HumanVerificationRegistry" | "ValuationVerifier" | "LendingPool" | "LoanVaultFactory" | "LoanManager" | "LiquidationAuction";
type Deployment = { chainId: number; deployer: Address; contracts: Partial<Record<ContractName, Address>>; transactionHashes: Partial<Record<ContractName, Hex>>; blockNumbers: Partial<Record<ContractName, number>> };

async function artifact(name: ContractName): Promise<{ abi: Abi; bytecode: Hex }> {
  const file = resolve(`artifacts/contracts/${name}.sol/${name}.json`);
  const parsed = JSON.parse(await readFile(file, "utf8"));
  if (!parsed.bytecode || parsed.bytecode === "0x") throw new Error(`Compile ${name} before deploying`);
  return { abi: parsed.abi as Abi, bytecode: parsed.bytecode as Hex };
}

async function existingDeployment(): Promise<Deployment> {
  try {
    const stored = JSON.parse(await readFile(outputPath, "utf8")) as Deployment;
    if (stored.chainId !== sepolia.id || stored.deployer.toLowerCase() !== admin.toLowerCase()) throw new Error("Deployment file belongs to another chain or deployer");
    return stored;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { chainId: sepolia.id, deployer: admin, contracts: {}, transactionHashes: {}, blockNumbers: {} };
  }
}

async function persist(state: Deployment) {
  await writeFile(outputPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o644 });
}

async function deploy(state: Deployment, name: ContractName, args: readonly unknown[] = []): Promise<Address> {
  const known = state.contracts[name];
  if (known) {
    const code = await publicClient.getCode({ address: known });
    if (!code || code === "0x") throw new Error(`Saved ${name} address has no bytecode: ${known}`);
    console.log(`${name}: ${known} (existing)`);
    return known;
  }
  const compiled = await artifact(name);
  const hash = await walletClient.deployContract({ abi: compiled.abi, bytecode: compiled.bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${name} deployment failed: ${hash}`);
  state.contracts[name] = receipt.contractAddress;
  state.transactionHashes[name] = hash;
  state.blockNumbers ??= {};
  state.blockNumbers[name] = Number(receipt.blockNumber);
  await persist(state);
  console.log(`${name}: ${receipt.contractAddress} (${hash})`);
  return receipt.contractAddress;
}

async function setup(name: ContractName, address: Address, functionName: string, args: readonly unknown[], alreadyDone: () => Promise<boolean>) {
  if (await alreadyDone()) return;
  const { abi } = await artifact(name);
  const hash = await walletClient.writeContract({ address, abi, functionName, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${name}.${functionName} failed: ${hash}`);
  console.log(`${name}.${functionName}: ${hash}`);
}

async function upsertPublicEnv(addresses: Deployment["contracts"]) {
  const values: Record<string, string> = {
    NEXT_PUBLIC_MOCK_USDC_ADDRESS: addresses.MockUSDC!,
    NEXT_PUBLIC_CARD_ADDRESS: addresses.VaultedCardNFT!,
    NEXT_PUBLIC_VALUATION_VERIFIER_ADDRESS: addresses.ValuationVerifier!,
    NEXT_PUBLIC_LENDING_POOL_ADDRESS: addresses.LendingPool!,
    NEXT_PUBLIC_LOAN_MANAGER_ADDRESS: addresses.LoanManager!,
    NEXT_PUBLIC_AUCTION_ADDRESS: addresses.LiquidationAuction!,
    NEXT_PUBLIC_HUMAN_REGISTRY_ADDRESS: addresses.HumanVerificationRegistry!,
  };
  let env = await readFile(".env.local", "utf8");
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
  }
  await writeFile(".env.local", env, { mode: 0o600 });
}

async function main() {
  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) throw new Error(`Expected Sepolia chain ${sepolia.id}, got ${chainId}`);
  const balance = await publicClient.getBalance({ address: admin });
  console.log(`Sepolia deployer: ${admin}`);
  console.log(`ETH balance: ${formatEther(balance)}`);
  if (process.argv.includes("--check")) return;
  if (!process.argv.includes("--deploy")) throw new Error("Pass --check to inspect or --deploy to send transactions");
  if (balance === 0n) throw new Error("Fund the deployer with Sepolia ETH before deployment");

  const state = await existingDeployment();
  const currency = await deploy(state, "MockUSDC");
  const card = await deploy(state, "VaultedCardNFT", [admin, admin]);
  const registry = await deploy(state, "HumanVerificationRegistry", [admin, admin]);
  const verifier = await deploy(state, "ValuationVerifier", [admin, appraiser, card, currency]);
  const pool = await deploy(state, "LendingPool", [currency, admin]);
  const factory = await deploy(state, "LoanVaultFactory", [admin]);
  const manager = await deploy(state, "LoanManager", [admin, admin, pool, card, verifier, registry, factory, true]);
  const auction = await deploy(state, "LiquidationAuction", [manager, currency, card, admin]);
  const role = keccak256(toBytes("LOAN_MANAGER_ROLE"));
  await setup("LendingPool", pool, "setLoanManager", [manager], async () => (await publicClient.readContract({ address: pool, abi: (await artifact("LendingPool")).abi, functionName: "loanManager" })) === manager);
  await setup("LoanVaultFactory", factory, "setLoanManager", [manager], async () => (await publicClient.readContract({ address: factory, abi: (await artifact("LoanVaultFactory")).abi, functionName: "loanManager" })) === manager);
  await setup("VaultedCardNFT", card, "grantRole", [role, manager], async () => Boolean(await publicClient.readContract({ address: card, abi: (await artifact("VaultedCardNFT")).abi, functionName: "hasRole", args: [role, manager] })));
  await setup("ValuationVerifier", verifier, "grantRole", [role, manager], async () => Boolean(await publicClient.readContract({ address: verifier, abi: (await artifact("ValuationVerifier")).abi, functionName: "hasRole", args: [role, manager] })));
  await setup("LoanManager", manager, "setAuction", [auction], async () => (await publicClient.readContract({ address: manager, abi: (await artifact("LoanManager")).abi, functionName: "auction" })) === auction);
  await upsertPublicEnv(state.contracts);
  console.log("Deployment complete. Public addresses saved in deployments/sepolia.json and .env.local.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
