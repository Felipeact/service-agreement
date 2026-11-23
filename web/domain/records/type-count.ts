/** A unit of one equipment type on a site, as the count editor reads it. */
export type CountUnit = { id: string; unitNo: string | null; typeModel: string | null; location: string | null };

export const MAX_TYPE_COUNT = 500;

/** What setting a type's count and location does to the site's units. */
export type CountPlan =
  | { ok: true; create: number; deactivate: string[]; relocate: string[]; location: string | null }
  | { ok: false; code: "invalid" }
  | { ok: false; code: "tagged"; tagged: number };

const blank = (value: string | null) => (value ?? "").trim() === "";

/**
 * Sets how many active units of a type a site has, and their location, the way the agreement page edits equipment (owner,
 * 2026-11-23): a higher count adds blank units at the location; a lower one takes off units that carry no unit number and no
 * model, newest first, and refuses (`tagged`) when too few such units exist, since a tagged unit is removed on the site page; a
 * count of 0 takes every unit off. A location given is set on every remaining unit that does not already have it; `null` leaves
 * locations alone. Units are never deleted: they are made inactive.
 */
export function planTypeCount(units: readonly CountUnit[], count: number, location: string | null): CountPlan {
  if (!Number.isInteger(count) || count < 0 || count > MAX_TYPE_COUNT) return { ok: false, code: "invalid" };
  const where = location === null ? null : location.trim().slice(0, 200) || null;

  let deactivate: string[] = [];
  if (count === 0) {
    deactivate = units.map((unit) => unit.id);
  } else if (count < units.length) {
    const removable = units.filter((unit) => blank(unit.unitNo) && blank(unit.typeModel)).reverse();
    const needed = units.length - count;
    if (removable.length < needed) return { ok: false, code: "tagged", tagged: units.length - removable.length };
    deactivate = removable.slice(0, needed).map((unit) => unit.id);
  }

  const staying = units.filter((unit) => !deactivate.includes(unit.id));
  const relocate = location === null ? [] : staying.filter((unit) => (unit.location ?? "").trim() !== (where ?? "")).map((unit) => unit.id);
  return { ok: true, create: Math.max(0, count - units.length), deactivate, relocate, location: where };
}

/** The location the units of a type share, or the empty string when they have none or differ. */
export function sharedLocation(units: readonly CountUnit[]): string {
  const locations = new Set(units.map((unit) => (unit.location ?? "").trim()));
  return locations.size === 1 ? [...locations][0] : "";
}
