/** Fixed, fictional Sepolia cards and prices for exercising the loan flow. */
export const DEMO_CARDS = [
  { id: "demo-pikachu-010", name: "Pikachu", setName: "Scarlet & Violet", year: 2023, grader: "PSA", grade: "8", certificationNumber: "DEMO-CC-003", valueMicroUsdc: 10_000_000 },
  { id: "demo-blastoise-1000", name: "Blastoise", setName: "Base Set", year: 1999, grader: "PSA", grade: "8", certificationNumber: "DEMO-CC-004", valueMicroUsdc: 1_000_000_000 },
  { id: "demo-charizard-001", name: "Charizard", setName: "Base Set", year: 1999, grader: "PSA", grade: "9", certificationNumber: "DEMO-CC-001", valueMicroUsdc: 10_000_000_000 },
  { id: "demo-venusaur-25000", name: "Venusaur", setName: "Base Set", year: 1999, grader: "PSA", grade: "9", certificationNumber: "DEMO-CC-005", valueMicroUsdc: 25_000_000_000 },
  { id: "demo-charizard-100000", name: "Charizard", setName: "Base Set", year: 1999, grader: "PSA", grade: "10", certificationNumber: "DEMO-CC-006", valueMicroUsdc: 100_000_000_000 },
] as const;

export function isDemoCardId(value: string): boolean {
  return DEMO_CARDS.some((card) => card.id === value);
}
