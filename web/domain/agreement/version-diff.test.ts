import { describe, expect, test } from "vitest";
import { diffVersions, type DiffLine } from "./version-diff";

const line = (position: number, over: Partial<DiffLine> = {}): DiffLine => ({
  position,
  description: "Preventive maintenance visit",
  visitsPerYear: 4,
  costPerVisitCents: 12500,
  annualCents: 50000,
  visitMonths: [3, 6, 9, 12],
  equipment: ["RTU"],
  ...over,
});

describe("diffVersions", () => {
  test("C1334: a position only in the later version is added, only in the earlier is removed", () => {
    const diff = diffVersions([line(0), line(1, { description: "Filters" })], [line(0), line(2, { description: "Boiler" })]);
    expect(diff.lines).toEqual([
      { kind: "removed", position: 1, line: line(1, { description: "Filters" }) },
      { kind: "added", position: 2, line: line(2, { description: "Boiler" }) },
    ]);
  });

  test.each<[string, Partial<DiffLine>, string]>([
    ["description", { description: "HVAC" }, "description"],
    ["price per visit", { costPerVisitCents: 13000, annualCents: 52000 }, "costPerVisitCents"],
    ["visits per year", { visitsPerYear: 2, visitMonths: [3, 6], annualCents: 25000 }, "visitsPerYear"],
    ["visit months", { visitMonths: [1, 5, 9, 11] }, "visitMonths"],
    ["equipment", { equipment: ["AHU"] }, "equipment"],
  ])("C1334: a different %s is changed and lists that field with old and new", (_, over, field) => {
    const before = line(0);
    const after = line(0, over);
    const diff = diffVersions([before], [after]);
    expect(diff.lines).toHaveLength(1);
    const [entry] = diff.lines;
    expect(entry?.kind).toBe("changed");
    if (entry?.kind !== "changed") return;
    expect(entry.changes.map((c) => c.field)).toContain(field);
    const change = entry.changes.find((c) => c.field === field);
    expect(change).toEqual({ field, from: before[field as keyof DiffLine], to: after[field as keyof DiffLine] });
  });

  test("C1334: a change to one field lists only that field", () => {
    const diff = diffVersions([line(0)], [line(0, { description: "HVAC" })]);
    expect(diff.lines).toEqual([
      { kind: "changed", position: 0, before: line(0), after: line(0, { description: "HVAC" }), changes: [{ field: "description", from: "Preventive maintenance visit", to: "HVAC" }] },
    ]);
  });

  test("C1335: the same equipment or months in another order is not a change", () => {
    const before = line(0, { equipment: ["AHU", "RTU"], visitMonths: [3, 6, 9, 12] });
    const after = line(0, { equipment: ["RTU", "AHU"], visitMonths: [12, 9, 6, 3] });
    expect(diffVersions([before], [after]).lines).toEqual([]);
  });

  test("C1336: the totals and their signed change are cents-exact", () => {
    const from = [line(0, { annualCents: 50000 }), line(1, { description: "Filters", visitsPerYear: 2, costPerVisitCents: 30000, annualCents: 60000, visitMonths: [4, 10] })];
    const to = [line(0, { costPerVisitCents: 13000, annualCents: 52000 })];
    const diff = diffVersions(from, to);
    expect(diff.totalFromCents).toBe(110000);
    expect(diff.totalToCents).toBe(52000);
    expect(diff.deltaCents).toBe(-58000);
  });

  test("C1337: identical lines have no entries and no change in total", () => {
    const diff = diffVersions([line(0), line(1, { description: "Filters" })], [line(0), line(1, { description: "Filters" })]);
    expect(diff).toEqual({ lines: [], totalFromCents: 100000, totalToCents: 100000, deltaCents: 0 });
  });
});
