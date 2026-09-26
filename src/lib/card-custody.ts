export function cardCustodyStatus(details: unknown): number | null {
  if (typeof details !== "object" || details === null || !("custodyStatus" in details)) return null;
  const status = Number(details.custodyStatus);
  return Number.isInteger(status) && status >= 0 && status <= 4 ? status : null;
}

export function cardCertificationNumber(details: unknown): string | null {
  if (typeof details !== "object" || details === null || !("certificationNumber" in details)) return null;
  return typeof details.certificationNumber === "string" ? details.certificationNumber : null;
}
