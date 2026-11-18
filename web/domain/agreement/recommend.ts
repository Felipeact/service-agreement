import { MAX_SERVICE_LINES } from "./index";

/**
 * Recommended service lines (recommended-lines). From the equipment on a site, propose the priced lines an estimator would
 * usually start from: one line per trade and visit pattern, covering every type of that trade that shares the pattern, with
 * a per-visit price built from typical per-unit rates. Every proposal is a starting point the estimator reviews; nothing here
 * is a rate card or a standard.
 */

export const TRADES = ["hvac", "refrigeration", "plumbing", "electrical", "fire_life_safety", "general"] as const;
export type Trade = (typeof TRADES)[number];

export const TRADE_LABELS: Record<Trade, string> = {
  hvac: "Heating and cooling",
  refrigeration: "Refrigeration",
  plumbing: "Plumbing",
  electrical: "Electrical",
  fire_life_safety: "Fire and life safety",
  general: "General",
};

/** One equipment type on the site, with how many active units of it there are. */
export type SiteEquipmentType = {
  id: string;
  code: string;
  name: string;
  /** The starter pack the type was seeded from (`hvac`, `plumbing`, `electrical`), or `null` for the org's own type. */
  pack: string | null;
  defaultVisitMonths: number[];
  assetCount: number;
};

export type RecommendedLine = {
  trade: Trade;
  description: string;
  visitMonths: number[];
  costPerVisitCents: number;
  assetTypeIds: string[];
  /** The covered types by name, for the summary shown before and after the lines are added. */
  typeNames: string[];
  unitCount: number;
};

/** Typical cost of one unit at one preventive visit, in cents. A type not listed takes its trade's default. */
const AIR_SIDE_RATES: Record<string, number> = {
  CHILLER: 45000,
  COOLING_TOWER: 35000,
  BOILER: 22000,
  AHU: 16000,
  MUA: 14000,
  RTU: 11000,
  VRF_OUTDOOR: 15000,
  MINI_VRF: 12000,
  ERV: 9000,
  HRV: 7500,
  FURNACE: 9000,
  UNITARY_SPLIT: 9500,
  DUCTLESS_SPLIT: 7500,
  WSHP: 7000,
  FAN_COIL: 4500,
  PTAC: 4500,
  EXHAUST_FAN: 3500,
  SUPPLY_FAN: 4500,
  UNIT_HEATER_GAS: 6000,
  UNIT_HEATER_ELECTRIC: 3500,
  FIRE_DAMPER: 2500,
  CO_SENSOR: 2000,
  PUMP: 6000,
  HEAT_EXCHANGER: 9000,
  EXPANSION_TANK: 3500,
  AIR_SEPARATOR: 3000,
  WYE_STRAINER: 2500,
  SIDE_STREAM_FILTER: 4500,
  ACID_NEUTRALIZER: 4500,
  STORAGE_TANK: 5000,
  INDIRECT_TANK: 5000,
  HWT_MID_EFFICIENCY: 9000,
  HWT_HIGH_EFFICIENCY: 9500,
  BACKFLOW_PREVENTER: 9500,
  PRESSURE_REGULATING_VALVE: 4500,
};

const REFRIGERATION_RATES: Record<string, number> = {
  WALK_IN_COOLER: 13000,
  WALK_IN_FREEZER: 14000,
  CASE_COOLER: 6000,
  CASE_FREEZER: 6500,
  ICE_MACHINE: 9500,
};

const PLUMBING_RATES: Record<string, number> = {
  WATER_HEATER_COMMERCIAL: 9000,
  TANKLESS_WATER_HEATER: 8000,
  MIXING_VALVE: 5500,
  RECIRCULATION_PUMP: 5500,
  BOOSTER_PUMP: 9000,
  SUMP_PUMP: 6500,
  SEWAGE_EJECTOR_PUMP: 9500,
  GREASE_INTERCEPTOR: 18000,
  OIL_INTERCEPTOR: 15000,
  FLOOR_DRAIN: 2000,
  BACKWATER_VALVE: 5000,
  ROOF_DRAIN: 2500,
  WATER_SOFTENER: 6000,
  WATER_FILTRATION: 6000,
  DRINKING_FOUNTAIN: 3000,
  EYEWASH_STATION: 4500,
  FLUSH_VALVE: 1500,
};

