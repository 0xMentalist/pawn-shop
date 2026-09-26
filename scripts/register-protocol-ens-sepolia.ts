import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  http,
  isAddress,
  keccak256,
  namehash,
  parseAbi,
  parseEventLogs,
  stringToHex,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { normalize, packetToBytes } from "viem/ens";

process.loadEnvFile(".env.local");

const name = normalize("altrwalend.eth");
const label = name.split(".")[0];
const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env.local");
const payer = privateKeyToAccount(key);
const owner = payer.address;
const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const client = createPublicClient({ chain: sepolia, transport: http(rpc) });
const wallet = createWalletClient({ account: payer, chain: sepolia, transport: http(rpc) });

// ENSv2 Beta Sepolia deployments: https://docs.ens.domains/learn/deployments/
const registrar = "0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca" as Address;
const ethRegistry = "0x657ea849311d3d5823348dded7c2aaafb3ede09e" as Address;
const paymentToken = "0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e" as Address;
const factory = "0x9e726eb570beb6bceb495ab8cda7df517d4e841c" as Address;
const resolverImpl = "0x14f09fd05d4585759e54844dc9b00147131cf243" as Address;
const registryImpl = "0xa80338aaa8d23831cea25e858d1774534abb0263" as Address;
const duration = 31_536_000n;
const referrer = `0x${"0".repeat(64)}` as Hex;
const allRoles = BigInt(`0x${"1".repeat(64)}`);
const outputPath = "deployments/ens-protocol-sepolia.json";
const secretPath = "data/ens-protocol-commitment.json";

const registrarAbi = parseAbi([
  "function isAvailable(string label) view returns (bool)",
  "function getRegisterPrice(string label,uint64 duration,address paymentToken) view returns (uint256 base,uint256 premium)",
  "function makeCommitment(string label,address owner,bytes32 secret,address subregistry,address resolver,uint64 duration,bytes32 referrer) view returns (bytes32)",
  "function commit(bytes32 commitment)",
  "function commitmentAt(bytes32 commitment) view returns (uint64)",
  "function MIN_COMMITMENT_AGE() view returns (uint64)",
  "function MAX_COMMITMENT_AGE() view returns (uint64)",
  "function register(string label,address owner,bytes32 secret,address subregistry,address resolver,uint64 duration,address paymentToken,bytes32 referrer) returns (uint256)",
]);
const registryAbi = parseAbi(["function findOwner(string label) view returns (address)"]);
const factoryAbi = parseAbi([
  "function deployProxy(address implementation,uint256 salt,bytes data) returns (address)",
  "event ProxyDeployed(address indexed sender,address indexed proxyAddress,uint256 salt,address implementation)",
]);
const resolverAbi = parseAbi([
  "function initialize((address account,uint256 roleBitmap)[] grants,bytes[] calls)",
  "function setAddress(bytes name,uint256 coinType,bytes addressBytes)",
]);
const userRegistryAbi = parseAbi(["function initialize((address account,uint256 roleBitmap)[] grants)"]);
const mintAbi = parseAbi(["function mint(address to,uint256 amount)"]);

type Checkpoint = {
  chainId: number;
  name: string;
  owner: Address;
  payer: Address;
  resolver?: Address;
  subregistry?: Address;
  commitment?: Hex;
  transactions: Record<string, Hex>;
};

