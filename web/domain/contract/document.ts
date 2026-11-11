import { documentBody, NEUTRAL_ACCENT, termMonthsLabel, type AgreementDocument, type AgreementTerms, type DocumentSource } from "../agreement";
import { DEFAULT_ITEM_WORDS, formatSettingNumber, PROVINCE_NAMES, type ItemWords } from "../org-settings";
import type { TenantLogo } from "../org-settings/logo";
import type { ContractParties } from "./parties";

/**
 * Everything one rendered contract says, decided and ordered, with no layout in it. The agreement's lines, schedule,
 * scope and term come from the accepted version; who is bound comes from the contract's own parties.
 */
export type ContractDocument = Pick<AgreementDocument, "number" | "versionNo" | "lines" | "totalCents" | "schedule" | "scope" | "term"> & {
  contractor: { name: string; address: string | null; phone: string | null; accent: string; logo?: TenantLogo };
  /** The org's item words, for the covered-items section (item-vocabulary AC 9). */
  words?: ItemWords;
  customerName: string;
  site: { name: string; address: string | null };
  signer: { name: string; email: string } | null;
  /** The frozen tax note, printed under the total. */
  taxNote: string | null;
  /** One sentence per term that is set, in print order. */
  clauses: string[];
  /** Always `null`: only an accepted agreement becomes a contract. */
  mark: null;
};

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
const daysNotice = (count: number) => `${count} ${count === 1 ? "day's" : "days'"} written notice`;
const provinceName = (code: string) => (code in PROVINCE_NAMES ? PROVINCE_NAMES[code as keyof typeof PROVINCE_NAMES] : code);

/** The terms the contract states as clauses, from the accepted version's frozen terms (contract-generation AC 28). */
export function contractClauses(terms: AgreementTerms | null, termMonths: number): string[] {
  if (terms === null) return [];
  const clauses: string[] = [];
  if (terms.paymentDays !== null) clauses.push(`Invoices are payable within ${days(terms.paymentDays)}.`);
  if (terms.cancellationNoticeDays !== null) clauses.push(`Either party may cancel this contract with ${daysNotice(terms.cancellationNoticeDays)}.`);
  clauses.push(`Repair work is discounted by ${formatSettingNumber(terms.repairDiscountPct)}%.`);
  clauses.push(`The annual price may rise with CPI, capped at ${formatSettingNumber(terms.cpiCapPct)}%.`);
  if (terms.governingProvince !== null) clauses.push(`This contract is governed by the laws of ${provinceName(terms.governingProvince)}.`);
  if (terms.renewalNoticeDays !== null && terms.cpiRenegotiationThresholdPct !== null) {
    clauses.push(
      `This contract renews for successive ${termMonthsLabel(termMonths)} terms unless CPI is at or above ` +
        `${formatSettingNumber(terms.cpiRenegotiationThresholdPct)}%, when the parties renegotiate; the customer is notified ` +
        `${days(terms.renewalNoticeDays)} before the end date.`,
    );
  }
  return clauses;
}

/** `accent` is the tenant's colour as the settings hold it now; a colour is branding, not who is bound. */
export function buildContractDocument(source: DocumentSource, parties: ContractParties, accent: string | null, words: ItemWords = DEFAULT_ITEM_WORDS): ContractDocument {
  const body = documentBody(source);
  return {
    number: source.number,
    versionNo: source.shown.versionNo,
    lines: body.lines,
    totalCents: body.totalCents,
    schedule: body.schedule,
    scope: body.scope,
    term: body.term,
    contractor: { name: parties.contractor.legalName, address: parties.contractor.address, phone: parties.contractor.phone, accent: accent ?? NEUTRAL_ACCENT },
    words,
    customerName: parties.customer.name,
    site: parties.site,
    signer: parties.signer,
    taxNote: source.terms?.taxNote ?? null,
    clauses: contractClauses(source.terms, source.term.months),
    mark: null,
  };
}
