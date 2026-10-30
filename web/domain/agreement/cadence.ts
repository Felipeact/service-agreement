/** Visit months: the calendar months (1 = January) a service line's visits fall in (cadence door 1). */

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

/** Months as three-letter names in calendar order, whatever order they come in: `[12, 1]` -> `Jan, Dec`. */
export function monthsLabel(months: readonly number[]): string {
  return ascending(months)
    .map((month) => MONTH_SHORT[month - 1])
    .join(", ");
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

/** One month of the visit schedule: the names of the equipment visited in it, once each, by name. */
export type ScheduleRow = { month: number; equipment: string[] };

const byName = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

/** One row per month with at least one visit, January to December (cadence AC 18). */
export function visitSchedule(lines: readonly { visitMonths: readonly number[]; equipment: readonly { name: string }[] }[]): ScheduleRow[] {
  const months = new Map<number, Set<string>>();
  for (const line of lines) {
    for (const month of line.visitMonths) {
      const names = months.get(month) ?? new Set<string>();
      for (const type of line.equipment) names.add(type.name);
      months.set(month, names);
    }
  }
  return ascending(months.keys()).map((month) => ({ month, equipment: [...(months.get(month) ?? [])].sort(byName) }));
}
