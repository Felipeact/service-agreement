import { cents, sumCents } from "../money";

/** One service line as the comparison reads it: its equipment as type codes, so the domain needs no port types. */
export type DiffLine = {
  position: number;
  description: string;
  visitsPerYear: number;
  costPerVisitCents: number;
  annualCents: number;
  visitMonths: readonly number[];
  equipment: readonly string[];
};

export type DiffField = "description" | "costPerVisitCents" | "visitsPerYear" | "visitMonths" | "equipment";

export type FieldChange = { field: DiffField; from: DiffLine[DiffField]; to: DiffLine[DiffField] };

export type LineDiff =
  | { kind: "added"; position: number; line: DiffLine }
  | { kind: "removed"; position: number; line: DiffLine }
  | { kind: "changed"; position: number; before: DiffLine; after: DiffLine; changes: FieldChange[] };

export type VersionDiff = { lines: LineDiff[]; totalFromCents: number; totalToCents: number; deltaCents: number };

const FIELDS: DiffField[] = ["description", "costPerVisitCents", "visitsPerYear", "visitMonths", "equipment"];

const same = (a: DiffLine[DiffField], b: DiffLine[DiffField]) =>
  typeof a === "string" || typeof a === "number" ? a === b : [...a].sort().join() === [...(b as readonly (string | number)[])].sort().join();

/**
 * What changed from version `from` to version `to` (versioning door 2). Lines are matched by position, since a revision
 * copies them and a line has no other id that survives (assumption A1). Months and equipment compare as sets.
 */
export function diffVersions(from: readonly DiffLine[], to: readonly DiffLine[]): VersionDiff {
  const before = new Map(from.map((line) => [line.position, line]));
  const after = new Map(to.map((line) => [line.position, line]));
  const positions = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a - b);

  const lines: LineDiff[] = [];
  for (const position of positions) {
    const was = before.get(position);
    const now = after.get(position);
    if (was && !now) lines.push({ kind: "removed", position, line: was });
    else if (now && !was) lines.push({ kind: "added", position, line: now });
    else if (was && now) {
      const changes = FIELDS.filter((field) => !same(was[field], now[field])).map((field) => ({ field, from: was[field], to: now[field] }));
      if (changes.length > 0) lines.push({ kind: "changed", position, before: was, after: now, changes });
    }
  }

  const totalFromCents = sumCents(from.map((line) => cents(line.annualCents)));
  const totalToCents = sumCents(to.map((line) => cents(line.annualCents)));
  return { lines, totalFromCents, totalToCents, deltaCents: totalToCents - totalFromCents };
}
