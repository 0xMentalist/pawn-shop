import { readFile, writeFile } from "node:fs/promises";
import {
  createPublicClient, createWalletClient, encodeAbiParameters, encodeFunctionData, http,
  keccak256, namehash, parseAbi, parseEventLogs, parseEther, stringToHex, toHex,
  zeroAddress, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { normalize, packetToBytes } from "viem/ens";

process.loadEnvFile(".env.local");
const protocolKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const appraiserKey = process.env.APPRAISER_PRIVATE_KEY as Hex | undefined;
if (!protocolKey || !/^0x[0-9a-fA-F]{64}$/.test(protocolKey)) throw new Error("Set DEPLOYER_PRIVATE_KEY");
if (!appraiserKey || !/^0x[0-9a-fA-F]{64}$/.test(appraiserKey)) throw new Error("Set APPRAISER_PRIVATE_KEY");
const protocol = privateKeyToAccount(protocolKey);
const appraiser = privateKeyToAccount(appraiserKey);
if (protocol.address.toLowerCase() === appraiser.address.toLowerCase()) throw new Error("Appraiser must be a separate wallet");
const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const client = createPublicClient({ chain: sepolia, transport: http(rpc) });
const wallet = createWalletClient({ account: protocol, chain: sepolia, transport: http(rpc) });
const appraiserWallet = createWalletClient({ account: appraiser, chain: sepolia, transport: http(rpc) });
const name = "altrwalend.eth";
const appraiserName = `appraiser.${name}`;
const noteKey = "com.altrwalend.appraiser.note";
const noteValue = "Sepolia demo signer. Valuations use fixture data, not live market prices.";
const rootRegistry = "0x657ea849311d3d5823348dded7c2aaafb3ede09e" as Address;
const factory = "0x9e726eb570beb6bceb495ab8cda7df517d4e841c" as Address;
const resolverImpl = "0x14f09fd05d4585759e54844dc9b00147131cf243" as Address;
const allRoles = BigInt(`0x${"1".repeat(64)}`);
const textRole = 1n << 4n;
const checkpointPath = "deployments/ens-protocol-sepolia.json";
const rootAbi = parseAbi(["function findOwner(string label) view returns (address)", "function getSubregistry(string label) view returns (address)"]);
const registryAbi = parseAbi([
  "function findOwner(string label) view returns (address)",
  "function getResolver(string label) view returns (address)",
  "function register(string label,address owner,address subregistry,address resolver,uint256 roleBitmap,uint64 expiry) returns (uint256)",
]);
const factoryAbi = parseAbi([
  "function deployProxy(address implementation,uint256 salt,bytes data) returns (address)",
  "event ProxyDeployed(address indexed sender,address indexed proxyAddress,uint256 salt,address implementation)",
]);
const resolverAbi = parseAbi([
  "function initialize((address account,uint256 roleBitmap)[] grants,bytes[] calls)",
  "function setAddress(bytes name,uint256 coinType,bytes addressBytes)",
  "function setText(bytes name,string key,string value)",
  "function grantSetterRoles(bytes setter,address account)",
  "function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns (bool)",
  "function hasRootRoles(uint256 roleBitmap,address account) view returns (bool)",
]);
type Checkpoint = {
  chainId: number;
  name: string;
  owner: Address;
  resolver: Address;
  subregistry: Address;
  appraiserResolver?: Address;
  appraiser?: Address;
  transactions: Record<string, Hex>;
};
const state = JSON.parse(await readFile(checkpointPath, "utf8")) as Checkpoint;
if (state.chainId !== sepolia.id || state.name !== name || state.owner.toLowerCase() !== protocol.address.toLowerCase()) throw new Error("Protocol ENS checkpoint mismatch");
const deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as { contracts: Record<string, Address> };
const expectedAddresses = {
  appraiser: appraiser.address,
  pool: deployment.contracts.LendingPool,
  auction: deployment.contracts.LiquidationAuction,
};
for (const [label, address] of Object.entries(expectedAddresses)) if (!address || address === zeroAddress) throw new Error(`Missing ${label} address`);
const dns = (fullName: string) => toHex(packetToBytes(normalize(fullName)));
async function save() { await writeFile(checkpointPath, `${JSON.stringify(state, null, 2)}\n`); }
async function confirmed(hash: Hex, description: string) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${description} reverted: ${hash}`);
  console.log(`${description}: ${hash}`);
  return receipt;
}
async function send(request: Parameters<typeof wallet.writeContract>[0], description: string) {
  const hash = await wallet.writeContract(request);
  await confirmed(hash, description);
  state.transactions[description] = hash;
  await save();
}
async function ensureAppraiserResolver(): Promise<Address> {
  if (state.appraiserResolver) {
    const code = await client.getCode({ address: state.appraiserResolver });
    if (!code || code === "0x") throw new Error("Saved appraiser resolver has no code");
    return state.appraiserResolver;
  }
  const salt = BigInt(keccak256(encodeAbiParameters(
    [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }],
    [keccak256(stringToHex("AppraiserResolver")), namehash(appraiserName), 0n],
  )));
  const initData = encodeFunctionData({ abi: resolverAbi, functionName: "initialize", args: [
    [{ account: protocol.address, roleBitmap: allRoles }],
    [encodeFunctionData({ abi: resolverAbi, functionName: "setAddress", args: [dns(appraiserName), 60n, appraiser.address] })],
  ] });
  const { request } = await client.simulateContract({ account: protocol, address: factory, abi: factoryAbi, functionName: "deployProxy", args: [resolverImpl, salt, initData] });
  const hash = await wallet.writeContract(request);
  const receipt = await confirmed(hash, "Appraiser resolver proxy");
  const event = parseEventLogs({ abi: factoryAbi, eventName: "ProxyDeployed", logs: receipt.logs })[0];
  if (!event || event.args.implementation.toLowerCase() !== resolverImpl.toLowerCase()) throw new Error("Missing appraiser resolver deployment event");
  state.appraiserResolver = event.args.proxyAddress;
  state.transactions.appraiserResolver = hash;
  await save();
  return event.args.proxyAddress;
}
async function ensureSubname(label: keyof typeof expectedAddresses, resolver: Address) {
  const current = await client.readContract({ address: state.subregistry, abi: registryAbi, functionName: "findOwner", args: [label] });
  if (current === zeroAddress) {
    const expiry = (await client.getBlock()).timestamp + 180n * 24n * 60n * 60n;
    const { request } = await client.simulateContract({ account: protocol, address: state.subregistry, abi: registryAbi, functionName: "register", args: [label, protocol.address, zeroAddress, resolver, 0n, expiry] });
    await send(request, `register-${label}`);
  } else if (current.toLowerCase() !== protocol.address.toLowerCase()) {
    throw new Error(`${label}.${name} is held by another account`);
  }
  const actualResolver = await client.readContract({ address: state.subregistry, abi: registryAbi, functionName: "getResolver", args: [label] });
  if (actualResolver.toLowerCase() !== resolver.toLowerCase()) throw new Error(`${label}.${name} uses an unexpected resolver`);
  const fullName = `${label}.${name}`;
  const resolved = await client.getEnsAddress({ name: fullName });
  if (resolved?.toLowerCase() !== expectedAddresses[label].toLowerCase()) {
    if (label === "appraiser") throw new Error(`${fullName} does not resolve to the appraiser`);
    const { request } = await client.simulateContract({ account: protocol, address: resolver, abi: resolverAbi, functionName: "setAddress", args: [dns(fullName), 60n, expectedAddresses[label]] });
    await send(request, `address-${label}`);
  }
  const verified = await client.getEnsAddress({ name: fullName });
  if (verified?.toLowerCase() !== expectedAddresses[label].toLowerCase()) throw new Error(`${fullName} resolution failed`);
  console.log(`${fullName} -> ${verified}`);
}
async function ensureDelegation(resolver: Address) {
  const resource = BigInt(keccak256(stringToHex(noteKey)));
  const granted = await client.readContract({ address: resolver, abi: resolverAbi, functionName: "hasRoles", args: [resource, textRole, appraiser.address] });
  if (!granted) {
    const setter = encodeFunctionData({ abi: resolverAbi, functionName: "setText", args: ["0x", noteKey, ""] });
    const { request } = await client.simulateContract({ account: protocol, address: resolver, abi: resolverAbi, functionName: "grantSetterRoles", args: [setter, appraiser.address] });
    await send(request, "delegate-appraiser-note");
  }
  if (!(await client.readContract({ address: resolver, abi: resolverAbi, functionName: "hasRoles", args: [resource, textRole, appraiser.address] }))) throw new Error("Appraiser note delegation missing");
  if (await client.readContract({ address: resolver, abi: resolverAbi, functionName: "hasRootRoles", args: [textRole, appraiser.address] })) throw new Error("Appraiser unexpectedly has resolver-wide text access");
  await client.simulateContract({ account: appraiser, address: resolver, abi: resolverAbi, functionName: "setText", args: [dns(appraiserName), noteKey, noteValue] });
  for (const [description, functionName, args] of [
    ["unrelated text key", "setText", [dns(appraiserName), "description", "forbidden"]],
    ["address record", "setAddress", [dns(appraiserName), 60n, protocol.address]],
  ] as const) {
    try {
      await client.simulateContract({ account: appraiser, address: resolver, abi: resolverAbi, functionName, args });
      throw new Error(`Permission check failed: appraiser can edit ${description}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Permission check failed")) throw error;
    }
  }
  const current = await client.getEnsText({ name: appraiserName, key: noteKey });
  if (!current && process.argv.includes("--setup")) {
    const balance = await client.getBalance({ address: appraiser.address });
    if (balance < parseEther("0.0005")) {
      const hash = await wallet.sendTransaction({ to: appraiser.address, value: parseEther("0.002") });
      await confirmed(hash, "Fund demo appraiser for ENS record gas");
      state.transactions.fundAppraiser = hash;
      await save();
    }
    const { request } = await client.simulateContract({ account: appraiser, address: resolver, abi: resolverAbi, functionName: "setText", args: [dns(appraiserName), noteKey, noteValue] });
    const hash = await appraiserWallet.writeContract(request);
    await confirmed(hash, "Appraiser-published ENS note");
    state.transactions.appraiserNote = hash;
    await save();
  }
  const note = await client.getEnsText({ name: appraiserName, key: noteKey });
  if (!note) throw new Error("Appraiser ENS note did not resolve");
  console.log("Appraiser can edit only its delegated note key on its dedicated resolver; unrelated text and address writes are denied.");
}
async function main() {
  if (!process.argv.includes("--setup") && !process.argv.includes("--check")) throw new Error("Pass --setup or --check");
  if (await client.getChainId() !== sepolia.id) throw new Error("RPC is not Sepolia");
  const owner = await client.readContract({ address: rootRegistry, abi: rootAbi, functionName: "findOwner", args: ["altrwalend"] });
  const subregistry = await client.readContract({ address: rootRegistry, abi: rootAbi, functionName: "getSubregistry", args: ["altrwalend"] });
  if (owner.toLowerCase() !== protocol.address.toLowerCase() || subregistry.toLowerCase() !== state.subregistry.toLowerCase()) throw new Error("Protocol ENS root is not ready");
  if (state.appraiser && state.appraiser.toLowerCase() !== appraiser.address.toLowerCase()) throw new Error("Appraiser key differs from protocol ENS checkpoint");
  if (!state.appraiser) { state.appraiser = appraiser.address; await save(); }
  if (process.argv.includes("--check")) {
    for (const [label, address] of Object.entries(expectedAddresses)) {
      const resolved = await client.getEnsAddress({ name: `${label}.${name}` });
      if (resolved?.toLowerCase() !== address.toLowerCase()) throw new Error(`${label}.${name} resolves to ${resolved ?? "nothing"}, expected ${address}`);
      console.log(`${label}.${name} -> ${resolved}`);
    }
    if (state.appraiserResolver) await ensureDelegation(state.appraiserResolver);
    return;
  }
  const resolver = await ensureAppraiserResolver();
  await ensureSubname("appraiser", resolver);
  await ensureSubname("pool", state.resolver);
  await ensureSubname("auction", state.resolver);
  await ensureDelegation(resolver);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
