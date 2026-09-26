import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const fresh = process.argv.includes("--fresh");
const outputPath = resolve(fresh ? "deployments/sepolia-next.json" : "deployments/sepolia.json");
const activePath = resolve("deployments/sepolia.json");
const admin = account.address;

type ContractName = "MockUSDC" | "VaultedCardNFT" | "HumanVerificationRegistry" | "ValuationVerifier" | "LendingPool" | "LoanVaultFactory" | "LoanManager" | "LiquidationAuction";
type Deployment = { chainId: number; deployer: Address; contracts: Partial<Record<ContractName, Address>>; transactionHashes: Partial<Record<ContractName, Hex>>; blockNumbers: Partial<Record<ContractName, number>> };

function freshMarketFrom(previous: Deployment): Deployment {
  const reused = ["MockUSDC", "VaultedCardNFT", "HumanVerificationRegistry", "ValuationVerifier"] as const;
  return {
    chainId: sepolia.id, deployer: admin,
    contracts: Object.fromEntries(reused.map((name) => [name, previous.contracts[name]])),
    transactionHashes: Object.fromEntries(reused.map((name) => [name, previous.transactionHashes[name]])),
    blockNumbers: Object.fromEntries(reused.map((name) => [name, previous.blockNumbers[name]])),
  } as Deployment;
}

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
    if (fresh) {
      const active = JSON.parse(await readFile(activePath, "utf8")) as Deployment;
      if (stored.contracts.LoanManager?.toLowerCase() === active.contracts.LoanManager?.toLowerCase()) return freshMarketFrom(active);
    }
    return stored;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (fresh) {
      const previous = JSON.parse(await readFile(activePath, "utf8")) as Deployment;
      if (previous.chainId !== sepolia.id || previous.deployer.toLowerCase() !== admin.toLowerCase()) throw new Error("Active deployment belongs to another chain or deployer");
      return freshMarketFrom(previous);
    }
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

async function upsertPublicEnv(addresses: Deployment["contracts"], previousManager?: Address) {
  let env = await readFile(".env.local", "utf8");
  const values: Record<string, string> = {
    NEXT_PUBLIC_MOCK_USDC_ADDRESS: addresses.MockUSDC!,
    NEXT_PUBLIC_CARD_ADDRESS: addresses.VaultedCardNFT!,
    NEXT_PUBLIC_VALUATION_VERIFIER_ADDRESS: addresses.ValuationVerifier!,
    NEXT_PUBLIC_LENDING_POOL_ADDRESS: addresses.LendingPool!,
    NEXT_PUBLIC_LOAN_MANAGER_ADDRESS: addresses.LoanManager!,
    NEXT_PUBLIC_AUCTION_ADDRESS: addresses.LiquidationAuction!,
    NEXT_PUBLIC_HUMAN_REGISTRY_ADDRESS: addresses.HumanVerificationRegistry!,
  };
  if (previousManager) {
    values.NEXT_PUBLIC_PREVIOUS_LOAN_MANAGER_ADDRESS = previousManager;
    const existing = /(?:^|\n)NEXT_PUBLIC_LEGACY_LOAN_MANAGER_ADDRESSES=([^\n]*)/.exec(env)?.[1] ?? "";
    const earlier = /(?:^|\n)NEXT_PUBLIC_PREVIOUS_LOAN_MANAGER_ADDRESS=([^\n]*)/.exec(env)?.[1] ?? "";
    const legacy = [...new Set([previousManager, ...existing.split(","), earlier].map((value) => value.trim().toLowerCase()).filter((value) => isAddress(value) && value !== addresses.LoanManager?.toLowerCase()))];
    values.NEXT_PUBLIC_LEGACY_LOAN_MANAGER_ADDRESSES = legacy.join(",");
  }
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
  }
  await writeFile(".env.local", env, { mode: 0o600 });
}

