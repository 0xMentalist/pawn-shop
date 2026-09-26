import type { Address } from "viem";

export const WORLD_BORROWER_ACTION = "collector-credit-borrower";

export const WORLD_CREDENTIAL_SCHEMAS = {
  proof_of_human: 1,
  passport: 9303,
  mnc: 9310,
  selfie: 11,
} as const;

export type WorldCredential = keyof typeof WORLD_CREDENTIAL_SCHEMAS;

export function normalizeWorldCredential(identifier: string | undefined): WorldCredential | null {
  const normalized = identifier === "face" ? "selfie" : identifier;
  return normalized && Object.hasOwn(WORLD_CREDENTIAL_SCHEMAS, normalized) ? normalized as WorldCredential : null;
}

export function requestedWorldCredential(item: { identifier?: string; issuer_schema_id?: number }): WorldCredential | null {
  const credential = normalizeWorldCredential(item.identifier);
  return credential && item.issuer_schema_id === WORLD_CREDENTIAL_SCHEMAS[credential] ? credential : null;
}

export function hasVerifiedWorldCredential(
  results: Array<{ identifier?: string; success?: boolean; nullifier?: string }> | undefined,
  credential: WorldCredential,
  nullifier: string,
) {
  return results?.some((item) =>
    normalizeWorldCredential(item.identifier) === credential
    && item.success === true
    && /^0x[0-9a-fA-F]{1,64}$/.test(item.nullifier ?? "")
    && BigInt(item.nullifier!) === BigInt(nullifier)
  ) ?? false;
}

export function worldAuthorizationMessage(wallet: Address, nonce: string) {
  return `Prawn Shop World ID authorization\nWallet: ${wallet.toLowerCase()}\nAction: ${WORLD_BORROWER_ACTION}\nRP nonce: ${nonce}\nChain: Sepolia (11155111)`;
}
