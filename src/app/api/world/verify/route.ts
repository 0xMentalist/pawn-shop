import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createPublicClient, createWalletClient, http, isAddress, toHex, verifyMessage, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import type { IDKitResult } from "@worldcoin/idkit";
import { db } from "@/db";
import { identityAuthorizations } from "@/db/schema";
import { abis } from "@/lib/contracts";
import { WORLD_BORROWER_ACTION, hasVerifiedWorldCredential, requestedWorldCredential, worldAuthorizationMessage } from "@/lib/world";

export const runtime = "nodejs";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const rpId = process.env.WORLD_RP_ID;
  const environment = process.env.WORLD_ENVIRONMENT;
  const registry = process.env.NEXT_PUBLIC_HUMAN_REGISTRY_ADDRESS;
  const key = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
  if (!rpId || !process.env.WORLD_APP_ID || !["production", "staging"].includes(environment ?? "") || !registry || !isAddress(registry) || !key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    return error("World ID and Sepolia registration are not configured yet.", 503);
  }
  let body: { wallet?: string; walletSignature?: Hex; idkitResponse?: IDKitResult };
  try { body = await request.json(); } catch { return error("Invalid JSON body.", 400); }
  const wallet = body.wallet;
  const proof = body.idkitResponse;
  if (!wallet || !isAddress(wallet) || !body.walletSignature || !/^0x[0-9a-fA-F]+$/.test(body.walletSignature) || !proof || proof.protocol_version !== "4.0" || !("action" in proof) || proof.action !== WORLD_BORROWER_ACTION || proof.environment !== environment || !Array.isArray(proof.responses)) {
    return error("Invalid World ID authorization request.", 400);
  }
  const credentialProofs = proof.responses.filter((item) => "nullifier" in item && requestedWorldCredential(item));
  if (credentialProofs.length !== 1) return error("Select one supported World ID credential.", 400);
  const credentialProof = credentialProofs[0];
  const credential = requestedWorldCredential(credentialProof);
  if (!credential || !("nullifier" in credentialProof) || !/^0x[0-9a-fA-F]{1,64}$/.test(credentialProof.nullifier) || !credentialProof.signal_hash) return error("World ID credential or wallet signal is missing.", 400);
  if (credentialProof.signal_hash.toLowerCase() !== hashSignal(wallet).toLowerCase()) return error("Proof does not belong to this wallet.", 400);
  const signatureValid = await verifyMessage({ address: wallet, message: worldAuthorizationMessage(wallet, proof.nonce), signature: body.walletSignature }).catch(() => false);
  if (!signatureValid) return error("Wallet signature is invalid.", 401);
  const nullifier = toHex(BigInt(credentialProof.nullifier), { size: 32 });

  let verification: { success?: boolean; action?: string; environment?: string; nullifier?: string; results?: Array<{ identifier?: string; success?: boolean; nullifier?: string }> };
  try {
    const response = await fetch(`https://developer.world.org/api/v4/verify/${encodeURIComponent(rpId)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...proof, min_protocol_version: "4.0" }), signal: AbortSignal.timeout(12_000), cache: "no-store",
    });
    if (!response.ok) return error("World ID rejected the proof. Please retry verification.", 400);
    verification = await response.json();
  } catch { return error("World ID verification is temporarily unavailable.", 502); }
  const matching = hasVerifiedWorldCredential(verification.results, credential, nullifier);
  if (!verification.success || verification.action !== WORLD_BORROWER_ACTION || verification.environment !== environment || !matching) return error("World ID verification result did not match the request.", 400);

  const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
  const address = wallet as Address;
  const registryAddress = registry as Address;
  try {
    const alreadyVerified = await publicClient.readContract({ address: registryAddress, abi: abis.registry, functionName: "isVerifiedBorrower", args: [address] });
    if (alreadyVerified === true) return NextResponse.json({ verified: true, alreadyRegistered: true }, { headers: { "Cache-Control": "no-store" } });
    const walletClient = createWalletClient({ account: privateKeyToAccount(key), chain: sepolia, transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) });
    const txHash = await walletClient.writeContract({ address: registryAddress, abi: abis.registry, functionName: "registerBorrower", args: [address, nullifier] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") return error("Onchain borrower registration failed.", 502);
    await db.insert(identityAuthorizations).values({
      id: crypto.randomUUID(), walletAddress: wallet.toLowerCase(), action: WORLD_BORROWER_ACTION,
      nullifierHash: nullifier, credentialType: credential, authorizedAt: new Date(), registrationTxHash: txHash,
    }).onConflictDoNothing();
    return NextResponse.json({ verified: true, txHash }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    const [existing] = await db.select().from(identityAuthorizations).where(eq(identityAuthorizations.nullifierHash, nullifier)).limit(1);
    if (existing && existing.walletAddress !== wallet.toLowerCase()) return error("This World ID action is already linked to another wallet.", 409);
    return error("Could not register borrower on Sepolia. Please retry.", 502);
  }
}
