import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRealyseMarketSignal, REALYSE_CARD_ID } from "./realyse";

const matching = {
  card_id: REALYSE_CARD_ID,
  category: "graded",
  grader: "PSA",
  grade: "9",
  display_name: "POKEMON BASE SET CHARIZARD-HOLO 1999 #4 PSA 9",
  price_usd: 3702,
  price_status: "indicative",
  sample_count: 1,
  source_count: 1,
  as_of: "2026-09-21T14:40:29Z",
  recent_observations: [{ title: "POKEMON BASE SET CHARIZARD-HOLO 1999 #4 PSA 9", observed_at: "2026-09-10T01:04:00Z" }],
};

test("accepts an exact PSA 9 Base Set Charizard sale with dated evidence", () => {
  const signal = parseRealyseMarketSignal(matching);
  assert.equal(signal?.priceUsd, 3702);
  assert.equal(signal?.sampleCount, 1);
  assert.equal(signal?.status, "indicative");
});

test("rejects an aggregate contaminated with Celebrations sales", () => {
  assert.equal(parseRealyseMarketSignal({ ...matching, sample_count: 2, recent_observations: [
    ...matching.recent_observations,
    { title: "2021 Celebrations Charizard #4 PSA 9", observed_at: "2026-09-20T00:00:00Z" },
  ] }), null);
});

test("rejects the wrong grade or incomplete sale tape", () => {
  assert.equal(parseRealyseMarketSignal({ ...matching, grade: "10" }), null);
  assert.equal(parseRealyseMarketSignal({ ...matching, sample_count: 2 }), null);
});
