import assert from "node:assert/strict";
import test from "node:test";
import { auctionMarkets, discoverAuctionListings, type AuctionReader } from "./auction-discovery";

const currentManager = "0x362f6d3c3484d69dae532b7b953c0d3213db9e68";
const currentAuction = "0x9815c51b6d6ed25d1d62f9bf9f623ebd2f392067";
const previousManager = "0xb92a743f90aa307c794c52de7211905c31445b6c";
const previousAuction = "0xee946cfaccbf00a7502d9555c23a912b5d5913b2";

test("finds a defaulted loan in a previous market when the new market is empty", async () => {
  const markets = auctionMarkets([
    { chainId: 11155111, contracts: { LoanManager: currentManager, LiquidationAuction: currentAuction } },
    { chainId: 11155111, contracts: { LoanManager: previousManager, LiquidationAuction: previousAuction } },
    { chainId: 11155111, contracts: { LoanManager: previousManager, LiquidationAuction: previousAuction } },
  ], 11155111);
  assert.equal(markets.length, 2);
  const reader: AuctionReader = {
    nextLoanId: async (manager) => manager === currentManager ? 1n : 2n,
    auctionStates: async (auction, ids) => {
      assert.equal(auction, previousAuction);
      assert.deepEqual(ids, [1n]);
      return [{ endsAt: 1790453244n, settled: false }];
    },
  };
  const result = await discoverAuctionListings(markets, reader);
  assert.equal(result.failedMarkets, 0);
  assert.deepEqual(result.listings.map(({ loanId, managerAddress, auctionAddress }) => ({ loanId, managerAddress, auctionAddress })), [
    { loanId: "1", managerAddress: previousManager, auctionAddress: previousAuction },
  ]);
});

test("one unavailable market does not hide another market's auction", async () => {
  const markets = auctionMarkets([
    { chainId: 11155111, contracts: { LoanManager: currentManager, LiquidationAuction: currentAuction } },
    { chainId: 11155111, contracts: { LoanManager: previousManager, LiquidationAuction: previousAuction } },
  ], 11155111);
  const result = await discoverAuctionListings(markets, {
    nextLoanId: async (manager) => {
      if (manager === currentManager) throw new Error("RPC unavailable");
      return 2n;
    },
    auctionStates: async () => [{ endsAt: 1790453244n, settled: false }],
  });
  assert.equal(result.failedMarkets, 1);
  assert.equal(result.listings[0].auctionAddress, previousAuction);
});