const ELECTRICAL_RATES: Record<string, number> = {
  SWITCHGEAR: 35000,
  SWITCHBOARD: 25000,
  DISTRIBUTION_PANEL: 9000,
  BRANCH_PANEL: 5000,
  MOTOR_CONTROL_CENTER: 22000,
  DRY_TRANSFORMER: 12000,
  DISCONNECT_SWITCH: 3500,
  VFD: 7500,
  GENERATOR: 28000,
  TRANSFER_SWITCH: 18000,
  UPS: 15000,
  BATTERY_SYSTEM: 9000,
  EMERGENCY_LIGHTING: 1500,
  EXIT_SIGN: 1000,
  LIGHTING_CONTROL_PANEL: 7500,
  SITE_LIGHTING: 2500,
  GFCI_DEVICE: 1500,
  SURGE_PROTECTOR: 4000,
  EV_CHARGER: 6500,
  GROUNDING_SYSTEM: 15000,
};

const UNIT_RATES: Record<string, number> = { ...AIR_SIDE_RATES, ...REFRIGERATION_RATES, ...PLUMBING_RATES, ...ELECTRICAL_RATES };

const TRADE_RATES: Record<Trade, number> = {
  hvac: 9500,
  refrigeration: 8500,
  plumbing: 6500,
  electrical: 7500,
  fire_life_safety: 6000,
  general: 7500,
};

/** A type with no default months visits on its trade's usual pattern. */
const TRADE_MONTHS: Record<Trade, number[]> = {
  hvac: [3, 6, 9, 12],
  refrigeration: [3, 6, 9, 12],
  plumbing: [4, 10],
  electrical: [10],
  fire_life_safety: [10],
  general: [4, 10],
};

/** The least a visit is priced at: a truck still rolls for one small unit. */
export const MINIMUM_VISIT_CENTS = 15000;
const MAX_VISIT_CENTS = 99_999_999;

const REFRIGERATION_CODES = new Set(Object.keys(REFRIGERATION_RATES));
const AIR_SIDE_CODES = new Set(Object.keys(AIR_SIDE_RATES));
const PLUMBING_CODES = new Set(Object.keys(PLUMBING_RATES));
const ELECTRICAL_CODES = new Set(Object.keys(ELECTRICAL_RATES));

/** Words in a type's own name that say its trade, tried in this order (fire before the air-side "damper", a heat pump before plumbing's pump). */
const KEYWORDS: [Trade, RegExp][] = [
  ["fire_life_safety", /\b(fire|sprinkler|alarm|extinguish|smoke|suppression|standpipe)/],
  ["refrigeration", /\b(refrig|cooler|freezer|ice machine|walk-?in|reach-?in|condensing unit|display case|blast chill)/],
  ["hvac", /\b(heat pump|boiler|furnace|chiller|rooftop|air handl|hvac|cooling tower|make-?up air|split system|vrf|thermostat)/],
  ["electrical", /\b(electric|panel|generator|transformer|switch|lighting|light|ups\b|battery|breaker|charger|motor control|surge|ground)/],
  ["plumbing", /\b(plumb|water|drain|pump|valve|backflow|sewage|grease|interceptor|fixture|toilet|faucet|fountain|softener)/],
  ["hvac", /\b(air|heat|fan|vent|duct|damper|cooling|ac\b|a\/c|exhaust|coil)/],
];

