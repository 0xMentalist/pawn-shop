/** A Realyse-shaped demo response backed by the project's stated price assumption. */
export type DemoPrice = {
  cardId: "demo-charizard-001";
  assumedValueMicroUsdc: number;
  assumptionRecordedAt: string;
  fetchedAt: string;
  freshForSignedQuote: boolean;
  source: "mock-realyse";
  basis: "fixed demo assumption";
};

const MAX_ASSUMPTION_AGE_MS = 24 * 60 * 60 * 1000;

export function createDemoPrice(cardId: string, assumedValueMicroUsdc: number, recordedAt: Date, now = new Date()): DemoPrice {
  if (cardId !== "demo-charizard-001" || !Number.isSafeInteger(assumedValueMicroUsdc) || assumedValueMicroUsdc <= 0 || !Number.isFinite(recordedAt.getTime())) {
    throw new Error("Demo price is unavailable for this asset.");
  }
  return {
    cardId,
    assumedValueMicroUsdc,
    assumptionRecordedAt: recordedAt.toISOString(),
    fetchedAt: now.toISOString(),
    freshForSignedQuote: now.getTime() >= recordedAt.getTime() && now.getTime() - recordedAt.getTime() <= MAX_ASSUMPTION_AGE_MS,
    source: "mock-realyse",
    basis: "fixed demo assumption",
  };
}
