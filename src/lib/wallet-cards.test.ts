import assert from "node:assert/strict";
import test from "node:test";
import { cardBelongsToWallet } from "./wallet-cards";

const wallet = "0xADc360fD724a714c585604389BC7dd07DB355Ee0";
const other = "0x1111111111111111111111111111111111111111";

test("shows only cards owned by the connected wallet", () => {
  assert.equal(cardBelongsToWallet(wallet, wallet.toLowerCase(), null), true);
  assert.equal(cardBelongsToWallet(wallet, other, null), false);
});

test("keeps a borrower's escrowed card visible during an active loan or auction", () => {
  const loan = (status: number, borrower = wallet) => [borrower, other, 2n, 100n, 0n, 0n, status];
  assert.equal(cardBelongsToWallet(wallet, other, loan(1)), true);
  assert.equal(cardBelongsToWallet(wallet, other, loan(3)), true);
  assert.equal(cardBelongsToWallet(wallet, other, loan(4)), false);
  assert.equal(cardBelongsToWallet(wallet, other, loan(1, other)), false);
});
