import type { OrgSettingsValue } from "../org-settings";
import { formatSettingNumber } from "../org-settings";
import type { AgreementTerms, ScopeType } from "./index";

/** The accent a tenant without one gets on its paper: the product's neutral ink, never a brand colour. */
export const NEUTRAL_ACCENT = "#374151";

export const DRAFT_MARK = "DRAFT - not yet sent to the customer";

export type DocumentLine = { description: string; visitsPerYear: number; costPerVisitCents: number; annualCents: number };

/** The scope part of a document: what the version covers, or that nobody recorded it. */
export type DocumentScope = { kind: "listed"; recordedOn: Date | null; types: ScopeType[] } | { kind: "not_recorded" };

/**
 * Everything one rendered agreement says, decided and ordered, with no layout in it (agreement-pdf door 2).
 * Money stays in cents and dates stay dates: the renderer formats them.
 */
export type AgreementDocument = {
  tenant: { name: string; address: string | null; phone: string | null; accent: string };
  number: string;
  versionNo: number;
  customerName: string;
  siteName: string;
  /** Printed on every page; `null` for anything but the current version of a draft. */
  mark: string | null;
  lines: DocumentLine[];
  totalCents: number;
  scope: DocumentScope;
  /** Only the terms that are set, in print order. */
  terms: { label: string; value: string }[];
};

/** The parts of an agreement page's view the document reads. */
export type DocumentSource = {
  number: string;
  customer: { name: string };
  site: { name: string };
  editable: boolean;
  shown: { versionNo: number; lines: (DocumentLine & { id?: string })[]; annualCents: number };
  serviceScope: { source: "live" | "frozen"; takenAt: Date | null; types: ScopeType[] } | { source: "not_recorded" };
  /** The terms frozen into the shown version; `null` while it is editable or when it recorded none (customer-portal door 3). */
  terms: AgreementTerms | null;
};

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

export function termsOf(settings: AgreementTerms): AgreementDocument["terms"] {
  const terms: AgreementDocument["terms"] = [
    { label: "Repair discount", value: `${formatSettingNumber(settings.repairDiscountPct)}%` },
    { label: "CPI cap", value: `${formatSettingNumber(settings.cpiCapPct)}%` },
  ];
  if (settings.cancellationNoticeDays !== null) terms.push({ label: "Cancellation notice", value: days(settings.cancellationNoticeDays) });
  if (settings.paymentDays !== null) terms.push({ label: "Payment terms", value: days(settings.paymentDays) });
  if (settings.governingProvince !== null) terms.push({ label: "Governing province", value: settings.governingProvince });
  if (settings.taxNote !== null) terms.push({ label: "Tax note", value: settings.taxNote });
  return terms;
}

export function buildAgreementDocument(source: DocumentSource, settings: OrgSettingsValue): AgreementDocument {
  const scope = source.serviceScope;
  return {
    tenant: { name: settings.legalName, address: settings.address, phone: settings.phone, accent: settings.accentColor ?? NEUTRAL_ACCENT },
    number: source.number,
    versionNo: source.shown.versionNo,
    customerName: source.customer.name,
    siteName: source.site.name,
    mark: source.editable ? DRAFT_MARK : null,
    lines: source.shown.lines.map(({ description, visitsPerYear, costPerVisitCents, annualCents }) => ({
      description,
      visitsPerYear,
      costPerVisitCents,
      annualCents,
    })),
    totalCents: source.shown.annualCents,
    scope: scope.source === "not_recorded" ? { kind: "not_recorded" } : { kind: "listed", recordedOn: scope.source === "frozen" ? scope.takenAt : null, types: scope.types },
    // The current draft prints the org's terms as they stand; a frozen version only what it was sent with, never the
    // settings of today (customer-portal AC 32, 33).
    terms: source.editable ? termsOf(settings) : source.terms ? termsOf(source.terms) : [],
  };
}
