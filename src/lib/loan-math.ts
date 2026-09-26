export const BORROWER_APR_BPS = 2_000n;
export const MAX_LTV_BPS = 3_500n;
export const LP_INTEREST_BPS = 7_500n;
export const TERM_DAYS = 90n;
export const GRACE_DAYS = 7n;
const BPS = 10_000n;
const YEAR_SECONDS = 365n * 24n * 60n * 60n;

export function maximumPrincipal(valueMicroUsdc: bigint) {
  return (valueMicroUsdc * MAX_LTV_BPS) / BPS;
}

export function simpleInterest(principalMicroUsdc: bigint, elapsedSeconds: bigint) {
  if (elapsedSeconds < 0n) throw new Error("Elapsed time cannot be negative");
  return (principalMicroUsdc * BORROWER_APR_BPS * elapsedSeconds) / (BPS * YEAR_SECONDS);
}

export function estimatedLpApyBps(utilizationBps: bigint) {
  if (utilizationBps < 0n || utilizationBps > BPS) throw new Error("Invalid utilization");
  return (BORROWER_APR_BPS * utilizationBps * LP_INTEREST_BPS) / (BPS * BPS);
}

export function formatUsdc(microUsdc: bigint | number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(microUsdc) / 1_000_000);
}
