import "server-only";

import { randomBytes } from "node:crypto";
import { isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getDemoCard } from "@/lib/data";

const CHAIN_ID = 11155111;
const QUOTE_SECONDS = 10 * 60;
const MAX_VALUATION_AGE_MS = 24 * 60 * 60 * 1000;

export class ValuationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function issueSignedValuation(cardId: string) {
  const record = cardId === "demo-charizard-001" ? await getDemoCard() : null;
  if (!record || !record.valuation) throw new ValuationError(404, "Card or valuation fixture not found.");
  if (!record.card.tokenId || !record.card.tokenContract) throw new ValuationError(409, "The demo card must be minted on Sepolia before a signed valuation is available.");
  if (Date.now() - record.valuation.updatedAt.getTime() > MAX_VALUATION_AGE_MS) throw new ValuationError(410, "The comparable-sales fixture is stale. Update it before quoting.");

  const currency = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;
  const verifier = process.env.NEXT_PUBLIC_VALUATION_VERIFIER_ADDRESS;
  const key = process.env.APPRAISER_PRIVATE_KEY as Hex | undefined;
  if (!currency || !isAddress(currency) || !verifier || !isAddress(verifier) || !key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new ValuationError(503, "Sepolia contract addresses or the appraiser signer are not configured.");
  }
  if (!isAddress(record.card.tokenContract)) throw new ValuationError(503, "The card contract address is invalid.");

  const now = Math.floor(Date.now() / 1000);
  const valuation = {
    cardContract: record.card.tokenContract as Address,
    tokenId: BigInt(record.card.tokenId),
    value: BigInt(record.valuation.appraisedMicroUsdc),
    currency: currency as Address,
    issuedAt: BigInt(now),
    expiresAt: BigInt(now + QUOTE_SECONDS),
    nonce: `0x${randomBytes(32).toString("hex")}` as Hex,
  };
  const signature = await privateKeyToAccount(key).signTypedData({
    domain: { name: "Collector Credit Valuation", version: "1", chainId: CHAIN_ID, verifyingContract: verifier as Address },
    primaryType: "Valuation",
    types: {
      Valuation: [
        { name: "cardContract", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "value", type: "uint256" },
        { name: "currency", type: "address" },
        { name: "issuedAt", type: "uint64" },
        { name: "expiresAt", type: "uint64" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    message: valuation,
  });

  return {
    chainId: CHAIN_ID,
    valuation: {
      ...valuation,
      tokenId: valuation.tokenId.toString(),
      value: valuation.value.toString(),
      issuedAt: valuation.issuedAt.toString(),
      expiresAt: valuation.expiresAt.toString(),
    },
    signature,
    evidence: {
      lastSaleMicroUsdc: record.valuation.lastSaleMicroUsdc,
      median30dMicroUsdc: record.valuation.median30dMicroUsdc,
      confidence: record.valuation.confidence,
      fixtureUpdatedAt: record.valuation.updatedAt.toISOString(),
      source: "demo comparable-sales fixture",
    },
  };
}
