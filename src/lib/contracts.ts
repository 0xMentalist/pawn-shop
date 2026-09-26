import { isAddress, type Address } from "viem";
import mockUsdcAbi from "@/lib/abi/MockUSDC.json";
import cardAbi from "@/lib/abi/VaultedCardNFT.json";
import cardFaucetAbi from "@/lib/abi/DemoCardFaucet.json";
import verifierAbi from "@/lib/abi/ValuationVerifier.json";
import registryAbi from "@/lib/abi/HumanVerificationRegistry.json";
import poolAbi from "@/lib/abi/LendingPool.json";
import managerAbi from "@/lib/abi/LoanManager.json";
import auctionAbi from "@/lib/abi/LiquidationAuction.json";

function address(value: string | undefined): Address | undefined {
  return value && isAddress(value) ? value : undefined;
}

export const contracts = {
  mockUsdc: address(process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS),
  card: address(process.env.NEXT_PUBLIC_CARD_ADDRESS),
  cardFaucet: address(process.env.NEXT_PUBLIC_CARD_FAUCET_ADDRESS),
  verifier: address(process.env.NEXT_PUBLIC_VALUATION_VERIFIER_ADDRESS),
  registry: address(process.env.NEXT_PUBLIC_HUMAN_REGISTRY_ADDRESS),
  pool: address(process.env.NEXT_PUBLIC_LENDING_POOL_ADDRESS),
  manager: address(process.env.NEXT_PUBLIC_LOAN_MANAGER_ADDRESS),
  legacyManagers: (process.env.NEXT_PUBLIC_LEGACY_LOAN_MANAGER_ADDRESSES || process.env.NEXT_PUBLIC_PREVIOUS_LOAN_MANAGER_ADDRESS || "")
    .split(",").map((value) => address(value.trim())).filter((value): value is Address => Boolean(value)),
  auction: address(process.env.NEXT_PUBLIC_AUCTION_ADDRESS),
} as const;

export const abis = { mockUsdc: mockUsdcAbi, card: cardAbi, cardFaucet: cardFaucetAbi, verifier: verifierAbi, registry: registryAbi, pool: poolAbi, manager: managerAbi, auction: auctionAbi } as const;
export const SEPOLIA_CHAIN_ID = 11155111;
