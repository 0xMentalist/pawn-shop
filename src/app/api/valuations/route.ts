import { NextResponse } from "next/server";
import { issueSignedValuation, ValuationError } from "@/lib/valuation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a JSON body with cardId." }, { status: 400 }); }
  const cardId = typeof body === "object" && body !== null && "cardId" in body ? (body as { cardId: unknown }).cardId : null;
  if (typeof cardId !== "string" || !cardId) return NextResponse.json({ error: "cardId is required." }, { status: 400 });
  try {
    const result = await issueSignedValuation(cardId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ValuationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: "Could not issue a valuation. Try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
