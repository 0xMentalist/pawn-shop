export const BORROWER_APR_BPS = 2_000n;
export const MAX_LTV_BPS = 3_500n;
export const LP_INTEREST_BPS = 7_500n;
export const LOAN_TERMS_DAYS = [30, 60, 90] as const;
export type LoanTermDays = typeof LOAN_TERMS_DAYS[number];
export const TERM_DAYS = 90n;
export const GRACE_DAYS = 7n;
export const DEMO_MAX_PRINCIPAL_MICRO_USDC = 3_500_000_000n;
const BPS = 10_000n;
const YEAR_SECONDS = 365n * 24n * 60n * 60n;

export function maximumPrincipal(valueMicroUsdc: bigint) {
  return (valueMicroUsdc * MAX_LTV_BPS) / BPS;
}

export function borrowLimit(valueMicroUsdc: bigint) {
  const byValue = maximumPrincipal(valueMicroUsdc);
  const capped = byValue < DEMO_MAX_PRINCIPAL_MICRO_USDC ? byValue : DEMO_MAX_PRINCIPAL_MICRO_USDC;
  return (capped / 10_000n) * 10_000n;
}

export function parseBorrowAmount(input: string): bigint | null {
  const match = /^(?:(0|[1-9]\d*)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/.exec(input.trim());
  if (!match) return null;
  return BigInt(match[1] ?? "0") * 1_000_000n + BigInt((match[2] ?? match[3] ?? "").padEnd(2, "0")) * 10_000n;
}

export function formatBorrowAmount(microUsdc: bigint) {
  const cents = microUsdc / 10_000n;
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

export function simpleInterest(principalMicroUsdc: bigint, elapsedSeconds: bigint) {
  if (elapsedSeconds < 0n) throw new Error("Elapsed time cannot be negative");
  return (principalMicroUsdc * BORROWER_APR_BPS * elapsedSeconds) / (BPS * YEAR_SECONDS);
}

export function borrowCostBpsForPeriod(elapsedSeconds: bigint) {
  if (elapsedSeconds < 0n) throw new Error("Elapsed time cannot be negative");
  const termSeconds = TERM_DAYS * 24n * 60n * 60n;
  return (BORROWER_APR_BPS * (elapsedSeconds > termSeconds ? termSeconds : elapsedSeconds) + YEAR_SECONDS / 2n) / YEAR_SECONDS;
}

export function isLoanTermDays(value: number | null): value is LoanTermDays {
  return value !== null && LOAN_TERMS_DAYS.some((term) => term === value);
}

export function maximumRepayment(principalMicroUsdc: bigint, termSeconds: bigint) {
  return principalMicroUsdc + simpleInterest(principalMicroUsdc, termSeconds);
}

export function estimatedSupplyAprBps(utilizationBps: bigint) {
  if (utilizationBps < 0n || utilizationBps > BPS) throw new Error("Invalid utilization");
  return (BORROWER_APR_BPS * utilizationBps * LP_INTEREST_BPS) / (BPS * BPS);
}

export function formatUsdc(microUsdc: bigint | number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(microUsdc) / 1_000_000);
}
