import { isAddress, type Address } from "viem";
import mockUsdcAbi from "@/lib/abi/MockUSDC.json";
import cardAbi from "@/lib/abi/VaultedCardNFT.json";
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
  verifier: address(process.env.NEXT_PUBLIC_VALUATION_VERIFIER_ADDRESS),
  registry: address(process.env.NEXT_PUBLIC_HUMAN_REGISTRY_ADDRESS),
  pool: address(process.env.NEXT_PUBLIC_LENDING_POOL_ADDRESS),
  manager: address(process.env.NEXT_PUBLIC_LOAN_MANAGER_ADDRESS),
  auction: address(process.env.NEXT_PUBLIC_AUCTION_ADDRESS),
} as const;

export const abis = { mockUsdc: mockUsdcAbi, card: cardAbi, verifier: verifierAbi, registry: registryAbi, pool: poolAbi, manager: managerAbi, auction: auctionAbi } as const;
export const SEPOLIA_CHAIN_ID = 11155111;
