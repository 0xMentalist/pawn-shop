import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, decodeEventLog, http, isAddress, keccak256, toBytes, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { cards, valuationFixtures } from "../src/db/schema";
import { cardCertificationNumber, cardCustodyStatus } from "../src/lib/card-custody";
import { getDemoCardEvidence } from "../src/lib/demo-cards";

process.loadEnvFile(".env.local");
const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const borrower = process.env.DEMO_BORROWER_ADDRESS;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env.local");
if (!borrower || !isAddress(borrower)) throw new Error("Set DEMO_BORROWER_ADDRESS to the card owner's Sepolia wallet");
const deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as { chainId: number; contracts: { VaultedCardNFT?: Address } };
const deployedCardAddress = deployment.contracts.VaultedCardNFT;
if (deployment.chainId !== sepolia.id || !deployedCardAddress) throw new Error("Deploy the card contract on Sepolia first");
const cardAddress: Address = deployedCardAddress;
const compiled = JSON.parse(await readFile("artifacts/contracts/VaultedCardNFT.sol/VaultedCardNFT.json", "utf8")) as { abi: Abi };
const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
const walletClient = createWalletClient({ account: privateKeyToAccount(key), chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
const client = createClient({ url: process.env.DATABASE_URL ?? "file:./data/collector-credit.db" });
const db = drizzle(client);
const [record] = await db.select().from(cards).where(eq(cards.id, "demo-charizard-001"));
if (!record) throw new Error("Run pnpm db:migrate and pnpm db:seed first");

type DemoCheckpoint = { card: Address; tokenId: string; borrower: Address; txHash: Hex };

async function nextDemoCertification(current: string) {
  const match = current.match(/^(.*?)(\d+)$/);
  const prefix = match?.[1] ?? `${current}-`;
  let serial = match ? Number(match[2]) + 1 : 2;
  for (;;) {
    const candidate = `${prefix}${String(serial).padStart(match?.[2].length ?? 1, "0")}`;
    const used = await publicClient.readContract({ address: cardAddress, abi: compiled.abi, functionName: "certificationUsed", args: [keccak256(toBytes(candidate))] });
    if (used === false) return candidate;
    serial++;
  }
}

async function mintCard(certificationNumber: string): Promise<DemoCheckpoint> {
  const attestation = keccak256(toBytes(`simulated-demo-custody:${certificationNumber}`));
  const evidence = getDemoCardEvidence(record.id);
  if (!evidence) throw new Error(`Missing artwork for ${record.id}`);
  const metadata = {
    name: `${record.year} ${record.name} · ${record.setName} · ${record.grader} ${record.grade}`,
    description: "Prawn Shop demonstration card. Custody receipt is simulated; no physical card is represented as held. Artwork illustrates the card printing only.",
    image: evidence.imageUrl,
    attributes: [
      { trait_type: "Printing", value: evidence.printing },
      { trait_type: "Grader", value: record.grader },
      { trait_type: "Grade", value: record.grade },
      { trait_type: "Certification", value: certificationNumber },
    ],
  };
  const metadataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;
  const txHash = await walletClient.writeContract({
    address: cardAddress,
    abi: compiled.abi,
    functionName: "mint",
    args: [borrower, record.name, record.setName, record.year, record.grader, record.grade, certificationNumber, evidence.imageUrl, metadataUri, attestation],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error(`Mint failed: ${txHash}`);
  const mintEvent = receipt.logs.filter((log) => log.address.toLowerCase() === cardAddress.toLowerCase()).map((log) => {
    try { return decodeEventLog({ abi: compiled.abi, data: log.data, topics: log.topics }); } catch { return null; }
  }).find((event) => event?.eventName === "CardVaulted");
  if (!mintEvent || !mintEvent.args || !("tokenId" in mintEvent.args)) throw new Error(`Mint succeeded but CardVaulted event is missing: ${txHash}`);
  const tokenId = mintEvent.args.tokenId as bigint;
  console.log(`Minted demo card #${tokenId} to ${borrower}: ${txHash}`);
  return { card: cardAddress, tokenId: tokenId.toString(), borrower: borrower as Address, txHash };
}

try {
  const checkpointPath = "deployments/demo-card.json";
  let checkpoint: DemoCheckpoint;
  try {
    checkpoint = JSON.parse(await readFile(checkpointPath, "utf8")) as DemoCheckpoint;
    if (checkpoint.card.toLowerCase() !== cardAddress.toLowerCase() || checkpoint.borrower.toLowerCase() !== borrower.toLowerCase()) throw new Error("Demo card checkpoint belongs to a different card contract or borrower");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    checkpoint = await mintCard(record.certificationNumber);
    await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
  }
  let tokenId = BigInt(checkpoint.tokenId);
  const owner = await publicClient.readContract({ address: cardAddress, abi: compiled.abi, functionName: "ownerOf", args: [tokenId] });
  const details = await publicClient.readContract({ address: cardAddress, abi: compiled.abi, functionName: "cardDetails", args: [tokenId] });
  let certificationNumber = cardCertificationNumber(details);
  let custodyStatus = cardCustodyStatus(details);
  if (!certificationNumber || custodyStatus === null) throw new Error("Could not read demo card custody details");
  if (custodyStatus === 4) {
    certificationNumber = await nextDemoCertification(certificationNumber);
    checkpoint = await mintCard(certificationNumber);
    tokenId = BigInt(checkpoint.tokenId);
    custodyStatus = 1;
    await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
  } else if (String(owner).toLowerCase() !== borrower.toLowerCase() && custodyStatus !== 2) {
    throw new Error("Onchain owner does not match DEMO_BORROWER_ADDRESS");
  }
  const status = custodyStatus === 1 ? "vaulted" : custodyStatus === 2 ? "pledged" : custodyStatus === 3 ? "released" : null;
  if (!status) throw new Error(`Unexpected card custody status: ${custodyStatus}`);
  await db.update(cards).set({ tokenId: tokenId.toString(), tokenContract: cardAddress, certificationNumber, custodyStatus: status }).where(eq(cards.id, record.id));
  await db.update(valuationFixtures).set({ updatedAt: new Date() }).where(eq(valuationFixtures.cardId, record.id));
  console.log(`Demo fixture linked to token #${tokenId}.`);
} finally { await client.close(); }
