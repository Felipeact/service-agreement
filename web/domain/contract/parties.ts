/**
 * Who a contract binds, frozen when staff generate it (contract-generation door 1). The stored document is
 * `{"schema": 1, "contractor": {...}, "customer": {...}, "site": {...}, "signer": {...} | null}`; `{}` means not recorded.
 */
export type ContractParties = {
  contractor: { legalName: string; address: string | null; phone: string | null };
  customer: { name: string };
  site: { name: string; address: string | null };
  /** `null` for a contract backfilled from a site with nobody who has an email. */
  signer: { name: string; email: string } | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);

/** The parties of a stored document, or `null` when it is not schema 1 or lacks a name the contract cannot do without. */
export function parseContractParties(value: unknown): ContractParties | null {
  if (!isRecord(value) || value.schema !== 1) return null;
  const { contractor, customer, site, signer } = value;
  if (!isRecord(contractor) || !isRecord(customer) || !isRecord(site)) return null;
  const legalName = text(contractor.legalName);
  const customerName = text(customer.name);
  const siteName = text(site.name);
  if (legalName === null || customerName === null || siteName === null) return null;
  const signerName = isRecord(signer) ? text(signer.name) : null;
  const signerEmail = isRecord(signer) ? text(signer.email) : null;
  return {
    contractor: { legalName, address: text(contractor.address), phone: text(contractor.phone) },
    customer: { name: customerName },
    site: { name: siteName, address: text(site.address) },
    signer: signerName !== null && signerEmail !== null ? { name: signerName, email: signerEmail } : null,
  };
}
