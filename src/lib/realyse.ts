/** Public Realyse market context for the simulated 1999 Base Set Charizard PSA 9. */
export const REALYSE_CARD_ID = "psa9_base_set_charizard_holo_1999_4";
export const REALYSE_API_URL = `https://pokemon-backend-production-fdfa.up.railway.app/api/collections/${REALYSE_CARD_ID}`;

export type RealyseMarketSignal = {
  priceUsd: number;
  status: string;
  sampleCount: number;
  sourceCount: number;
  asOf: string;
  saleObservedAt: string | null;
  sourceUrl: string;
};

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

/** Reject wrong grades/printings and unsupported data rather than displaying them as comparable sales. */
export function parseRealyseMarketSignal(raw: unknown): RealyseMarketSignal | null {
  const data = object(raw);
  if (!data || data.card_id !== REALYSE_CARD_ID || data.category !== "graded" || data.grader !== "PSA" || String(data.grade) !== "9") return null;
  if (typeof data.display_name !== "string" || !/base set/i.test(data.display_name) || !/charizard/i.test(data.display_name) || !/1999/.test(data.display_name) || !/#4\b/.test(data.display_name) || /1st edition|first edition|shadowless|celebrations|base set 2|base 2|metal/i.test(data.display_name)) return null;
  const price = data.price_usd;
  const samples = data.sample_count;
  const sources = data.source_count;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || typeof samples !== "number" || !Number.isInteger(samples) || samples < 1 || typeof sources !== "number" || !Number.isInteger(sources) || sources < 1 || !validDate(data.as_of) || typeof data.price_status !== "string") return null;
  const observations = Array.isArray(data.recent_observations) ? data.recent_observations : [];
  // The current record has one sale. If its feed grows, require the complete sampled
  // tape to match before showing an aggregate; never accept a mixed printing.
  if (observations.length !== samples) return null;
  const sales = observations.map(object);
  if (sales.some((sale) => !sale || typeof sale.title !== "string" || !/base set/i.test(sale.title) || !/charizard/i.test(sale.title) || !/1999/.test(sale.title) || !/PSA\s*9/i.test(sale.title) || !/#4\b/.test(sale.title) || /1st edition|first edition|shadowless|celebrations|base set 2|base 2|metal/i.test(sale.title) || !validDate(sale.observed_at))) return null;
  const matchingSale = sales[0];
  if (!matchingSale) return null;
  return {
    priceUsd: price,
    status: data.price_status,
    sampleCount: samples,
    sourceCount: sources,
    asOf: data.as_of,
    saleObservedAt: matchingSale.observed_at as string,
    sourceUrl: REALYSE_API_URL,
  };
}

export async function fetchRealyseMarketSignal(): Promise<RealyseMarketSignal | null> {
  const response = await fetch(`${REALYSE_API_URL}?recent_limit=20`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`Realyse returned ${response.status}`);
  return parseRealyseMarketSignal(await response.json());
}
