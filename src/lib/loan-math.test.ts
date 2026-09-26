import assert from "node:assert/strict";
import test from "node:test";
import { borrowCostBpsForPeriod, borrowLimit, estimatedSupplyAprBps, formatBorrowAmount, formatUsdc, maximumPrincipal, maximumRepayment, parseBorrowAmount, simpleInterest } from "./loan-math";

test("PRD quote uses 35% LTV and 20% simple interest for 90 days", () => {
  const principal = maximumPrincipal(10_000_000_000n);
  const interest = simpleInterest(principal, 90n * 24n * 60n * 60n);
  assert.equal(principal, 3_500_000_000n);
  assert.equal(interest, 172_602_739n);
  assert.equal(formatUsdc(principal + interest), "$3,672.60");
});

test("supply APR estimate varies with utilization", () => {
  assert.equal(estimatedSupplyAprBps(3_500n), 525n);
  assert.equal(estimatedSupplyAprBps(8_000n), 1_200n);
  assert.throws(() => estimatedSupplyAprBps(10_001n), /Invalid utilization/);
});

test("full-term approval still covers repayment after interest accrues", () => {
  const principal = 3_500_000_000n;
  const term = 90n * 24n * 60n * 60n;
  const approval = maximumRepayment(principal, term);
  const dueAtPrompt = principal + simpleInterest(principal, 60n);
  const dueAtSubmission = principal + simpleInterest(principal, 120n);
  assert.ok(dueAtSubmission > dueAtPrompt);
  assert.ok(approval >= dueAtSubmission);
  assert.equal(approval, 3_672_602_739n);
});

test("borrow input uses cents and stays within the card and protocol limits", () => {
  assert.equal(borrowLimit(31_000_000n), 10_850_000n);
  assert.equal(borrowLimit(31_130_000n), 10_890_000n);
  assert.equal(borrowLimit(28_750_000_000n), 3_500_000_000n);
  assert.equal(formatBorrowAmount(borrowLimit(31_000_000n)), "10.85");
  assert.equal(parseBorrowAmount("10.85"), 10_850_000n);
  assert.equal(parseBorrowAmount(".50"), 500_000n);
  assert.equal(parseBorrowAmount("10."), 10_000_000n);
  assert.equal(parseBorrowAmount("0.01"), 10_000n);
  assert.equal(parseBorrowAmount("10.851"), null);
  assert.equal(parseBorrowAmount("1e3"), null);
});

test("borrowing cost reflects the elapsed period and caps at maturity", () => {
  const day = 24n * 60n * 60n;
  assert.equal(borrowCostBpsForPeriod(30n * day), 164n);
  assert.equal(borrowCostBpsForPeriod(60n * day), 329n);
  assert.equal(borrowCostBpsForPeriod(90n * day), 493n);
  assert.equal(borrowCostBpsForPeriod(97n * day), 493n);
  assert.throws(() => borrowCostBpsForPeriod(-1n), /Elapsed time/);
});
