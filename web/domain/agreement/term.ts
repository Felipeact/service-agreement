import { MONTH_SHORT } from "./cadence";

/**
 * A version's term (term-dates door 1): its start date, its length in months, and the end the database derives from
 * them. Dates are calendar dates as `YYYY-MM-DD`; a missing start leaves both dates `null`.
 */
export type AgreementTerm = { start: string | null; months: number; end: string | null };

export const MIN_TERM_MONTHS = 1;
export const MAX_TERM_MONTHS = 60;

/** The term form as submitted. */
export type AgreementTermInput = { start: string; months: string };

export type AgreementTermValidation =
  | { ok: true; value: { start: string; months: number } }
  | { ok: false; errors: Partial<Record<keyof AgreementTermInput, string>> };

export const TERM_MONTHS_ERROR = `Term must be a whole number of months from ${MIN_TERM_MONTHS} to ${MAX_TERM_MONTHS}`;
export const TERM_START_ERROR = "Enter a start date between 2000 and 2099";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const daysIn = (year: number, month: number) =>
  month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

/** A real calendar date `YYYY-MM-DD` from 2000 to 2099, the database's bound on `term_start`. */
function isTermStart(text: string): boolean {
  const match = ISO_DATE.exec(text);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  return year >= 2000 && year <= 2099 && month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);
}

/** Checks the term form on the server; the database's checks back the same bounds (term-dates AC 10). */
export function validateAgreementTerm(input: AgreementTermInput): AgreementTermValidation {
  const errors: Partial<Record<keyof AgreementTermInput, string>> = {};
  const start = input.start.trim();
  const months = input.months.trim();
  if (!isTermStart(start)) errors.start = TERM_START_ERROR;
  if (!/^\d+$/.test(months) || Number(months) < MIN_TERM_MONTHS || Number(months) > MAX_TERM_MONTHS) errors.months = TERM_MONTHS_ERROR;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { start, months: Number(months) } };
}

/**
 * `2027-01-01` as `Jan 1, 2027`, the same on every page and PDF. Read from the text itself, never through a clock or a
 * time zone, so no reader's zone moves it a day (term-dates AC 14).
 */
export function formatTermDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTH_SHORT[month - 1]} ${day}, ${year}`;
}

export const termMonthsLabel = (months: number) => `${months} ${months === 1 ? "month" : "months"}`;

/**
 * The term as the PDF and the customer page print it (term-dates AC 18, 19). The current draft may not have a start
 * yet; a frozen version without one was sent before terms existed.
 */
export function termLine(term: AgreementTerm, editable: boolean): string {
  if (term.start !== null && term.end !== null) {
    return `Term: ${formatTermDate(term.start)} – ${formatTermDate(term.end)} (${termMonthsLabel(term.months)})`;
  }
  return editable ? `Term: start date to be set (${termMonthsLabel(term.months)})` : "Term: not recorded for this version";
}
