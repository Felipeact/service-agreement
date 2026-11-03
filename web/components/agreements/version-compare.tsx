import type { ServiceLineView } from "@/application/ports";
import { diffVersions, monthsLabel, type DiffLine, type FieldChange, type LineDiff } from "@/domain/agreement";
import { formatCadExact } from "@/lib/money";

type VersionCompareProps = {
  fromNo: number;
  toNo: number;
  from: ServiceLineView[];
  to: ServiceLineView[];
};

const toDiffLine = (line: ServiceLineView): DiffLine => ({
  position: line.position,
  description: line.description,
  visitsPerYear: line.visitsPerYear,
  costPerVisitCents: line.costPerVisitCents,
  annualCents: line.annualCents,
  visitMonths: line.visitMonths,
  equipment: line.equipment.map((type) => type.code),
});

const FIELD_LABELS: Record<FieldChange["field"], string> = {
  description: "Description",
  costPerVisitCents: "Per visit",
  visitsPerYear: "Visits per year",
  visitMonths: "Visit months",
  equipment: "Equipment",
};

function show(field: FieldChange["field"], value: FieldChange["from"]): string {
  if (field === "costPerVisitCents") return formatCadExact(value as number);
  if (field === "visitMonths") return monthsLabel(value as number[]);
  if (field === "equipment") return (value as string[]).join(", ");
  return String(value);
}

/** One line as a short summary, for an added or removed line. */
const summary = (line: DiffLine) =>
  `${line.visitsPerYear} × ${formatCadExact(line.costPerVisitCents)} · ${monthsLabel(line.visitMonths)} · ${line.equipment.join(", ")} · ${formatCadExact(line.annualCents)} per year`;

function Entry({ entry }: { entry: LineDiff }) {
  if (entry.kind === "changed") {
    return (
      <li data-diff="changed" className="flex flex-col gap-1 px-4 py-3 text-[13px]">
        <p className="font-medium">{entry.after.description}</p>
        <ul className="flex flex-col gap-0.5 text-ink-2">
          {entry.changes.map((change) => (
            <li key={change.field}>
              {FIELD_LABELS[change.field]}: <span className="line-through">{show(change.field, change.from)}</span> → <span className="text-ink">{show(change.field, change.to)}</span>
            </li>
          ))}
        </ul>
      </li>
    );
  }
  return (
    <li data-diff={entry.kind} className="flex flex-col gap-1 px-4 py-3 text-[13px]">
      <p className="font-medium">
        {entry.kind === "added" ? "Added" : "Removed"} · {entry.line.description}
      </p>
      <p className="break-words text-ink-2">{summary(entry.line)}</p>
    </li>
  );
}

/** The signed change in the annual total: `+$130.00`, `−$300.00`, or `$0.00`. */
function signed(deltaCents: number): string {
  if (deltaCents === 0) return formatCadExact(0);
  return `${deltaCents < 0 ? "−" : "+"}${formatCadExact(Math.abs(deltaCents))}`;
}

/** What changed from version `fromNo` to version `toNo`: line by line, then the annual totals (versioning S3). */
export function VersionCompare({ fromNo, toNo, from, to }: VersionCompareProps) {
  const diff = diffVersions(from.map(toDiffLine), to.map(toDiffLine));
  return (
    <section aria-label="Comparison" className="overflow-hidden rounded-panel border border-hairline bg-surface">
      <h2 className="border-b border-hairline bg-ground px-4 py-2 text-[13px] font-semibold">{`Changes from version ${fromNo} to version ${toNo}`}</h2>
      {diff.lines.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-ink-2">No differences</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {diff.lines.map((entry) => (
            <Entry key={entry.position} entry={entry} />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline px-4 py-3 text-[13px]">
        <p>
          Version {fromNo} <span className="font-semibold">{formatCadExact(diff.totalFromCents)}</span> per year
        </p>
        <p>
          Version {toNo} <span className="font-semibold">{formatCadExact(diff.totalToCents)}</span> per year
        </p>
        <p className="font-semibold">Change {signed(diff.deltaCents)}</p>
      </div>
    </section>
  );
}
