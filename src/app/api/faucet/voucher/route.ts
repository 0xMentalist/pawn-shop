import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress, keccak256, toBytes, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import faucetAbi from "@/lib/abi/DemoCardFaucet.json";
import cardAbi from "@/lib/abi/VaultedCardNFT.json";
import { createFaucetCardInput, getFaucetCard } from "@/lib/faucet-claim";
import { createDemoPrice } from "@/lib/demo-price";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { cardId?: unknown; address?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Choose a card and connect a wallet." }, { status: 400 }); }
  const card = typeof body.cardId === "string" ? getFaucetCard(body.cardId) : null;
  if (!card || typeof body.address !== "string" || !isAddress(body.address)) return NextResponse.json({ error: "Choose an available card and connect a wallet." }, { status: 400 });
  const faucetAddress = process.env.NEXT_PUBLIC_CARD_FAUCET_ADDRESS;
  const cardAddress = process.env.NEXT_PUBLIC_CARD_ADDRESS;
  const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
  if (!faucetAddress || !isAddress(faucetAddress) || !cardAddress || !isAddress(cardAddress) || !key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return NextResponse.json({ error: "Card claims are temporarily unavailable." }, { status: 503 });

  try {
    const price = createDemoPrice(card.id, card.valueMicroUsdc);
    if (!price.freshForSignedQuote) return NextResponse.json({ error: "This card's PSA guide estimate needs refreshing." }, { status: 409 });
    const account = privateKeyToAccount(key);
    const chain = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
    const [curator, linkedCard, claimed, claimCount, used, block] = await Promise.all([
      chain.readContract({ address: faucetAddress, abi: faucetAbi, functionName: "curator" }),
      chain.readContract({ address: faucetAddress, abi: faucetAbi, functionName: "card" }),
      chain.readContract({ address: faucetAddress, abi: faucetAbi, functionName: "claimedTemplate", args: [Number(card.id.slice(-3))] }),
      chain.readContract({ address: faucetAddress, abi: faucetAbi, functionName: "claimedCount", args: [body.address] }),
      chain.readContract({ address: cardAddress, abi: cardAbi, functionName: "certificationUsed", args: [keccak256(toBytes(card.certificationNumber))] }),
      chain.getBlock(),
    ]);
    if (String(curator).toLowerCase() !== account.address.toLowerCase() || String(linkedCard).toLowerCase() !== cardAddress.toLowerCase()) throw new Error("Faucet configuration mismatch");
    if (claimed || used) return NextResponse.json({ error: "That card has already been claimed. Choose another." }, { status: 409 });
    if (Number(claimCount) >= 3) return NextResponse.json({ error: "This wallet has claimed its three demo cards." }, { status: 429 });
    const item = createFaucetCardInput(card, block.timestamp + 600n);
    const digest = await chain.readContract({ address: faucetAddress, abi: faucetAbi, functionName: "hashClaim", args: [body.address as Address, item] }) as Hex;
    const signature = await account.signMessage({ message: { raw: digest } });
    return NextResponse.json({ item: { ...item, expiresAt: item.expiresAt.toString() }, signature }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Card faucet voucher failed", error);
    return NextResponse.json({ error: "Could not prepare the card claim. Try again." }, { status: 503 });
  }
}
