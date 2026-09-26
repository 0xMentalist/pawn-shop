import assert from "node:assert/strict";
import test from "node:test";
import { estimatedLpApyBps, formatUsdc, maximumPrincipal, simpleInterest } from "./loan-math";

test("PRD quote uses 35% LTV and 20% simple interest for 90 days", () => {
  const principal = maximumPrincipal(10_000_000_000n);
  const interest = simpleInterest(principal, 90n * 24n * 60n * 60n);
  assert.equal(principal, 3_500_000_000n);
  assert.equal(interest, 172_602_739n);
  assert.equal(formatUsdc(principal + interest), "$3,672.60");
});

test("LP APY varies with utilization", () => {
  assert.equal(estimatedLpApyBps(3_500n), 525n);
  assert.equal(estimatedLpApyBps(8_000n), 1_200n);
  assert.throws(() => estimatedLpApyBps(10_001n), /Invalid utilization/);
});
