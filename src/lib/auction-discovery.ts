import { isAddress, type Address } from "viem";

export type AuctionDeployment = {
  chainId: number;
  contracts: { LoanManager?: string; LiquidationAuction?: string };
};

export type AuctionMarket = { managerAddress: Address; auctionAddress: Address };
export type AuctionListing = AuctionMarket & { loanId: string; endsAt: bigint };
export type AuctionState = { endsAt: bigint; settled: boolean };

export type AuctionReader = {
  nextLoanId: (managerAddress: Address) => Promise<bigint>;
  auctionStates: (auctionAddress: Address, loanIds: bigint[]) => Promise<(AuctionState | null)[]>;
};

export function auctionMarkets(deployments: AuctionDeployment[], chainId: number): AuctionMarket[] {
  const seen = new Set<string>();
  return deployments.flatMap((deployment) => {
    const managerAddress = deployment.contracts?.LoanManager;
    const auctionAddress = deployment.contracts?.LiquidationAuction;
    if (deployment.chainId !== chainId || !managerAddress || !auctionAddress || !isAddress(managerAddress) || !isAddress(auctionAddress)) return [];
    const key = managerAddress.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ managerAddress, auctionAddress }];
  });
}

export async function discoverAuctionListings(markets: AuctionMarket[], reader: AuctionReader) {
  const results = await Promise.allSettled(markets.map(async (market) => {
    const nextLoanId = await reader.nextLoanId(market.managerAddress);
    const listings: AuctionListing[] = [];
    for (let upper = nextLoanId - 1n; upper > 0n && listings.length < 50;) {
      const lower = upper > 49n ? upper - 49n : 1n;
      const loanIds = Array.from({ length: Number(upper - lower + 1n) }, (_, index) => upper - BigInt(index));
      const states = await reader.auctionStates(market.auctionAddress, loanIds);
      if (states.length !== loanIds.length || states.some((state) => state === null)) throw new Error(`Could not read auctions at ${market.auctionAddress}`);
      states.forEach((state, index) => {
        if (state && state.endsAt > 0n && !state.settled) listings.push({ ...market, loanId: loanIds[index].toString(), endsAt: state.endsAt });
      });
      upper = lower - 1n;
    }
    return listings;
  }));

  const listings = results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .sort((left, right) => left.endsAt === right.endsAt ? 0 : left.endsAt > right.endsAt ? -1 : 1)
    .slice(0, 50);
  return { listings, failedMarkets: results.filter((result) => result.status === "rejected").length };
}
