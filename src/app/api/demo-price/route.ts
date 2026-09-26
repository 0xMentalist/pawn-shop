import { NextResponse } from "next/server";
import { getDemoCard } from "@/lib/data";
import { createDemoPrice } from "@/lib/demo-price";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cardId = new URL(request.url).searchParams.get("cardId");
  if (!cardId) return NextResponse.json({ error: "Select a card." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const record = await getDemoCard(cardId);
    if (!record) return NextResponse.json({ error: "Card not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    if (!record?.valuation) return NextResponse.json({ error: "The last-sale estimate is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(createDemoPrice(cardId, record.valuation.appraisedMicroUsdc), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load the last-sale estimate." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
