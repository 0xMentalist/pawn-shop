import { NextResponse } from "next/server";
import { fetchRealyseMarketSignal } from "@/lib/realyse";

export const runtime = "nodejs";

export async function GET() {
  try {
    const signal = await fetchRealyseMarketSignal();
    if (!signal) return NextResponse.json({ error: "No verified matching Realyse market record is available." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(signal, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Realyse market data is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