async function loadCheckpoint(): Promise<Checkpoint> {
  try {
    const state = JSON.parse(await readFile(outputPath, "utf8")) as Checkpoint;
    if (state.chainId !== sepolia.id || state.name !== name || state.owner.toLowerCase() !== owner.toLowerCase() || state.payer.toLowerCase() !== payer.address.toLowerCase()) {
      throw new Error("ENS checkpoint belongs to another name, owner, payer, or chain");
    }
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { chainId: sepolia.id, name, owner, payer: payer.address, transactions: {} };
  }
}
async function save(state: Checkpoint) {
  await mkdir("deployments", { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(state, null, 2)}\n`);
}
async function confirmed(hash: Hex, description: string) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${description} reverted: ${hash}`);
  console.log(`${description}: ${hash}`);
  return receipt;
}
async function deployProxy(implementation: Address, salt: bigint, initData: Hex, description: string): Promise<{ address: Address; hash: Hex }> {
  const { request } = await client.simulateContract({ account: payer, address: factory, abi: factoryAbi, functionName: "deployProxy", args: [implementation, salt, initData] });
  const hash = await wallet.writeContract(request);
  const receipt = await confirmed(hash, description);
  const event = parseEventLogs({ abi: factoryAbi, eventName: "ProxyDeployed", logs: receipt.logs })[0];
  if (!event || event.args.implementation.toLowerCase() !== implementation.toLowerCase()) throw new Error(`${description} event missing: ${hash}`);
  return { address: event.args.proxyAddress, hash };
}
async function ensureProxy(state: Checkpoint, kind: "resolver" | "subregistry") {
  const existing = state[kind];
  if (existing) {
    const code = await client.getCode({ address: existing });
    if (!code || code === "0x") throw new Error(`Saved ${kind} has no code`);
    return existing;
  }
  const salt = BigInt(keccak256(encodeAbiParameters(
    [{ type: "bytes32" }, { type: kind === "resolver" ? "address" : "bytes32" }, { type: "uint256" }],
    [keccak256(stringToHex(kind === "resolver" ? "OwnedResolver" : "UserRegistry")), kind === "resolver" ? owner : namehash(name), 0n],
  )));
  const initData = kind === "resolver"
    ? encodeFunctionData({ abi: resolverAbi, functionName: "initialize", args: [
      [{ account: owner, roleBitmap: allRoles }],
      [encodeFunctionData({ abi: resolverAbi, functionName: "setAddress", args: [toHex(packetToBytes(name)), 60n, owner] })],
    ] })
    : encodeFunctionData({ abi: userRegistryAbi, functionName: "initialize", args: [[{ account: owner, roleBitmap: allRoles }]] });
  const result = await deployProxy(kind === "resolver" ? resolverImpl : registryImpl, salt, initData, `ENS ${kind} proxy`);
  state[kind] = result.address;
  state.transactions[kind] = result.hash;
  await save(state);
  return result.address;
}

async function ensurePayment(state: Checkpoint, cost: bigint) {
  const balance = await client.readContract({ address: paymentToken, abi: erc20Abi, functionName: "balanceOf", args: [payer.address] });
  if (balance < cost) {
    const hash = await wallet.writeContract({ address: paymentToken, abi: mintAbi, functionName: "mint", args: [payer.address, cost - balance] });
    await confirmed(hash, "Mint ENS test USDC");
    state.transactions.mint = hash;
    await save(state);
  }
  const allowance = await client.readContract({ address: paymentToken, abi: erc20Abi, functionName: "allowance", args: [payer.address, registrar] });
  if (allowance < cost) {
    const hash = await wallet.writeContract({ address: paymentToken, abi: erc20Abi, functionName: "approve", args: [registrar, cost] });
    await confirmed(hash, "Approve ENS test USDC");
    state.transactions.approve = hash;
    await save(state);
  }
}

