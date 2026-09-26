import { FAUCET_CARDS } from "./faucet-cards";

/** Simulated Sepolia NFTs with curated, grade-matched auction comparables. */
export const DEMO_CARDS = [
  { id: "demo-pikachu-010", name: "Pikachu", setName: "Scarlet & Violet", printing: "Black Star Promo #027 · Paldea Evolved ETB", year: 2023, grader: "PSA", grade: "8", certificationNumber: "DEMO-CC-003", psaReferenceNumber: "115823683", imageUrl: "https://images.pokemontcg.io/svp/27.png", valueMicroUsdc: 31_000_000, saleObservedAt: "2026-08-02T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/115823683/psa" },
  { id: "demo-blastoise-1000", name: "Blastoise", setName: "Base Set", printing: "Unlimited holo #2", year: 1999, grader: "PSA", grade: "8", certificationNumber: "DEMO-CC-004", psaReferenceNumber: "72370431", imageUrl: "https://images.pokemontcg.io/base1/2.png", valueMicroUsdc: 410_000_000, saleObservedAt: "2026-09-21T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/72370431/psa" },
  { id: "demo-charizard-001", name: "Charizard", setName: "Base Set", printing: "Unlimited holo #4", year: 1999, grader: "PSA", grade: "9", certificationNumber: "DEMO-CC-001", psaReferenceNumber: "04441029", imageUrl: "https://images.pokemontcg.io/base1/4.png", valueMicroUsdc: 3_475_000_000, saleObservedAt: "2026-09-23T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/04441029/psa" },
  { id: "demo-venusaur-25000", name: "Venusaur", setName: "Base Set", printing: "Unlimited holo #15", year: 1999, grader: "PSA", grade: "9", certificationNumber: "DEMO-CC-005", psaReferenceNumber: "71266335", imageUrl: "https://images.pokemontcg.io/base1/15.png", valueMicroUsdc: 640_000_000, saleObservedAt: "2026-09-24T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/71266335/psa" },
  { id: "demo-charizard-100000", name: "Charizard", setName: "Base Set", printing: "Unlimited holo #4", year: 1999, grader: "PSA", grade: "10", certificationNumber: "DEMO-CC-006", psaReferenceNumber: "05318636", imageUrl: "https://images.pokemontcg.io/base1/4.png", valueMicroUsdc: 28_750_000_000, saleObservedAt: "2026-09-18T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/05318636/psa" },
  { id: "demo-pikachu-007", name: "Pikachu", setName: "Scarlet & Violet", printing: "Black Star Promo #027 · Paldea Evolved ETB", year: 2023, grader: "PSA", grade: "8", certificationNumber: "DEMO-CC-007", psaReferenceNumber: "115823683", imageUrl: "https://images.pokemontcg.io/svp/27.png", valueMicroUsdc: 31_000_000, saleObservedAt: "2026-08-02T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/115823683/psa" },
  { id: "demo-venusaur-008", name: "Venusaur", setName: "Base Set", printing: "Unlimited holo #15", year: 1999, grader: "PSA", grade: "9", certificationNumber: "DEMO-CC-008", psaReferenceNumber: "71266335", imageUrl: "https://images.pokemontcg.io/base1/15.png", valueMicroUsdc: 640_000_000, saleObservedAt: "2026-09-24T00:00:00.000Z", saleSourceUrl: "https://www.psacard.com/cert/71266335/psa" },
] as const;

export const CATALOG_CARDS = [...DEMO_CARDS, ...FAUCET_CARDS];

export function getDemoCardEvidence(value: string) {
  return CATALOG_CARDS.find((card) => card.id === value);
}

export function isDemoCardId(value: string): boolean {
  return Boolean(getDemoCardEvidence(value));
}
