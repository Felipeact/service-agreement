/** A unit as the scope records it. */
export type ScopeUnit = { unitNo: string | null; typeModel: string | null; location: string | null };

/** One distinct description of units of a type, with how many units share it. */
export type UnitDetail = { label: string; count: number };

/** A unit number that is only a sequence number ("27", "#4"), which tells a customer nothing. */
export const isBareNumber = (unitNo: string | null): boolean => unitNo === null || /^\s*#?\s*\d+\s*$/.test(unitNo);

/**
 * What a customer can read about a unit: its tag when it is more than a sequence number ("RTU-3"), its model and its location,
 * joined by " · ". Empty when the unit has none of them.
 */
export function unitLabel(unit: ScopeUnit): string {
  return [isBareNumber(unit.unitNo) ? null : unit.unitNo?.trim(), unit.typeModel?.trim(), unit.location?.trim()].filter((part) => part).join(" · ");
}

/**
 * The units of a type as a customer reads them: one row per distinct label with how many units share it, in the order they
 * first appear. Units with nothing to say are only counted (by the caller), so 40 dampers numbered 1 to 40 print as a count,
 * not 40 rows of numbers, and 18 fan coils on "floors 2-3" print as one row.
 */
export function unitDetails(units: readonly ScopeUnit[]): UnitDetail[] {
  const details = new Map<string, number>();
  for (const unit of units) {
    const label = unitLabel(unit);
    if (label) details.set(label, (details.get(label) ?? 0) + 1);
  }
  return [...details].map(([label, count]) => ({ label, count }));
}

/** "40 units" */
export const unitCount = (count: number): string => `${count} ${count === 1 ? "unit" : "units"}`;

/** A detail row's text: the label, with the count when several units share it ("floors 2-3 · 18 units"). */
export const detailText = (detail: UnitDetail): string => (detail.count > 1 ? `${detail.label} · ${unitCount(detail.count)}` : detail.label);

/** How staff name a unit in lists where every unit is a row: its label, else "Unit 27", else "No unit #". */
export function staffUnitLabel(unit: ScopeUnit): string {
  const number = unit.unitNo?.trim();
  const rest = [unit.typeModel?.trim(), unit.location?.trim()].filter((part) => part);
  const head = number ? (isBareNumber(number) ? `Unit ${number.replace(/^#\s*/, "")}` : number) : "No unit #";
  return [head, ...rest].join(" · ");
}
