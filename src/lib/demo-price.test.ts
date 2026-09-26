import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoPrice } from "./demo-price";
import { FAUCET_CARDS, PSA_GUIDE_URL } from "./faucet-cards";

test("grade-matched sale is usable while recent and keeps its source date", () => {
  const fetched = new Date("2026-09-26T00:00:00Z");
  const result = createDemoPrice("demo-charizard-001", 3_475_000_000, fetched);
  assert.equal(result.lastSaleMicroUsdc, 3_475_000_000);
  assert.equal(result.saleObservedAt, "2026-09-23T00:00:00.000Z");
  assert.equal(result.freshForSignedQuote, true);
  assert.equal(result.fetchedAt, fetched.toISOString());
  assert.match(result.saleSourceUrl, /^https:\/\/www\.psacard\.com\/cert\//);
});

test("last sale expires and stale database prices cannot be signed", () => {
  assert.equal(createDemoPrice("demo-charizard-001", 3_475_000_000, new Date("2027-01-01T00:00:00Z")).freshForSignedQuote, false);
  assert.throws(() => createDemoPrice("demo-charizard-001", 10_000_000_000));
  assert.throws(() => createDemoPrice("another-card", 3_475_000_000));
});

test("forty distinct PSA guide cards keep their grade-matched guide estimates", () => {
  assert.equal(FAUCET_CARDS.length, 40);
  assert.equal(new Set(FAUCET_CARDS.map((card) => card.name)).size, 40);
  assert.equal(new Set(FAUCET_CARDS.map((card) => card.certificationNumber)).size, 40);
  assert.equal(FAUCET_CARDS.find((card) => card.name === "Charizard")?.valueMicroUsdc, 10_000_000_000);
  assert.equal(FAUCET_CARDS.find((card) => card.name === "Beedrill")?.valueMicroUsdc, 35_000_000);
  for (const card of FAUCET_CARDS) {
    assert.equal(card.saleSourceUrl, PSA_GUIDE_URL);
    assert.equal(createDemoPrice(card.id, card.valueMicroUsdc, new Date("2026-09-26T21:00:00Z")).source, "psa-price-guide");
  }
});
