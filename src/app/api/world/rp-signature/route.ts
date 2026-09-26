import { NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit-core/signing";
import { WORLD_BORROWER_ACTION } from "@/lib/world";

export const runtime = "nodejs";

export async function POST() {
  const key = process.env.WORLD_RP_SIGNING_KEY;
  if (!key || !process.env.WORLD_APP_ID || !process.env.WORLD_RP_ID) return NextResponse.json({ error: "World ID portal app is not configured yet." }, { status: 503 });
  try {
    const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex: key, action: WORLD_BORROWER_ACTION, ttl: 5 * 60 });
    return NextResponse.json({ sig, nonce, created_at: createdAt, expires_at: expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not sign the World ID request." }, { status: 500 });
  }
}
