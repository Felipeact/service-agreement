/** Visit months: the calendar months (1 = January) a service line's visits fall in (cadence door 1). */

import type { ScopeTask, ScopeType } from "./index";

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** The grid's preset buttons, by the months each one checks (cadence AC 4). */
export const MONTH_PRESETS = {
  quarterly: [3, 6, 9, 12],
  semiAnnual: [4, 10],
  monthly: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
} as const satisfies Record<string, readonly number[]>;

export type MonthPreset = keyof typeof MONTH_PRESETS;

export const PRESET_LABELS: Record<MonthPreset, string> = { quarterly: "Quarterly", semiAnnual: "Semi-annual", monthly: "Monthly" };

const ascending = (months: Iterable<number>) => [...new Set(months)].sort((a, b) => a - b);

/** Door 1's rule: a non-empty list of whole months 1-12, strictly ascending. */
export function isVisitMonths(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((month, i) => Number.isInteger(month) && month >= 1 && month <= 12 && (i === 0 || month > value[i - 1]))
  );
}

/** Months as three-letter names in calendar order, whatever order they come in: `[12, 1]` -> `Jan, Dec`. */
export function monthsLabel(months: readonly number[]): string {
  return ascending(months)
    .map((month) => MONTH_SHORT[month - 1])
    .join(", ");
}

/**
 * Months as runs of consecutive months, December followed by January, starting after the largest gap (the earliest run
 * on a tie): a run of three or more reads `Apr–Sep`, shorter ones by name. `[1, 2, 3, 10, 11, 12]` -> `Oct–Mar`
 * (seasonal-tasks AC 12).
 */
export function monthRunsLabel(months: readonly number[]): string {
  const set = new Set(months);
  const sorted = ascending(set);
  if (sorted.length === 12) return `${MONTH_SHORT[0]}–${MONTH_SHORT[11]}`;
  const next = (month: number) => (month % 12) + 1;
  const previous = (month: number) => ((month + 10) % 12) + 1;
  const runs = sorted
    .filter((month) => !set.has(previous(month)))
    .map((start) => {
      const run = [start];
      while (set.has(next(run[run.length - 1]))) run.push(next(run[run.length - 1]));
      return run;
    });
  const gapBefore = (i: number) => (runs[i][0] - runs[(i + runs.length - 1) % runs.length].at(-1)! + 11) % 12;
  let first = 0;
  runs.forEach((_, i) => {
    if (gapBefore(i) > gapBefore(first)) first = i;
  });
  return [...runs.slice(first), ...runs.slice(0, first)]
    .map((run) => (run.length >= 3 ? `${MONTH_SHORT[run[0] - 1]}–${MONTH_SHORT[run[run.length - 1] - 1]}` : run.map((month) => MONTH_SHORT[month - 1]).join(", ")))
    .join(", ");
}

/** A task that applies at some visits only: it has months, and not all twelve (seasonal-tasks AC 13). */
export function isSeasonal(task: ScopeTask): task is { description: string; visitMonths: number[] } {
  return task.visitMonths !== null && task.visitMonths.length < 12;
}

/** The checklist text of a task: `Check belts (Apr–Sep visits)`, or the description alone (seasonal-tasks AC 11). */
export function taskLabel(task: ScopeTask): string {
  return isSeasonal(task) ? `${task.description} (${monthRunsLabel(task.visitMonths)} visits)` : task.description;
}

/** What the schedule and the unreached rule read of a line: its months and the types it covers, by code. */
export type ScheduleLine = { visitMonths: readonly number[]; equipment: readonly { code?: string; name: string }[] };

const visitsIn = (lines: readonly ScheduleLine[], code: string, month: number) =>
  lines.some((line) => line.visitMonths.includes(month) && line.equipment.some((type) => type.code === code));

/** A seasonal task none of whose months is a visit of a line covering its type (seasonal-tasks AC 14). */
export function isUnreached(task: ScopeTask, typeCode: string, lines: readonly ScheduleLine[]): boolean {
  return isSeasonal(task) && !task.visitMonths.some((month) => visitsIn(lines, typeCode, month));
}

/** An equipment type a line can cover, with the months a new line prefills from it (cadence door 3). */
export type EquipmentChoice = { id: string; code: string; name: string; defaultVisitMonths: number[] };

/**
 * The months the grid shows after the checked types change: the union of their defaults, or nothing when none is
 * checked. Once the grid was changed by hand, the current months stay (cadence AC 10).
 */
export function prefillMonths(input: {
  choices: readonly Pick<EquipmentChoice, "id" | "defaultVisitMonths">[];
  checked: readonly string[];
  current: readonly number[];
  edited: boolean;
}): number[] {
  if (input.edited) return [...input.current];
  const checked = new Set(input.checked);
  return ascending(input.choices.filter((choice) => checked.has(choice.id)).flatMap((choice) => choice.defaultVisitMonths));
}

/** A seasonal task due on a month's visit, with the name of its equipment type. */
export type ScheduleTask = { type: string; description: string };

/**
 * One month of the visit schedule: the names of the equipment visited in it, once each, by name, and the seasonal tasks
 * due that month (seasonal-tasks AC 15).
 */
export type ScheduleRow = { month: number; equipment: string[]; tasks: ScheduleTask[] };

const byName = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

/**
 * One row per month with at least one visit, January to December (cadence AC 18). A seasonal task of the scope is due
 * in a month that is one of its months and a visit of a line covering its type, by type name and then position.
 */
export function visitSchedule(lines: readonly ScheduleLine[], types: readonly ScopeType[] = []): ScheduleRow[] {
  const months = new Map<number, Set<string>>();
  for (const line of lines) {
    for (const month of line.visitMonths) {
      const names = months.get(month) ?? new Set<string>();
      for (const type of line.equipment) names.add(type.name);
      months.set(month, names);
    }
  }
  const byTypeName = [...types].sort((a, b) => byName(a.name, b.name));
  const due = (month: number) =>
    byTypeName.flatMap((type) =>
      visitsIn(lines, type.code, month)
        ? type.tasks.filter((task) => isSeasonal(task) && task.visitMonths.includes(month)).map((task) => ({ type: type.name, description: task.description }))
        : [],
    );
  return ascending(months.keys()).map((month) => ({ month, equipment: [...(months.get(month) ?? [])].sort(byName), tasks: due(month) }));
}