async function activateStaged() {
  const staged = JSON.parse(await readFile(resolve("deployments/sepolia-next.json"), "utf8")) as Deployment;
  const previous = JSON.parse(await readFile(activePath, "utf8")) as Deployment;
  if (staged.chainId !== sepolia.id || staged.deployer.toLowerCase() !== admin.toLowerCase()) throw new Error("Staged deployment belongs to another chain or deployer");
  for (const name of ["MockUSDC", "VaultedCardNFT", "HumanVerificationRegistry", "ValuationVerifier"] as const) {
    if (staged.contracts[name]?.toLowerCase() !== previous.contracts[name]?.toLowerCase()) throw new Error(`${name} must remain unchanged during market migration`);
  }
  for (const name of ["MockUSDC", "VaultedCardNFT", "HumanVerificationRegistry", "ValuationVerifier", "LendingPool", "LoanVaultFactory", "LoanManager", "LiquidationAuction"] as const) {
    const address = staged.contracts[name];
    const code = address ? await publicClient.getCode({ address }) : null;
    if (!code || code === "0x") throw new Error(`Staged ${name} is not deployed`);
  }
  const pool = staged.contracts.LendingPool!;
  const factory = staged.contracts.LoanVaultFactory!;
  const manager = staged.contracts.LoanManager!;
  const auction = staged.contracts.LiquidationAuction!;
  if (pool.toLowerCase() === previous.contracts.LendingPool?.toLowerCase() || manager.toLowerCase() === previous.contracts.LoanManager?.toLowerCase()) throw new Error("Replacement market must use new pool and manager contracts");
  const poolManager = await publicClient.readContract({ address: pool, abi: (await artifact("LendingPool")).abi, functionName: "loanManager" }) as Address;
  if (poolManager.toLowerCase() !== manager.toLowerCase()) throw new Error("Staged pool is not wired to the new manager");
  const available = await publicClient.readContract({ address: pool, abi: (await artifact("LendingPool")).abi, functionName: "availableLiquidity" });
  if (typeof available !== "bigint" || available < 3_500_000_000n) throw new Error("Staged pool needs enough liquidity for a demo loan");
  const factoryManager = await publicClient.readContract({ address: factory, abi: (await artifact("LoanVaultFactory")).abi, functionName: "loanManager" }) as Address;
  if (factoryManager.toLowerCase() !== manager.toLowerCase()) throw new Error("Staged vault factory is not wired to the new manager");
  const configuredAuction = await publicClient.readContract({ address: manager, abi: (await artifact("LoanManager")).abi, functionName: "auction" }) as Address;
  if (configuredAuction.toLowerCase() !== auction.toLowerCase()) throw new Error("Staged manager is not wired to the new auction");
  const previousPath = resolve("deployments/sepolia-previous.json");
  const archiveDir = resolve("deployments/archive");
  await mkdir(archiveDir, { recursive: true });
  for (const path of [previousPath, activePath]) {
    let retired: Deployment;
    try { retired = JSON.parse(await readFile(path, "utf8")) as Deployment; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    const managerAddress = retired.contracts.LoanManager;
    if (managerAddress) await writeFile(resolve(archiveDir, `sepolia-${managerAddress.toLowerCase()}.json`), `${JSON.stringify(retired, null, 2)}\n`);
  }
  await writeFile(previousPath, `${JSON.stringify(previous, null, 2)}\n`);
  await upsertPublicEnv(staged.contracts, previous.contracts.LoanManager);
  await writeFile(activePath, `${JSON.stringify(staged, null, 2)}\n`);
  console.log("Activated the new Sepolia lending market. Previous addresses are in deployments/sepolia-previous.json.");
}

async function main() {
  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) throw new Error(`Expected Sepolia chain ${sepolia.id}, got ${chainId}`);
  const balance = await publicClient.getBalance({ address: admin });
  console.log(`Sepolia deployer: ${admin}`);
  console.log(`ETH balance: ${formatEther(balance)}`);
  if (process.argv.includes("--check")) return;
  if (process.argv.includes("--activate")) return activateStaged();
  if (!process.argv.includes("--deploy")) throw new Error("Pass --check, --activate, or --deploy");
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
  await setup("LendingPool", pool, "setLoanManager", [manager], async () => String(await publicClient.readContract({ address: pool, abi: (await artifact("LendingPool")).abi, functionName: "loanManager" })).toLowerCase() === manager.toLowerCase());
  await setup("LoanVaultFactory", factory, "setLoanManager", [manager], async () => String(await publicClient.readContract({ address: factory, abi: (await artifact("LoanVaultFactory")).abi, functionName: "loanManager" })).toLowerCase() === manager.toLowerCase());
  await setup("VaultedCardNFT", card, "grantRole", [role, manager], async () => Boolean(await publicClient.readContract({ address: card, abi: (await artifact("VaultedCardNFT")).abi, functionName: "hasRole", args: [role, manager] })));
  await setup("ValuationVerifier", verifier, "grantRole", [role, manager], async () => Boolean(await publicClient.readContract({ address: verifier, abi: (await artifact("ValuationVerifier")).abi, functionName: "hasRole", args: [role, manager] })));
  await setup("LoanManager", manager, "setAuction", [auction], async () => String(await publicClient.readContract({ address: manager, abi: (await artifact("LoanManager")).abi, functionName: "auction" })).toLowerCase() === auction.toLowerCase());
  if (fresh) console.log("Replacement market staged in deployments/sepolia-next.json. Seed it before --activate.");
  else {
    await upsertPublicEnv(state.contracts);
    console.log("Deployment complete. Public addresses saved in deployments/sepolia.json and .env.local.");
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