async function main() {
  if (await client.getChainId() !== sepolia.id) throw new Error("RPC is not Sepolia");
  const currentOwner = await client.readContract({ address: ethRegistry, abi: registryAbi, functionName: "findOwner", args: [label] });
  if (currentOwner !== zeroAddress) {
    if (currentOwner.toLowerCase() !== owner.toLowerCase()) throw new Error(`${name} is owned by another wallet: ${currentOwner}`);
    console.log(`${name} is already registered to ${owner}`);
    const resolved = await client.getEnsAddress({ name });
    console.log(`Resolved ETH address: ${resolved ?? "none"}`);
    return;
  }
  const available = await client.readContract({ address: registrar, abi: registrarAbi, functionName: "isAvailable", args: [label] });
  if (!available) throw new Error(`${name} is unavailable for registration`);
  console.log(`Registering ${name} on ENSv2 Sepolia for ${owner}; payer ${payer.address}`);
  if (process.argv.includes("--check")) {
    const [base, premium] = await client.readContract({ address: registrar, abi: registrarAbi, functionName: "getRegisterPrice", args: [label, duration, paymentToken] });
    console.log(`One-year test USDC cost: ${base + premium} base units`);
    return;
  }
  if (!process.argv.includes("--register")) throw new Error("Pass --check or --register");
  if (await client.getBalance({ address: payer.address }) === 0n) throw new Error("Fund the Sepolia payer with test ETH");

  const state = await loadCheckpoint();
  const resolver = await ensureProxy(state, "resolver");
  const subregistry = await ensureProxy(state, "subregistry");
  const [base, premium] = await client.readContract({ address: registrar, abi: registrarAbi, functionName: "getRegisterPrice", args: [label, duration, paymentToken] });
  await ensurePayment(state, base + premium);

  await mkdir("data", { recursive: true });
  let secret: Hex;
  try {
    const stored = JSON.parse(await readFile(secretPath, "utf8")) as { name: string; owner: Address; secret: Hex };
    if (stored.name !== name || stored.owner.toLowerCase() !== owner.toLowerCase() || !/^0x[0-9a-fA-F]{64}$/.test(stored.secret)) throw new Error("Invalid ENS commitment checkpoint");
    secret = stored.secret;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    secret = toHex(randomBytes(32));
    await writeFile(secretPath, `${JSON.stringify({ name, owner, secret })}\n`, { mode: 0o600 });
  }
  const commitment = await client.readContract({ address: registrar, abi: registrarAbi, functionName: "makeCommitment", args: [label, owner, secret, subregistry, resolver, duration, referrer] });
  if (state.commitment && state.commitment !== commitment) throw new Error("Checkpoint commitment does not match the saved secret and proxy addresses");
  state.commitment = commitment;
  await save(state);
  let committedAt = await client.readContract({ address: registrar, abi: registrarAbi, functionName: "commitmentAt", args: [commitment] });
  const maxAge = await client.readContract({ address: registrar, abi: registrarAbi, functionName: "MAX_COMMITMENT_AGE" });
  const latest = await client.getBlock();
  if (committedAt === 0n || latest.timestamp > committedAt + maxAge) {
    const hash = await wallet.writeContract({ address: registrar, abi: registrarAbi, functionName: "commit", args: [commitment] });
    await confirmed(hash, "ENS commitment");
    state.transactions.commit = hash;
    await save(state);
    committedAt = await client.readContract({ address: registrar, abi: registrarAbi, functionName: "commitmentAt", args: [commitment] });
  }
  const minAge = await client.readContract({ address: registrar, abi: registrarAbi, functionName: "MIN_COMMITMENT_AGE" });
  while ((await client.getBlock()).timestamp < committedAt + minAge) {
    console.log("Waiting for the ENS commitment age...");
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  const args = [label, owner, secret, subregistry, resolver, duration, paymentToken, referrer] as const;
  const { request } = await client.simulateContract({ account: payer, address: registrar, abi: registrarAbi, functionName: "register", args });
  const hash = await wallet.writeContract(request);
  await confirmed(hash, "ENS registration");
  state.transactions.register = hash;
  await save(state);

  const verifiedOwner = await client.readContract({ address: ethRegistry, abi: registryAbi, functionName: "findOwner", args: [label] });
  if (verifiedOwner.toLowerCase() !== owner.toLowerCase()) throw new Error(`Registration confirmed but owner check failed: ${verifiedOwner}`);
  const resolved = await client.getEnsAddress({ name });
  if (resolved?.toLowerCase() !== owner.toLowerCase()) throw new Error(`Registration confirmed but forward resolution failed: ${resolved ?? "none"}`);
  console.log(`${name} now belongs to ${owner} and resolves to that wallet on Sepolia.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
