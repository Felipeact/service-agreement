import type { OrgSettingsValue } from "../org-settings";
import { formatSettingNumber } from "../org-settings";
import { visitSchedule, type ScheduleRow } from "./cadence";
import type { AgreementTerms, ScopeType } from "./index";
import { formatTermDate, termLine, termMonthsLabel, type AgreementTerm } from "./term";

/** The accent a tenant without one gets on its paper: the product's neutral ink, never a brand colour. */
export const NEUTRAL_ACCENT = "#374151";

export const DRAFT_MARK = "DRAFT - not yet sent to the customer";

export type DocumentLine = { description: string; visitsPerYear: number; costPerVisitCents: number; annualCents: number };

/** A line as a document source holds it: its printed figures, plus the months and equipment the schedule reads. */
export type DocumentSourceLine = DocumentLine & { id?: string; visitMonths: number[]; equipment: { code?: string; name: string }[] };

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
  /**
   * Which equipment is visited in which month, from the lines (cadence AC 19), with the seasonal tasks due in it
   * (seasonal-tasks AC 16); empty when there are none.
   */
  schedule: ScheduleRow[];
  scope: DocumentScope;
  /** The version's term as one printed line (term-dates AC 18, 19). */
  term: string;
  /** `Valid until <date>` for a version that was sent with a validity date, else `null` (proposal-expiry AC 13, 14). */
  validity: string | null;
  /** Only the terms that are set, in print order. */
  terms: { label: string; value: string }[];
};

/** The parts of an agreement page's view the document reads. */
export type DocumentSource = {
  number: string;
  customer: { name: string };
  site: { name: string };
  editable: boolean;
  shown: { versionNo: number; lines: DocumentSourceLine[]; annualCents: number };
  serviceScope: { source: "live" | "frozen"; takenAt: Date | null; types: ScopeType[] } | { source: "not_recorded" };
  /** The terms frozen into the shown version; `null` while it is editable or when it recorded none (customer-portal door 3). */
  terms: AgreementTerms | null;
  /** The shown version's start, months and end (term-dates door 1). */
  term: AgreementTerm;
  /** The shown version's last day for a decision, `YYYY-MM-DD`, or `null` (proposal-expiry door 1). */
  validUntil: string | null;
};

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

/** The renewal clause, from the frozen or current terms and the version's term months (term-dates AC 20). */
export function renewalClause(terms: AgreementTerms, termMonths: number): string | null {
  if (terms.renewalNoticeDays === null || terms.cpiRenegotiationThresholdPct === null) return null;
  return (
    `Renews automatically for another ${termMonthsLabel(termMonths)} with the CPI increase, capped at ` +
    `${formatSettingNumber(terms.cpiCapPct)}%. If CPI is ${formatSettingNumber(terms.cpiRenegotiationThresholdPct)}% or more, ` +
    `the renewal is renegotiated. Notice is given ${days(terms.renewalNoticeDays)} before the end date.`
  );
}

export function termsOf(settings: AgreementTerms, termMonths: number): AgreementDocument["terms"] {
  const terms: AgreementDocument["terms"] = [
    { label: "Repair discount", value: `${formatSettingNumber(settings.repairDiscountPct)}%` },
    { label: "CPI cap", value: `${formatSettingNumber(settings.cpiCapPct)}%` },
  ];
  if (settings.cancellationNoticeDays !== null) terms.push({ label: "Cancellation notice", value: days(settings.cancellationNoticeDays) });
  if (settings.paymentDays !== null) terms.push({ label: "Payment terms", value: days(settings.paymentDays) });
  if (settings.governingProvince !== null) terms.push({ label: "Governing province", value: settings.governingProvince });
  if (settings.taxNote !== null) terms.push({ label: "Tax note", value: settings.taxNote });
  const renewal = renewalClause(settings, termMonths);
  if (renewal !== null) terms.push({ label: "Renewal", value: renewal });
  return terms;
}

/** What the agreement and the contract print alike: the lines, the total, the schedule, the scope and the term. */
export function documentBody(source: DocumentSource) {
  const scope = source.serviceScope;
  return {
    lines: source.shown.lines.map(({ description, visitsPerYear, costPerVisitCents, annualCents }) => ({
      description,
      visitsPerYear,
      costPerVisitCents,
      annualCents,
    })),
    totalCents: source.shown.annualCents,
    schedule: visitSchedule(source.shown.lines, scope.source === "not_recorded" ? [] : scope.types),
    scope: (scope.source === "not_recorded" ? { kind: "not_recorded" } : { kind: "listed", recordedOn: scope.source === "frozen" ? scope.takenAt : null, types: scope.types }) satisfies DocumentScope,
    term: termLine(source.term, source.editable),
  };
}

export function buildAgreementDocument(source: DocumentSource, settings: OrgSettingsValue): AgreementDocument {
  return {
    tenant: { name: settings.legalName, address: settings.address, phone: settings.phone, accent: settings.accentColor ?? NEUTRAL_ACCENT },
    number: source.number,
    versionNo: source.shown.versionNo,
    customerName: source.customer.name,
    siteName: source.site.name,
    mark: source.editable ? DRAFT_MARK : null,
    ...documentBody(source),
    validity: source.validUntil ? `Valid until ${formatTermDate(source.validUntil)}` : null,
    // The current draft prints the org's terms as they stand; a frozen version only what it was sent with, never the
    // settings of today (customer-portal AC 32, 33).
    terms: source.editable ? termsOf(settings, source.term.months) : source.terms ? termsOf(source.terms, source.term.months) : [],
  };
}
