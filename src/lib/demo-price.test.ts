import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoPrice } from "./demo-price";

test("mock price marks a stale assumption without altering its timestamp", () => {
  const recorded = new Date("2026-09-20T00:00:00Z");
  const fetched = new Date("2026-09-26T00:00:00Z");
  const result = createDemoPrice("demo-charizard-001", 10_000_000_000, recorded, fetched);
  assert.equal(result.assumedValueMicroUsdc, 10_000_000_000);
  assert.equal(result.assumptionRecordedAt, recorded.toISOString());
  assert.equal(result.freshForSignedQuote, false);
  assert.equal(result.fetchedAt, fetched.toISOString());
});

test("mock price rejects other assets", () => {
  assert.throws(() => createDemoPrice("another-card", 10_000_000_000, new Date()));
});