/** The trade a type belongs to: its pack first, then the catalog codes, then the words in its own name. */
export function tradeOf(type: Pick<SiteEquipmentType, "code" | "name" | "pack">): Trade {
  if (REFRIGERATION_CODES.has(type.code)) return "refrigeration";
  if (type.pack === "hvac") return "hvac";
  if (type.pack === "plumbing") return "plumbing";
  if (type.pack === "electrical") return "electrical";
  if (AIR_SIDE_CODES.has(type.code)) return "hvac";
  if (PLUMBING_CODES.has(type.code)) return "plumbing";
  if (ELECTRICAL_CODES.has(type.code)) return "electrical";
  const words = `${type.name} ${type.code.replaceAll("_", " ")}`.toLowerCase();
  return KEYWORDS.find(([, pattern]) => pattern.test(words))?.[0] ?? "general";
}

/** Typical cost of one unit of the type at one visit, in cents. */
export function unitRateCents(type: Pick<SiteEquipmentType, "code" | "name" | "pack">): number {
  return UNIT_RATES[type.code] ?? TRADE_RATES[tradeOf(type)];
}

/** How often a pattern visits, in words for a line's description. */
export function cadenceWords(months: readonly number[]): string {
  if (months.length === 12) return "monthly";
  if (months.length === 4) return "quarterly";
  if (months.length === 2) return "semi-annual";
  if (months.length === 1) return "annual";
  return `${months.length} visits a year`;
}

function lineDescription(trade: Trade, months: readonly number[]): string {
  const label = TRADE_LABELS[trade];
  if (months.length === 1) return `${label} annual inspection`;
  return `${label} preventive maintenance, ${cadenceWords(months)}`;
}

const validMonths = (months: readonly number[]) => [...new Set(months.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))].sort((a, b) => a - b);

/** Rounds up to the next $5, so a suggestion reads like a price someone set. */
const roundUp = (amount: number) => Math.ceil(amount / 500) * 500;

/**
 * The lines to propose for the site's types that no line covers yet: grouped by trade, then by visit months, in trade order
 * (heating and cooling first) and by visits per year, most first. Types with no active unit are left out. At most `room` lines, so the
 * version stays within `MAX_SERVICE_LINES`.
 */
export function recommendServiceLines(types: readonly SiteEquipmentType[], options: { coveredTypeIds?: readonly string[]; room?: number } = {}): RecommendedLine[] {
  const covered = new Set(options.coveredTypeIds ?? []);
  const groups = new Map<string, { trade: Trade; months: number[]; types: SiteEquipmentType[] }>();
  for (const type of types) {
    if (type.assetCount < 1 || covered.has(type.id)) continue;
    const trade = tradeOf(type);
    const own = validMonths(type.defaultVisitMonths);
    const months = own.length > 0 ? own : TRADE_MONTHS[trade];
    const key = `${trade}|${months.join(",")}`;
    const group = groups.get(key) ?? { trade, months, types: [] };
    group.types.push(type);
    groups.set(key, group);
  }
  const lines = [...groups.values()]
    .sort((a, b) => TRADES.indexOf(a.trade) - TRADES.indexOf(b.trade) || b.months.length - a.months.length || a.months[0] - b.months[0])
    .map((group): RecommendedLine => {
      const sorted = [...group.types].sort((a, b) => a.name.localeCompare(b.name));
      const units = sorted.reduce((sum, type) => sum + type.assetCount, 0);
      const raw = sorted.reduce((sum, type) => sum + type.assetCount * unitRateCents(type), 0);
      return {
        trade: group.trade,
        description: lineDescription(group.trade, group.months),
        visitMonths: group.months,
        costPerVisitCents: Math.min(MAX_VISIT_CENTS, Math.max(MINIMUM_VISIT_CENTS, roundUp(raw))),
        assetTypeIds: sorted.map((type) => type.id),
        typeNames: sorted.map((type) => type.name),
        unitCount: units,
      };
    });
  return lines.slice(0, Math.max(0, options.room ?? MAX_SERVICE_LINES));
}
