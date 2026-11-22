import type { AgreementListRow } from "@/application/ports";
import { statusLabel, type AgreementFilter } from "@/domain/agreement";
import { toCsv, type CsvColumn } from "@/domain/reports";

const COLUMNS: CsvColumn[] = [
  { header: "Agreement" },
  { header: "Version" },
  { header: "Customer" },
  { header: "Site" },
  { header: "Status" },
  { header: "Annual value", kind: "money" },
  { header: "Term end" },
  { header: "Last changed" },
];

/** The Agreements list as a CSV file: one row per agreement the page shows, with the same filters applied. */
export function agreementsCsv(rows: readonly AgreementListRow[], filter: AgreementFilter, day: string): { filename: string; csv: string } {
  const scope = [filter.status, filter.expiring ? "expiring" : null].filter(Boolean).join("-");
  return {
    filename: `agreements${scope ? `-${scope}` : ""}-${day}.csv`,
    csv: toCsv(
      COLUMNS,
      rows.map((row) => [row.number ?? "Draft", String(row.versionNo), row.customer, row.site, statusLabel(row.status), row.annualCents, row.termEnd, row.updatedAt.slice(0, 10)]),
    ),
  };
}
