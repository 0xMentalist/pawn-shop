import { getDemoCardEvidence } from "./demo-cards";

export type DemoPrice = {
  cardId: string;
  lastSaleMicroUsdc: number;
  saleObservedAt: string;
  saleSourceUrl: string;
  fetchedAt: string;
  freshForSignedQuote: boolean;
  source: "psa-auction-comparable" | "psa-price-guide";
};

export const MAX_SALE_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function createDemoPrice(cardId: string, storedValueMicroUsdc: number, now = new Date()): DemoPrice {
  const evidence = getDemoCardEvidence(cardId);
  if (!evidence || storedValueMicroUsdc !== evidence.valueMicroUsdc || !Number.isFinite(now.getTime())) {
    throw new Error("A matched PSA estimate is unavailable for this card.");
  }
  const saleAge = now.getTime() - Date.parse(evidence.saleObservedAt);
  return {
    cardId,
    lastSaleMicroUsdc: evidence.valueMicroUsdc,
    saleObservedAt: evidence.saleObservedAt,
    saleSourceUrl: evidence.saleSourceUrl,
    fetchedAt: now.toISOString(),
    freshForSignedQuote: saleAge >= 0 && saleAge <= MAX_SALE_AGE_MS,
    source: "sourceType" in evidence ? evidence.sourceType : "psa-auction-comparable",
  };
}
