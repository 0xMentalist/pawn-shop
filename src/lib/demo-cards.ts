/** Simulated Sepolia NFTs with curated, grade-matched auction comparables. */
export const DEMO_CARDS = [
  { id: "demo-pikachu-010", name: "Pikachu", setName: "Scarlet & Violet", printing: "Black Star Promo #027 · Paldea Evolved ETB", year: 2023, grader: "PSA", grade: "8", certificationNumber: "DEMO-CC-003", imageUrl: "https://images.pokemontcg.io/svp/27.png", valueMicroUsdc: 31_000_000, saleObservedAt: "2026-08-02T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/115823683/psa" },
  { id: "demo-blastoise-1000", name: "Blastoise", setName: "Base Set", printing: "Unlimited holo #2", year: 1999, grader: "PSA", grade: "8", certificationNumber: "DEMO-CC-004", imageUrl: "https://images.pokemontcg.io/base1/2.png", valueMicroUsdc: 410_000_000, saleObservedAt: "2026-09-21T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/72370431/psa" },
  { id: "demo-charizard-001", name: "Charizard", setName: "Base Set", printing: "Unlimited holo #4", year: 1999, grader: "PSA", grade: "9", certificationNumber: "DEMO-CC-001", imageUrl: "https://images.pokemontcg.io/base1/4.png", valueMicroUsdc: 3_475_000_000, saleObservedAt: "2026-09-23T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/04441029/psa" },
  { id: "demo-venusaur-25000", name: "Venusaur", setName: "Base Set", printing: "Unlimited holo #15", year: 1999, grader: "PSA", grade: "9", certificationNumber: "DEMO-CC-005", imageUrl: "https://images.pokemontcg.io/base1/15.png", valueMicroUsdc: 640_000_000, saleObservedAt: "2026-09-24T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/71266335/psa" },
  { id: "demo-charizard-100000", name: "Charizard", setName: "Base Set", printing: "Unlimited holo #4", year: 1999, grader: "PSA", grade: "10", certificationNumber: "DEMO-CC-006", imageUrl: "https://images.pokemontcg.io/base1/4.png", valueMicroUsdc: 28_750_000_000, saleObservedAt: "2026-09-18T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/05318636/psa" },
] as const;

export function getDemoCardEvidence(value: string) {
  return DEMO_CARDS.find((card) => card.id === value);
}

export function isDemoCardId(value: string): boolean {
  return Boolean(getDemoCardEvidence(value));
}
