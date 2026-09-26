import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, decodeEventLog, http, isAddress, keccak256, parseAbiItem, toBytes, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { cards, valuationFixtures } from "../src/db/schema";
import { cardCertificationNumber, cardCustodyStatus } from "../src/lib/card-custody";
import { DEMO_CARDS } from "../src/lib/demo-cards";

process.loadEnvFile(".env.local");
const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const borrower = process.env.DEMO_BORROWER_ADDRESS;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env.local");
if (!borrower || !isAddress(borrower)) throw new Error("Set DEMO_BORROWER_ADDRESS to the demo wallet");
const demoBorrower: Address = borrower;
const deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as { chainId: number; contracts: { VaultedCardNFT?: Address }; blockNumbers: { VaultedCardNFT?: number } };
const deployedCardAddress = deployment.contracts.VaultedCardNFT;
if (deployment.chainId !== sepolia.id || !deployedCardAddress || !deployment.blockNumbers.VaultedCardNFT) throw new Error("Deploy the card contract on Sepolia first");
const cardAddress: Address = deployedCardAddress;
const cardAbi = (JSON.parse(await readFile("artifacts/contracts/VaultedCardNFT.sol/VaultedCardNFT.json", "utf8")) as { abi: Abi }).abi;
const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
const walletClient = createWalletClient({ account: privateKeyToAccount(key), chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
const client = createClient({ url: process.env.DATABASE_URL ?? "file:./data/collector-credit.db" });
const db = drizzle(client);
const checkpointPath = "deployments/demo-portfolio.json";
type MintRecord = { tokenId: string; txHash?: Hex };
type PortfolioCheckpoint = { card: Address; borrower: Address; cards: Record<string, MintRecord> };
let checkpoint: PortfolioCheckpoint;
try {
  checkpoint = JSON.parse(await readFile(checkpointPath, "utf8")) as PortfolioCheckpoint;
  if (checkpoint.card.toLowerCase() !== cardAddress.toLowerCase() || checkpoint.borrower.toLowerCase() !== demoBorrower.toLowerCase()) throw new Error("Portfolio checkpoint belongs to another deployment or wallet");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  checkpoint = { card: cardAddress, borrower: demoBorrower, cards: {} };
}

async function saveCheckpoint() {
  await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
}

async function existingMint(certificationNumber: string): Promise<MintRecord | null> {
  const certificationHash = keccak256(toBytes(certificationNumber));
  const used = await publicClient.readContract({ address: cardAddress, abi: cardAbi, functionName: "certificationUsed", args: [certificationHash] });
  if (used !== true) return null;
  const logs = await publicClient.getLogs({
    address: cardAddress,
    event: parseAbiItem("event CardVaulted(uint256 indexed tokenId, address indexed owner, bytes32 indexed certificationHash, bytes32 attestationHash)"),
    args: { certificationHash },
    fromBlock: BigInt(deployment.blockNumbers.VaultedCardNFT!),
  });
  const mint = logs.find((log) => log.args.owner?.toLowerCase() === demoBorrower.toLowerCase());
  if (!mint?.args.tokenId) throw new Error(`Certificate ${certificationNumber} was minted to another wallet`);
  return { tokenId: mint.args.tokenId.toString(), txHash: mint.transactionHash };
}

async function nextCertification(current: string) {
  const base = current.replace(/-R\d+$/, "");
  let round = Number(current.match(/-R(\d+)$/)?.[1] ?? 1) + 1;
  for (;;) {
    const candidate = `${base}-R${round}`;
    const used = await publicClient.readContract({ address: cardAddress, abi: cardAbi, functionName: "certificationUsed", args: [keccak256(toBytes(candidate))] });
    if (used === false) return candidate;
    round++;
  }
}

async function mintCard(record: typeof cards.$inferSelect, certificationNumber: string): Promise<MintRecord> {
  const attestation = keccak256(toBytes(`simulated-demo-custody:${certificationNumber}`));
  const evidence = DEMO_CARDS.find((card) => card.id === record.id);
  if (!evidence) throw new Error(`Missing artwork for ${record.id}`);
  const metadata = {
    name: `${record.year} ${record.name} · ${record.setName} · ${record.grader} ${record.grade}`,
    description: "Prawn Shop demo card. The custody receipt and valuation are simulated; no physical card is represented as held. Artwork illustrates the card printing only.",
    image: evidence.imageUrl,
    attributes: [
      { trait_type: "Printing", value: evidence.printing },
      { trait_type: "Grader", value: record.grader },
      { trait_type: "Grade", value: record.grade },
      { trait_type: "Certification", value: certificationNumber },
    ],
  };
  const metadataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;
  const txHash = await walletClient.writeContract({ address: cardAddress, abi: cardAbi, functionName: "mint", args: [demoBorrower, record.name, record.setName, record.year, record.grader, record.grade, certificationNumber, evidence.imageUrl, metadataUri, attestation] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error(`Mint failed: ${txHash}`);
  const mintEvent = receipt.logs.filter((log) => log.address.toLowerCase() === cardAddress.toLowerCase()).map((log) => {
    try { return decodeEventLog({ abi: cardAbi, data: log.data, topics: log.topics }); } catch { return null; }
  }).find((event) => event?.eventName === "CardVaulted");
  if (!mintEvent?.args || !("tokenId" in mintEvent.args)) throw new Error(`Mint succeeded but event is missing: ${txHash}`);
  return { tokenId: String(mintEvent.args.tokenId), txHash };
}

try {
  for (const fixture of DEMO_CARDS.filter((card) => card.id !== "demo-charizard-001")) {
    const [record] = await db.select().from(cards).where(eq(cards.id, fixture.id));
    if (!record) throw new Error(`Run pnpm db:seed before minting ${fixture.id}`);
    let mint = checkpoint.cards[fixture.id] ?? (record.tokenId ? { tokenId: record.tokenId } : null);
    let certificationNumber = record.certificationNumber;
    if (!mint) {
      mint = await existingMint(certificationNumber) ?? await mintCard(record, certificationNumber);
      checkpoint.cards[fixture.id] = mint;
      await saveCheckpoint();
    }
    let tokenId = BigInt(mint.tokenId);
    let details = await publicClient.readContract({ address: cardAddress, abi: cardAbi, functionName: "cardDetails", args: [tokenId] });
    let custodyStatus = cardCustodyStatus(details);
    if (custodyStatus === 4) {
      certificationNumber = await nextCertification(cardCertificationNumber(details) ?? certificationNumber);
      mint = await mintCard(record, certificationNumber);
      checkpoint.cards[fixture.id] = mint;
      await saveCheckpoint();
      tokenId = BigInt(mint.tokenId);
      details = await publicClient.readContract({ address: cardAddress, abi: cardAbi, functionName: "cardDetails", args: [tokenId] });
      custodyStatus = cardCustodyStatus(details);
    }
    const onchainCertification = cardCertificationNumber(details);
    if (!onchainCertification || custodyStatus === null) throw new Error(`Could not read custody for ${fixture.id}`);
    const owner = await publicClient.readContract({ address: cardAddress, abi: cardAbi, functionName: "ownerOf", args: [tokenId] });
    if (custodyStatus !== 2 && String(owner).toLowerCase() !== demoBorrower.toLowerCase()) throw new Error(`${fixture.id} is not owned by the demo wallet`);
    const status = custodyStatus === 1 ? "vaulted" : custodyStatus === 2 ? "pledged" : custodyStatus === 3 ? "released" : null;
    if (!status) throw new Error(`${fixture.id} has an unexpected custody status`);
    await db.update(cards).set({ tokenId: tokenId.toString(), tokenContract: cardAddress, certificationNumber: onchainCertification, custodyStatus: status }).where(eq(cards.id, fixture.id));
    await db.update(valuationFixtures).set({ updatedAt: new Date() }).where(eq(valuationFixtures.cardId, fixture.id));
    console.log(`${fixture.id}: card #${tokenId} · ${status} · ${mint.txHash ?? "previous mint"}`);
  }
} finally { await client.close(); }
