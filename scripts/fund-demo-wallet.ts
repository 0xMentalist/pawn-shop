import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { createPublicClient, createWalletClient, decodeEventLog, formatEther, http, isAddress, keccak256, parseAbiItem, parseEther, toBytes, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { cards } from "../src/db/schema";
import { DEMO_CARDS } from "../src/lib/demo-cards";

process.loadEnvFile(".env.local");
const recipient = process.argv[2];
const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!recipient || !isAddress(recipient)) throw new Error("Usage: node --import tsx scripts/fund-demo-wallet.ts <Sepolia wallet address>");
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("DEPLOYER_PRIVATE_KEY is required");

const deployment = JSON.parse(await readFile("deployments/sepolia.json", "utf8")) as { chainId: number; contracts: { VaultedCardNFT: Address }; blockNumbers: { VaultedCardNFT: number } };
if (deployment.chainId !== sepolia.id) throw new Error("Expected a Sepolia deployment");
const cardAddress = deployment.contracts.VaultedCardNFT;
const abi = (JSON.parse(await readFile("artifacts/contracts/VaultedCardNFT.sol/VaultedCardNFT.json", "utf8")) as { abi: Abi }).abi;
const account = privateKeyToAccount(key);
const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
const chain = createPublicClient({ chain: sepolia, transport: http(rpc) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpc) });
const client = createClient({ url: process.env.DATABASE_URL ?? "file:./data/collector-credit.db" });
const db = drizzle(client);
const testCards = DEMO_CARDS.filter((card) => card.id === "demo-pikachu-007" || card.id === "demo-venusaur-008");
const ethToSend = parseEther("0.01");

async function confirm(hash: Hex) {
  const receipt = await chain.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Sepolia transaction failed: ${hash}`);
  return receipt;
}

try {
  const custodianRole = await chain.readContract({ address: cardAddress, abi, functionName: "CUSTODIAN_ROLE" }) as Hex;
  const canMint = await chain.readContract({ address: cardAddress, abi, functionName: "hasRole", args: [custodianRole, account.address] });
  if (!canMint) throw new Error("Configured signer is not the demo card custodian");

  for (const fixture of testCards) {
    const [record] = await db.select().from(cards).where(eq(cards.id, fixture.id));
    if (!record) throw new Error(`Run pnpm db:seed before funding: ${fixture.id}`);
    const certHash = keccak256(toBytes(fixture.certificationNumber));
    const used = await chain.readContract({ address: cardAddress, abi, functionName: "certificationUsed", args: [certHash] });
    let tokenId: bigint;
    let txHash: Hex | undefined;
    if (used) {
      const logs = await chain.getLogs({
        address: cardAddress,
        event: parseAbiItem("event CardVaulted(uint256 indexed tokenId, address indexed owner, bytes32 indexed certificationHash, bytes32 attestationHash)"),
        args: { certificationHash: certHash },
        fromBlock: BigInt(deployment.blockNumbers.VaultedCardNFT),
      });
      const minted = logs.find((log) => log.args.owner?.toLowerCase() === recipient.toLowerCase());
      if (!minted?.args.tokenId) throw new Error(`${fixture.certificationNumber} belongs to another wallet`);
      tokenId = minted.args.tokenId;
      txHash = minted.transactionHash;
    } else {
      const metadata = {
        name: `${fixture.year} ${fixture.name} · ${fixture.setName} · ${fixture.grader} ${fixture.grade}`,
        description: "Pawn Shop demo card. Custody and valuation are simulated; this NFT does not represent a physically held card.",
        image: fixture.imageUrl,
        attributes: [
          { trait_type: "Printing", value: fixture.printing },
          { trait_type: "Grader", value: fixture.grader },
          { trait_type: "Grade", value: fixture.grade },
          { trait_type: "Demo certificate", value: fixture.certificationNumber },
        ],
      };
      const metadataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;
      const attestation = keccak256(toBytes(`simulated-demo-custody:${fixture.certificationNumber}`));
      txHash = await wallet.writeContract({ address: cardAddress, abi, functionName: "mint", args: [recipient, fixture.name, fixture.setName, fixture.year, fixture.grader, fixture.grade, fixture.certificationNumber, fixture.imageUrl, metadataUri, attestation] });
      const receipt = await confirm(txHash);
      const event = receipt.logs.filter((log) => log.address.toLowerCase() === cardAddress.toLowerCase()).map((log) => {
        try { return decodeEventLog({ abi, data: log.data, topics: log.topics }); } catch { return null; }
      }).find((item) => item?.eventName === "CardVaulted");
      if (!event?.args || !("tokenId" in event.args)) throw new Error(`Minted ${fixture.id} but could not read its token ID: ${txHash}`);
      tokenId = BigInt(String(event.args.tokenId));
    }
    const owner = await chain.readContract({ address: cardAddress, abi, functionName: "ownerOf", args: [tokenId] }) as Address;
    if (owner.toLowerCase() !== recipient.toLowerCase()) throw new Error(`Card #${tokenId} is no longer in the requested wallet`);
    await db.update(cards).set({ tokenId: tokenId.toString(), tokenContract: cardAddress, custodyStatus: "vaulted" }).where(eq(cards.id, fixture.id));
    console.log(`${fixture.name} #${tokenId}: ${txHash}`);
  }

  const blastoiseId = 4n;
  const blastoiseOwner = await chain.readContract({ address: cardAddress, abi, functionName: "ownerOf", args: [blastoiseId] }) as Address;
  if (blastoiseOwner.toLowerCase() === account.address.toLowerCase()) {
    const details = await chain.readContract({ address: cardAddress, abi, functionName: "cardDetails", args: [blastoiseId] }) as { custodyStatus: number };
    if (Number(details.custodyStatus) !== 3) throw new Error("Blastoise is not released for transfer");
    const hash = await wallet.writeContract({ address: cardAddress, abi, functionName: "safeTransferFrom", args: [account.address, recipient, blastoiseId] });
    await confirm(hash);
    console.log(`Blastoise #4: ${hash}`);
  } else if (blastoiseOwner.toLowerCase() !== recipient.toLowerCase()) {
    throw new Error("Blastoise #4 is no longer controlled by the deployer");
  }

  const recipientBalance = await chain.getBalance({ address: recipient });
  if (recipientBalance < ethToSend) {
    const deployerBalance = await chain.getBalance({ address: account.address });
    if (deployerBalance < ethToSend + parseEther("0.01")) throw new Error("Insufficient deployer ETH to fund wallet and preserve a gas reserve");
    const hash = await wallet.sendTransaction({ to: recipient, value: ethToSend - recipientBalance });
    await confirm(hash);
    console.log(`Sepolia ETH: ${formatEther(ethToSend - recipientBalance)} · ${hash}`);
  }
  console.log(`Recipient balance: ${formatEther(await chain.getBalance({ address: recipient }))} Sepolia ETH`);
  console.log(`Recipient demo NFTs: ${await chain.readContract({ address: cardAddress, abi, functionName: "balanceOf", args: [recipient] })}`);
} finally {
  await client.close();
}
