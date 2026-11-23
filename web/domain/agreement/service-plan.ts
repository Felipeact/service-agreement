import type { ServiceLineValue } from "./index";

/**
 * The standard service plan: how often each kind of equipment is maintained, how long one unit takes per visit, and what a
 * visit costs at the shop rate. Equipment of the same frequency shares one line, so an agreement reads as a handful of
 * visit plans (monthly, quarterly, semi-annual, annual) instead of one line per type.
 */

export type Frequency = "monthly" | "quarterly" | "semi_annual" | "annual";

/** The months each frequency visits in. Annual work is in October (before the heating season) unless a type says otherwise. */
export const FREQUENCY_MONTHS: Record<Frequency, readonly number[]> = {
  monthly: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  quarterly: [3, 6, 9, 12],
  semi_annual: [4, 10],
  annual: [10],
};

/** How one equipment type is maintained: its frequency and the minutes one unit takes on a visit. */
export type TypeRecipe = { frequency: Frequency; minutesPerUnit: number; months?: readonly number[] };

/**
 * Commercial practice by catalog code for the seeded trade pack. Heat-rejection plant (chillers, cooling towers) is checked monthly; air-moving and
 * refrigeration equipment with filters and coils quarterly; fans, pumps and hydronic accessories twice a year; heating-only and
 * life-safety items once a year, before the heating season. Minutes are on-site labour per unit per visit.
 */
export const TYPE_RECIPES: Readonly<Record<string, TypeRecipe>> = {
  CHILLER: { frequency: "monthly", minutesPerUnit: 90 },
  COOLING_TOWER: { frequency: "monthly", minutesPerUnit: 60 },

  RTU: { frequency: "quarterly", minutesPerUnit: 60 },
  MUA: { frequency: "quarterly", minutesPerUnit: 75 },
  AHU: { frequency: "quarterly", minutesPerUnit: 75 },
  ERV: { frequency: "quarterly", minutesPerUnit: 45 },
  HRV: { frequency: "quarterly", minutesPerUnit: 45 },
  FAN_COIL: { frequency: "quarterly", minutesPerUnit: 20 },
  WSHP: { frequency: "quarterly", minutesPerUnit: 30 },
  PTAC: { frequency: "quarterly", minutesPerUnit: 20 },
  DUCTLESS_SPLIT: { frequency: "quarterly", minutesPerUnit: 30 },
  UNITARY_SPLIT: { frequency: "quarterly", minutesPerUnit: 45 },
  VRF_OUTDOOR: { frequency: "quarterly", minutesPerUnit: 60 },
  MINI_VRF: { frequency: "quarterly", minutesPerUnit: 45 },
  WALK_IN_COOLER: { frequency: "quarterly", minutesPerUnit: 45 },
  WALK_IN_FREEZER: { frequency: "quarterly", minutesPerUnit: 45 },
  CASE_COOLER: { frequency: "quarterly", minutesPerUnit: 30 },
  CASE_FREEZER: { frequency: "quarterly", minutesPerUnit: 30 },
  ICE_MACHINE: { frequency: "quarterly", minutesPerUnit: 45 },

  BOILER: { frequency: "semi_annual", minutesPerUnit: 90 },
  EXHAUST_FAN: { frequency: "semi_annual", minutesPerUnit: 20 },
  SUPPLY_FAN: { frequency: "semi_annual", minutesPerUnit: 30 },
  PUMP: { frequency: "semi_annual", minutesPerUnit: 30 },
  HEAT_EXCHANGER: { frequency: "semi_annual", minutesPerUnit: 45 },
  AIR_SEPARATOR: { frequency: "semi_annual", minutesPerUnit: 15 },
  SIDE_STREAM_FILTER: { frequency: "semi_annual", minutesPerUnit: 20 },
  WYE_STRAINER: { frequency: "semi_annual", minutesPerUnit: 15 },
  CO_SENSOR: { frequency: "semi_annual", minutesPerUnit: 15 },

  FURNACE: { frequency: "annual", minutesPerUnit: 60 },
  UNIT_HEATER_GAS: { frequency: "annual", minutesPerUnit: 30 },
  UNIT_HEATER_ELECTRIC: { frequency: "annual", minutesPerUnit: 20 },
  HWT_HIGH_EFFICIENCY: { frequency: "annual", minutesPerUnit: 45 },
  HWT_MID_EFFICIENCY: { frequency: "annual", minutesPerUnit: 45 },
  STORAGE_TANK: { frequency: "annual", minutesPerUnit: 30 },
  INDIRECT_TANK: { frequency: "annual", minutesPerUnit: 30 },
  EXPANSION_TANK: { frequency: "annual", minutesPerUnit: 15 },
  ACID_NEUTRALIZER: { frequency: "annual", minutesPerUnit: 20 },
  PRESSURE_REGULATING_VALVE: { frequency: "annual", minutesPerUnit: 15 },
  BACKFLOW_PREVENTER: { frequency: "annual", minutesPerUnit: 30 },
  FIRE_DAMPER: { frequency: "annual", minutesPerUnit: 10 },
};

