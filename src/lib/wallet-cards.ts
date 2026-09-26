/** A card belongs in the wallet view when held by the wallet or backing its open loan. */
export function cardBelongsToWallet(wallet: string, owner: unknown, loan: unknown): boolean {
  const normalizedWallet = wallet.toLowerCase();
  if (typeof owner === "string" && owner.toLowerCase() === normalizedWallet) return true;
  if (!Array.isArray(loan)) return false;
  const borrower = loan[0];
  const status = loan[6];
  return typeof borrower === "string"
    && borrower.toLowerCase() === normalizedWallet
    && (Number(status) === 1 || Number(status) === 3);
}
