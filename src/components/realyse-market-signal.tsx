"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { RealyseMarketSignal } from "@/lib/realyse";

const REFRESH_MS = 5 * 60 * 1000;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

export function RealyseMarketSignal() {
  const [signal, setSignal] = useState<RealyseMarketSignal | null>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/market-signal", { cache: "no-store" });
      if (!response.ok) throw new Error("Market data unavailable");
      setSignal(await response.json() as RealyseMarketSignal);
    } catch {
      setSignal(null);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (!signal) return null;
  return <div className="border-t border-border pt-4 text-sm">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium">Recent market reference</p><p className="font-semibold tabular-nums">{money.format(signal.priceUsd)}</p></div>
    <p className="mt-1 text-xs text-muted-foreground">Realyse · {date.format(new Date(signal.asOf))} · {signal.sampleCount} reported {signal.sampleCount === 1 ? "sale" : "sales"}. This reference does not set your loan amount.</p>
    <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4">View source<ExternalLink className="size-3.5" aria-hidden="true" /></a>
  </div>;
}
