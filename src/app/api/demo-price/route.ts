import { NextResponse } from "next/server";
import { getDemoCard } from "@/lib/data";
import { createDemoPrice } from "@/lib/demo-price";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cardId = new URL(request.url).searchParams.get("cardId");
  if (cardId !== "demo-charizard-001") return NextResponse.json({ error: "Select the available demo card." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    const record = await getDemoCard();
    if (!record?.valuation) return NextResponse.json({ error: "The demo appraisal is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(createDemoPrice(cardId, record.valuation.appraisedMicroUsdc, record.valuation.updatedAt), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load the demo assumption." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
