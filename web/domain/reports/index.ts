/** Who sees which reports (decision 17): owner and admin see money, an estimator the operational reports, a viewer none. */
export type ReportAccess = "money" | "operational" | "none";

export function reportAccess(role: string): ReportAccess {
  if (role === "owner" || role === "admin") return "money";
  return role === "estimator" ? "operational" : "none";
}

/** The reports the export route serves (reporting door 4). The last two carry money. */
export const REPORT_KEYS = ["funnel", "aging", "losses", "renewals", "revenue_customer", "revenue_type"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];
export const MONEY_REPORT_KEYS: readonly ReportKey[] = ["revenue_customer", "revenue_type"];

export const isReportKey = (value: string): value is ReportKey => (REPORT_KEYS as readonly string[]).includes(value);

/** Calendar dates `YYYY-MM-DD`, America/Vancouver (door 2). */
export type ReportRange = { from: string; to: string };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The 12 months ending on `today`: the same date a year earlier plus one day, so a leap day still lands on a real date. */
function defaultRange(today: string): ReportRange {
  const [year, month, day] = today.split("-").map(Number);
  const from = new Date(Date.UTC(year - 1, month - 1, day));
  if (from.getUTCMonth() !== month - 1) from.setUTCDate(0);
  from.setUTCDate(from.getUTCDate() + 1);
  return { from: from.toISOString().slice(0, 10), to: today };
}

type RangeParams = { from?: string | string[]; to?: string | string[] };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const INVALID = "That date range was not valid, so the default range is shown.";

/** The range a request asks for (AC 18). Anything given that is not a date, or a start after the end, gives the default and a notice. */
export function parseReportRange(params: RangeParams, today: string): { range: ReportRange; notice: string | null } {
  const fallback = defaultRange(today);
  const from = first(params.from);
  const to = first(params.to);
  if (from === undefined && to === undefined) return { range: fallback, notice: null };
  if ((from !== undefined && !isIsoDate(from)) || (to !== undefined && !isIsoDate(to))) return { range: fallback, notice: INVALID };
  const range = { from: from ?? fallback.from, to: to ?? today };
  return range.from > range.to ? { range: fallback, notice: INVALID } : { range, notice: null };
}

/** Accepted over every decision made (AC 3, 4). */
export function winRate(counts: { accepted: number; refused: number; expired: number }): string {
  const decided = counts.accepted + counts.refused + counts.expired;
  return decided === 0 ? "No decisions yet" : `${Math.round((100 * counts.accepted) / decided)}%`;
}

export function signLabel(averageDays: number | null): string {
  if (averageDays === null) return "No signed contracts yet";
  return `${averageDays.toFixed(1)} ${averageDays === 1 ? "day" : "days"}`;
}

/** Per stage, the percentage lost against the stage before; the first stage and any stage after an empty one is 0 (AC 6, 9). */
export function dropOff(counts: readonly number[]): number[] {
  return counts.map((n, i) => {
    const previous = counts[i - 1];
    if (previous === undefined || previous === 0) return 0;
    return Math.max(0, Math.round((100 * (previous - n)) / previous));
  });
}

export type CsvColumn = { header: string; kind?: "text" | "money" };
export type CsvCell = string | number | null;

const dollars = (cents: number) => `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;

function csvCell(column: CsvColumn, cell: CsvCell): string {
  if (cell === null) return "";
  // Money is a number we formatted; only text a person typed can hold a spreadsheet formula (AC 15).
  const text = column.kind === "money" ? dollars(Number(cell)) : /^[=+\-@]/.test(String(cell)) ? `'${cell}` : String(cell);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 CSV with CRLF line ends: a header row, then one row per table row (AC 15). */
export function toCsv(columns: readonly CsvColumn[], rows: readonly (readonly CsvCell[])[]): string {
  const header = columns.map((c) => csvCell({ header: c.header }, c.header)).join(",");
  return [header, ...rows.map((row) => columns.map((c, i) => csvCell(c, row[i] ?? null)).join(","))].join("\r\n") + "\r\n";
}

// Rows as the report functions return them (reporting door 1). A `valueCents` of null means the member may not see money.
export type Headline = { recurringCents: number; pipelineCents: number; accepted: number; refused: number; expired: number; signed: number; avgDaysToSign: number | null };
export const FUNNEL_STAGES = ["created", "sent", "accepted", "signed"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];
export type FunnelRow = { stage: FunnelStage; n: number; valueCents: number | null };
export type StageMedian = { stage: string; days: number | null };
export type StuckAgreement = { agreementId: string; number: string; customer: string; site: string; status: string; ageDays: number };
export type Aging = { medians: StageMedian[]; stuck: StuckAgreement[] };
export type LossRow = { agreementId: string; number: string; customer: string; site: string; outcome: "refused" | "expired" | "withdrawn"; reason: string | null; occurred: string; valueCents: number | null };
export type RenewalRow = { agreementId: string; number: string; customer: string; site: string; termEnd: string; daysLeft: number; bucket: 30 | 60 | 90; kind: "auto" | "negotiate"; valueCents: number | null };
export type CustomerRevenue = { customerId: string; customer: string; agreements: number; valueCents: number };
export type TypeRevenue = { type: string; valueCents: number };
