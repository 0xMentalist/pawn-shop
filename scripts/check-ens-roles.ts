import { readFile } from "node:fs/promises";
import { BaseError, ContractFunctionRevertedError, createPublicClient, http, parseAbi, toHex, type Address } from "viem";
import { sepolia } from "viem/chains";
import { normalize, packetToBytes } from "viem/ens";

process.loadEnvFile(".env.local");
const checkpoint = JSON.parse(await readFile("deployments/ens-sepolia.json", "utf8")) as { chainId: number; name: string; owner: Address; payer: Address; resolver: Address; subregistry: Address };
if (checkpoint.chainId !== sepolia.id) throw new Error("ENS checkpoint is not Sepolia");
const client = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
const registry = "0x657ea849311d3d5823348dded7c2aaafb3ede09e" as Address;
const registryAbi = parseAbi([
  "function findOwner(string label) view returns (address)",
  "function getResolver(string label) view returns (address)",
  "function getSubregistry(string label) view returns (address)",
]);
const resolverAbi = parseAbi([
  "function hasRootRoles(uint256 roleBitmap,address account) view returns (bool)",
  "function setText(bytes name,string key,string value)",
]);
const label = checkpoint.name.split(".")[0];
const [owner, resolver, subregistry, resolved, ownerCanWrite, payerCanWrite] = await Promise.all([
  client.readContract({ address: registry, abi: registryAbi, functionName: "findOwner", args: [label] }),
  client.readContract({ address: registry, abi: registryAbi, functionName: "getResolver", args: [label] }),
  client.readContract({ address: registry, abi: registryAbi, functionName: "getSubregistry", args: [label] }),
  client.getEnsAddress({ name: checkpoint.name }),
  client.readContract({ address: checkpoint.resolver, abi: resolverAbi, functionName: "hasRootRoles", args: [1n << 4n, checkpoint.owner] }),
  client.readContract({ address: checkpoint.resolver, abi: resolverAbi, functionName: "hasRootRoles", args: [1n << 4n, checkpoint.payer] }),
]);
if (owner.toLowerCase() !== checkpoint.owner.toLowerCase()) throw new Error(`Wrong ENS owner: ${owner}`);
if (resolver.toLowerCase() !== checkpoint.resolver.toLowerCase()) throw new Error(`Wrong ENS resolver: ${resolver}`);
if (subregistry.toLowerCase() !== checkpoint.subregistry.toLowerCase()) throw new Error(`Wrong ENS subregistry: ${subregistry}`);
if (resolved?.toLowerCase() !== checkpoint.owner.toLowerCase()) throw new Error(`Wrong ENS address record: ${resolved}`);
if (!ownerCanWrite || payerCanWrite) throw new Error("ENS resolver text roles are incorrect");
const args = [toHex(packetToBytes(normalize(checkpoint.name))), "com.collectorcredit.role", "borrower"] as const;
await client.simulateContract({ account: checkpoint.owner, address: checkpoint.resolver, abi: resolverAbi, functionName: "setText", args });
let denied = false;
try {
  await client.simulateContract({ account: checkpoint.payer, address: checkpoint.resolver, abi: resolverAbi, functionName: "setText", args });
} catch (error) {
  if (error instanceof BaseError && Boolean(error.walk((cause) => cause instanceof ContractFunctionRevertedError))) denied = true;
  else throw error;
}
if (!denied) throw new Error("Unauthorized text write unexpectedly succeeded");
console.log(`${checkpoint.name}: owner, resolver, subregistry, and address record verified.`);
console.log("Borrower text update simulation: allowed. Payer text update simulation: denied by ENSv2 EAC.");
