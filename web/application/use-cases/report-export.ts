import type { ReportReader, ReportResult } from "@/application/ports";
import { toCsv, type CsvCell, type CsvColumn, type ReportAccess, type ReportKey, type ReportRange } from "@/domain/reports";

export type ReportCsv = { filename: string; csv: string };

const text = (header: string): CsvColumn => ({ header });
const money = (header: string): CsvColumn => ({ header, kind: "money" });

/** Keeps the money column only for a member who may see money, so an estimator's file holds none (reporting AC 14). */
function build(access: ReportAccess, columns: CsvColumn[], rows: CsvCell[][], moneyAt: number | null): { columns: CsvColumn[]; rows: CsvCell[][] } {
  if (moneyAt === null || access === "money") return { columns, rows };
  return { columns: columns.filter((_, i) => i !== moneyAt), rows: rows.map((row) => row.filter((_, i) => i !== moneyAt)) };
}

const map = <T, R>(result: ReportResult<T>, to: (value: T) => R): ReportResult<R> => (result.ok ? { ok: true, value: to(result.value) } : result);

/**
 * One report as a CSV file (reporting door 3 and 4): the same reader the page uses, so a figure on screen and in the file cannot differ.
 * The caller has already checked that `access` may see this report; the database refuses a money report to anyone else regardless.
 */
export function makeReportExport(reader: ReportReader) {
  return async function exportReport(key: ReportKey, range: ReportRange, access: ReportAccess): Promise<ReportResult<ReportCsv>> {
    const file = (table: { columns: CsvColumn[]; rows: CsvCell[][] }): ReportCsv => ({
      filename: `reports-${key.replace("_", "-")}-${range.from}-${range.to}.csv`,
      csv: toCsv(table.columns, table.rows),
    });
    switch (key) {
      case "funnel": {
        const result = await reader.funnel(range);
        return map(result, (rows) => file(build(access, [text("Stage"), text("Agreements"), money("Value")], rows.map((r) => [r.stage, r.n, r.valueCents]), 2)));
      }
      case "aging": {
        const result = await reader.aging(range);
        return map(result, (aging) =>
          file({
            columns: [text("Section"), text("Item"), text("Customer"), text("Site"), text("Status"), text("Days")],
            rows: [
              ...aging.medians.map((m): CsvCell[] => ["Median", m.stage, null, null, null, m.days === null ? null : m.days.toFixed(1)]),
              ...aging.stuck.map((s): CsvCell[] => ["Stuck", s.number, s.customer, s.site, s.status, String(s.ageDays)]),
            ],
          }),
        );
      }
      case "losses": {
        const result = await reader.losses(range);
        return map(result, (rows) =>
          file(build(access, [text("Agreement"), text("Customer"), text("Site"), text("Outcome"), text("Reason"), text("Date"), money("Value")], rows.map((r) => [r.number, r.customer, r.site, r.outcome, r.reason, r.occurred, r.valueCents]), 6)),
        );
      }
      case "renewals": {
        const result = await reader.renewals();
        return map(result, (rows) =>
          file(
            build(
              access,
              [text("Agreement"), text("Customer"), text("Site"), text("Term ends"), text("Days left"), text("Within days"), text("Renewal"), money("Value")],
              rows.map((r) => [r.number, r.customer, r.site, r.termEnd, String(r.daysLeft), String(r.bucket), r.kind === "auto" ? "Auto" : "Needs negotiation", r.valueCents]),
              7,
            ),
          ),
        );
      }
      case "revenue_customer": {
        const result = await reader.revenueByCustomer();
        return map(result, (rows) => file({ columns: [text("Customer"), text("Agreements"), money("Value")], rows: rows.map((r) => [r.customer, r.agreements, r.valueCents]) }));
      }
      case "revenue_type": {
        const result = await reader.revenueByType();
        return map(result, (rows) => file({ columns: [text("Type"), money("Value")], rows: rows.map((r) => [r.type, r.valueCents]) }));
      }
    }
  };
}
