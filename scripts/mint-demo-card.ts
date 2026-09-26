import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, decodeEventLog, http, isAddress, keccak256, toBytes, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { cards, valuationFixtures } from "../src/db/schema";

process.loadEnvFile(".env.local");
const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const borrower = process.env.DEMO_BORROWER_ADDRESS;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env.local");
if (!borrower || !isAddress(borrower)) throw new Error("Set DEMO_BORROWER_ADDRESS to the card owner's Sepolia wallet");
const deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as { chainId: number; contracts: { VaultedCardNFT?: Address } };
const cardAddress = deployment.contracts.VaultedCardNFT;
if (deployment.chainId !== sepolia.id || !cardAddress) throw new Error("Deploy the card contract on Sepolia first");
const compiled = JSON.parse(await readFile("artifacts/contracts/VaultedCardNFT.sol/VaultedCardNFT.json", "utf8")) as { abi: Abi };
const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
const walletClient = createWalletClient({ account: privateKeyToAccount(key), chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
const client = createClient({ url: process.env.DATABASE_URL ?? "file:./data/collector-credit.db" });
const db = drizzle(client);
const [record] = await db.select().from(cards).where(eq(cards.id, "demo-charizard-001"));
if (!record) throw new Error("Run pnpm db:migrate and pnpm db:seed first");

try {
  let tokenId: bigint;
  const checkpointPath = "deployments/demo-card.json";
  try {
    const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8")) as { card: Address; tokenId: string; borrower: Address; txHash: Hex };
    if (checkpoint.card.toLowerCase() !== cardAddress.toLowerCase() || checkpoint.borrower.toLowerCase() !== borrower.toLowerCase()) throw new Error("Demo card checkpoint belongs to a different card contract or borrower");
    tokenId = BigInt(checkpoint.tokenId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const attestation = keccak256(toBytes(`simulated-demo-custody:${record.certificationNumber}`));
    const metadata = {
      name: `${record.year} ${record.name} · ${record.setName} · ${record.grader} ${record.grade}`,
      description: "Collector Credit demonstration card. Custody receipt is simulated; no physical card is represented as held.",
      attributes: [
        { trait_type: "Grader", value: record.grader },
        { trait_type: "Grade", value: record.grade },
        { trait_type: "Certification", value: record.certificationNumber },
      ],
    };
    const metadataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;
    const txHash = await walletClient.writeContract({
      address: cardAddress,
      abi: compiled.abi,
      functionName: "mint",
      args: [borrower, record.name, record.setName, record.year, record.grader, record.grade, record.certificationNumber, "", metadataUri, attestation],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") throw new Error(`Mint failed: ${txHash}`);
    const mintEvent = receipt.logs.filter((log) => log.address.toLowerCase() === cardAddress.toLowerCase()).map((log) => {
      try { return decodeEventLog({ abi: compiled.abi, data: log.data, topics: log.topics }); } catch { return null; }
    }).find((event) => event?.eventName === "CardVaulted");
    if (!mintEvent || !mintEvent.args || !("tokenId" in mintEvent.args)) throw new Error(`Mint succeeded but CardVaulted event is missing: ${txHash}`);
    tokenId = mintEvent.args.tokenId as bigint;
    await writeFile(checkpointPath, `${JSON.stringify({ card: cardAddress, tokenId: tokenId.toString(), borrower, txHash }, null, 2)}\n`);
    console.log(`Minted card token #${tokenId} to ${borrower}: ${txHash}`);
  }
  const owner = await publicClient.readContract({ address: cardAddress, abi: compiled.abi, functionName: "ownerOf", args: [tokenId] });
  if (String(owner).toLowerCase() !== borrower.toLowerCase()) throw new Error("Onchain owner does not match DEMO_BORROWER_ADDRESS");
  await db.update(cards).set({ tokenId: tokenId.toString(), tokenContract: cardAddress, custodyStatus: "vaulted" }).where(eq(cards.id, record.id));
  await db.update(valuationFixtures).set({ updatedAt: new Date() }).where(eq(valuationFixtures.cardId, record.id));
  console.log(`Demo fixture linked to token #${tokenId}.`);
} finally { await client.close(); }
