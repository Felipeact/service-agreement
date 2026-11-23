import type { ServiceLineValue } from "./index";

/** An equipment type on the site that a line can cover, with the months it is normally serviced. */
export type DraftableType = { id: string; name: string; defaultVisitMonths: readonly number[] };

/** Spring and fall: the months used when a type's catalog entry names none, so a line always has a valid schedule. */
export const FALLBACK_VISIT_MONTHS: readonly number[] = [4, 10];

/** The description of a generated line; the contractor can edit it like any other. */
export const draftDescription = (typeName: string): string => `${typeName} preventive maintenance`.slice(0, 200);

/**
 * One service line per equipment type the site has and no line covers yet: the type's best months from the catalog, that
 * type as the line's scope, and no price (the contractor prices it). Types a line already covers are left alone, so running it
 * twice adds nothing.
 */
export function draftServiceLines(types: readonly DraftableType[], coveredTypeIds: Iterable<string>): ServiceLineValue[] {
  const covered = new Set(coveredTypeIds);
  return [...types]
    .filter((type) => !covered.has(type.id))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }))
    .map((type) => {
      const months = [...new Set(type.defaultVisitMonths.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))].sort((a, b) => a - b);
      return {
        description: draftDescription(type.name),
        visitMonths: months.length > 0 ? months : [...FALLBACK_VISIT_MONTHS],
        costPerVisitCents: 0,
        assetTypeIds: [type.id],
      };
    });
}