/** Minutes per unit for a type with no recipe (another trade's pack, or a type the contractor added). */
export const DEFAULT_MINUTES_PER_UNIT = 45;

/** The shop rate the suggested price uses, and the least a visit is worth. CAD cents. */
export type PricingRates = { hourlyRateCents: number; minimumVisitCents: number };
export const DEFAULT_RATES: PricingRates = { hourlyRateCents: 13_500, minimumVisitCents: 15_000 };

/** An equipment type on the site: its catalog code, how many units, and the months its catalog entry names. */
export type PlanType = { id: string; code: string; name: string; units: number; defaultVisitMonths: readonly number[] };

/** One planned line: what is saved, plus what the screen explains (frequency, units, labour, the types' codes). */
export type PlannedLine = ServiceLineValue & { frequency: string; units: number; labourMinutes: number; typeCodes: string[] };

const validMonths = (months: readonly number[]) =>
  [...new Set(months.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))].sort((a, b) => a - b);

/** The words for a set of visit months: Monthly, Quarterly, Semi-annual, Annual, or "<n> visits a year". */
export function frequencyLabel(months: readonly number[]): string {
  const key = validMonths(months).join(",");
  if (key === FREQUENCY_MONTHS.monthly.join(",")) return "Monthly";
  if (key === FREQUENCY_MONTHS.quarterly.join(",")) return "Quarterly";
  if (months.length === 2) return "Semi-annual";
  if (months.length === 1) return "Annual";
  return `${months.length} visits a year`;
}

/** A reviewer's judgement for one type, replacing its recipe. */
export type RecipeOverrides = Readonly<Record<string, TypeRecipe>>;

export const FREQUENCIES: readonly Frequency[] = ["monthly", "quarterly", "semi_annual", "annual"];
const MAX_MINUTES_PER_UNIT = 600;

/**
 * The months and minutes a type is planned with: an override when one is given, else its recipe, else its catalog months
 * (spring and fall when it names none).
 */
export function recipeFor(type: Pick<PlanType, "code" | "defaultVisitMonths">, overrides: RecipeOverrides = {}): { months: number[]; minutesPerUnit: number } {
  const recipe = overrides[type.code] ?? TYPE_RECIPES[type.code];
  if (recipe) {
    const minutesPerUnit = Math.min(Math.max(Math.round(recipe.minutesPerUnit), 1), MAX_MINUTES_PER_UNIT);
    return { months: [...(recipe.months ?? FREQUENCY_MONTHS[recipe.frequency])], minutesPerUnit };
  }
  const months = validMonths(type.defaultVisitMonths);
  return { months: months.length > 0 ? months : [...FREQUENCY_MONTHS.semi_annual], minutesPerUnit: DEFAULT_MINUTES_PER_UNIT };
}

/** Labour at the shop rate, never under the visit minimum, rounded up to the next $5. */
export function suggestedCostPerVisit(labourMinutes: number, rates: PricingRates = DEFAULT_RATES): number {
  const labour = Math.max((labourMinutes / 60) * rates.hourlyRateCents, rates.minimumVisitCents);
  return Math.ceil(labour / 500) * 500;
}

/**
 * The standard plan for a site: types with at least one unit, grouped by the months they are visited in, one line per group,
 * most frequent first. Each line's price per visit is the labour of all its units at the shop rate.
 */
export function planServiceLines(types: readonly PlanType[], rates: PricingRates = DEFAULT_RATES, overrides: RecipeOverrides = {}): PlannedLine[] {
  const groups = new Map<string, { months: number[]; types: PlanType[]; minutes: number }>();
  for (const type of types) {
    if (type.units <= 0) continue;
    const { months, minutesPerUnit } = recipeFor(type, overrides);
    const key = months.join(",");
    const group = groups.get(key) ?? { months, types: [], minutes: 0 };
    group.types.push(type);
    group.minutes += type.units * minutesPerUnit;
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.months.length - a.months.length || a.months[0] - b.months[0])
    .map((group) => {
      const label = frequencyLabel(group.months);
      const units = group.types.reduce((sum, type) => sum + type.units, 0);
      const sorted = [...group.types].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
      const visits = group.months.length;
      return {
        description: `${label} preventive maintenance: ${visits} ${visits === 1 ? "visit" : "visits"} a year, ${units} ${units === 1 ? "unit" : "units"}`,
        visitMonths: group.months,
        costPerVisitCents: suggestedCostPerVisit(group.minutes, rates),
        assetTypeIds: sorted.map((type) => type.id),
        typeCodes: sorted.map((type) => type.code),
        frequency: label,
        units,
        labourMinutes: group.minutes,
      };
    });
}
