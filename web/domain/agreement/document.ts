import type { ItemWords, OrgSettingsValue } from "../org-settings";
import type { TenantLogo } from "../org-settings/logo";
import { formatSettingNumber, itemWords } from "../org-settings";
import { visitSchedule, type ScheduleRow } from "./cadence";
import type { AgreementTerms, ScopeType } from "./index";
import { sectionOptions, type DocOptions, type IncludedOptions, type LayoutItem } from "./layout";
import { agreementTemplateValues, renderAgreementLayout, SYSTEM_AGREEMENT_BODY, type AgreementTemplateBody } from "./template";
import { formatTermDate, termLine, termMonthsLabel, type AgreementTerm } from "./term";
import type { RenderedBlock } from "../contract/template";

/** The accent a tenant without one gets on its paper: the product's neutral ink, never a brand colour. */
export const NEUTRAL_ACCENT = "#374151";

export const DRAFT_MARK = "DRAFT - not yet sent to the customer";

export type DocumentLine = { description: string; visitsPerYear: number; costPerVisitCents: number; annualCents: number };

/** A line as a document source holds it: its printed figures, plus the months and equipment the schedule reads. */
export type DocumentSourceLine = DocumentLine & { id?: string; visitMonths: number[]; equipment: { code?: string; name: string }[] };

/** The scope part of a document: what the version covers, that nobody recorded it, or that its template hides the section. */
export type DocumentScope = { kind: "listed"; recordedOn: Date | null; types: ScopeType[] } | { kind: "not_recorded" } | { kind: "hidden" };

/**
 * Everything one rendered agreement says, decided and ordered, with no layout in it (agreement-pdf door 2).
 * Money stays in cents and dates stay dates: the renderer formats them.
 */
export type AgreementDocument = {
  tenant: { name: string; address: string | null; phone: string | null; accent: string; logo?: TenantLogo };
  /** The org's words for the serviced item, as the sections name it (item-vocabulary door 3). */
  words: ItemWords;
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
  /** The template version's intro, after the title block and before the price table (agreement-templates AC 10). */
  intro?: RenderedBlock[];
  /** The template version's closing text, after the terms and before the page footer. */
  footer?: RenderedBlock[];
  /** Which optional sections the template shows; the price table, the terms and the page footer are always drawn. */
  sections?: { schedule: boolean; scope: boolean };
  /**
   * The items the document draws after its title block, in order, variables filled (block-editor AC 3). A document built before
   * layouts existed has none and draws as the system layout does.
   */
  layout?: LayoutItem[];
  /** The document options, with the title's variables filled; absent means today's options. */
  doc?: DocOptions;
  /** The frequency of each equipment type by code (`QUARTERLY`), only for a document whose `included` section shows it (AC 15). */
  frequencies?: Record<string, string>;
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

/** `QUARTERLY` for 4 visits a year: 12 `MONTHLY`, 4 `QUARTERLY`, 2 `BI-ANNUAL`, 1 `ANNUAL`, any other count `N TIMES PER YEAR`. */
export function frequencyLabel(visitsPerYear: number): string {
  const named: Record<number, string> = { 12: "MONTHLY", 4: "QUARTERLY", 2: "BI-ANNUAL", 1: "ANNUAL" };
  return named[visitsPerYear] ?? `${visitsPerYear} TIMES PER YEAR`;
}

/**
 * The frequency of each equipment type, by type code, from the visits per year of the first service line that covers it (a line
 * covers a type by its code, or by its name when the line records no code). A type no line covers has no entry.
 */
export function typeFrequencies(lines: readonly DocumentSourceLine[], types: readonly ScopeType[]): Record<string, string> {
  const frequencies: Record<string, string> = {};
  for (const type of types) {
    const line = lines.find((candidate) => candidate.equipment.some((item) => (item.code !== undefined ? item.code === type.code : item.name === type.name)));
    if (line) frequencies[type.code] = frequencyLabel(line.visitsPerYear);
  }
  return frequencies;
}

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

/**
 * `template` is the body of the template version the agreement is pinned to; absent means the system body, which draws what
 * every agreement drew before templates existed (agreement-templates AC 9).
 */
export function buildAgreementDocument(
  source: DocumentSource,
  settings: OrgSettingsValue,
  template: AgreementTemplateBody = SYSTEM_AGREEMENT_BODY,
): AgreementDocument {
  const body = documentBody(source);
  // The same terms the document prints: the org's today for the current draft, only the frozen ones for a sent version.
  const values = agreementTemplateValues(source.editable ? settings : source.terms, source.term.months, {
    tenant: settings.legalName,
    customer: source.customer.name,
    site: source.site.name,
    tenantAddress: settings.address,
    tenantPhone: settings.phone,
    termStart: source.term.start,
  });
  const { intro, footer, sections, doc, layout } = renderAgreementLayout(template, values);
  const included = sectionOptions(layout, "included") as IncludedOptions | undefined;
  return {
    tenant: { name: settings.legalName, address: settings.address, phone: settings.phone, accent: settings.accentColor ?? NEUTRAL_ACCENT },
    words: itemWords(settings.itemSingular, settings.itemPlural),
    number: source.number,
    versionNo: source.shown.versionNo,
    customerName: source.customer.name,
    siteName: source.site.name,
    mark: source.editable ? DRAFT_MARK : null,
    ...body,
    schedule: sections.schedule ? body.schedule : [],
    scope: sections.scope ? body.scope : { kind: "hidden" },
    validity: source.validUntil ? `Valid until ${formatTermDate(source.validUntil)}` : null,
    // The current draft prints the org's terms as they stand; a frozen version only what it was sent with, never the
    // settings of today (customer-portal AC 32, 33).
    terms: source.editable ? termsOf(settings, source.term.months) : source.terms ? termsOf(source.terms, source.term.months) : [],
    intro,
    footer,
    sections,
    layout,
    doc,
    ...(included?.showFrequency ? { frequencies: typeFrequencies(source.shown.lines, body.scope.kind === "listed" ? body.scope.types : []) } : {}),
  };
}
