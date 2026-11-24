import type { ServiceLineValue } from "./index";
import {
  DEFAULT_RATES,
  FREQUENCIES,
  TYPE_RECIPES,
  frequencyLabel,
  planServiceLines,
  type Frequency,
  type PlanType,
  type PricingRates,
  type RecipeOverrides,
} from "./service-plan";

/** The reviewer's judgement on one equipment type: how often, how long per unit, and why. */
export type TypeJudgement = { code: string; frequency: string; minutesPerUnit: number; reason: string };

/** A line ready to save, with why it looks the way it does. */
export type ProposedLine = ServiceLineValue & { reason: string };

/** A line as the comparison shows it. */
export type ProposalLine = { description: string; visitMonths: number[]; costPerVisitCents: number; annualCents: number; equipment: string[]; reason: string | null };

export type ProposalField = "description" | "visitMonths" | "costPerVisitCents";

/** A suggested line and how it compares with the agreement now. */
export type ProposalRow =
  | { kind: "added"; line: ProposalLine }
  | { kind: "unchanged"; line: ProposalLine }
  | { kind: "changed"; line: ProposalLine; before: ProposalLine; fields: ProposalField[] };

/** Every suggested line in order, the current lines it would remove, and the yearly totals before and after. */
export type ProposalDiff = { rows: ProposalRow[]; removed: ProposalLine[]; totalFromCents: number; totalToCents: number };

const MAX_REASON = 300;
const isFrequency = (value: string): value is Frequency => (FREQUENCIES as readonly string[]).includes(value);
const hours = (minutes: number) => Math.round(minutes / 6) / 10;
const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-CA", { maximumFractionDigits: 2 })}`;

/**
 * The reviewer's judgements as plan overrides: only codes the site has, only known frequencies, one judgement per code (the
 * first). A judgement the plan cannot use is ignored, so that type keeps its standard recipe.
 */
export function overridesFrom(judgements: readonly TypeJudgement[], types: readonly PlanType[]): { overrides: RecipeOverrides; reasons: Map<string, string> } {
  const codes = new Set(types.map((type) => type.code));
  const overrides: Record<string, { frequency: Frequency; minutesPerUnit: number }> = {};
  const reasons = new Map<string, string>();
  for (const judgement of judgements) {
    if (!codes.has(judgement.code) || reasons.has(judgement.code) || !isFrequency(judgement.frequency)) continue;
    if (!Number.isFinite(judgement.minutesPerUnit) || judgement.minutesPerUnit <= 0) continue;
    overrides[judgement.code] = { frequency: judgement.frequency, minutesPerUnit: judgement.minutesPerUnit };
    reasons.set(judgement.code, judgement.reason.trim().slice(0, MAX_REASON));
  }
  return { overrides, reasons };
}

/**
 * The suggested agreement: the site's equipment grouped by frequency and priced from labour, with the reviewer's judgements
 * applied when there are any. Each line's reason says the labour and price, then why the reviewer moved any type off its
 * standard recipe.
 */
export function proposeLines(types: readonly PlanType[], judgements: readonly TypeJudgement[] = [], rates: PricingRates = DEFAULT_RATES): ProposedLine[] {
  const { overrides, reasons } = overridesFrom(judgements, types);
  const nameOf = new Map(types.map((type) => [type.code, type.name]));
  return planServiceLines(types, rates, overrides).map((line) => {
    const labour = `${hours(line.labourMinutes)} h of labour a visit at ${dollars(rates.hourlyRateCents)}/h`;
    const moved = line.typeCodes
      .filter((code) => {
        const standard = TYPE_RECIPES[code];
        const chosen = overrides[code];
        return chosen && (!standard || standard.frequency !== chosen.frequency || standard.minutesPerUnit !== chosen.minutesPerUnit);
      })
      .map((code) => `${nameOf.get(code)}: ${reasons.get(code)}`);
    const reason = [`${frequencyLabel(line.visitMonths)}, ${labour}.`, ...moved].join(" ");
    return { description: line.description, visitMonths: line.visitMonths, costPerVisitCents: line.costPerVisitCents, assetTypeIds: line.assetTypeIds, reason };
  });
}

const annual = (line: Pick<ServiceLineValue, "visitMonths" | "costPerVisitCents">) => line.visitMonths.length * line.costPerVisitCents;
const keyOf = (values: readonly (string | number)[]) => [...values].map(String).sort().join(",");

/**
 * What applying a proposal changes. A suggested line covering exactly the same equipment as a current line is compared with it
 * field by field (changed or unchanged); any other suggested line is added, and every unmatched current line is removed.
 */
export function diffProposal(
  current: readonly (ServiceLineValue & { equipment: string[] })[],
  proposed: readonly (ProposedLine & { equipment: string[] })[],
): ProposalDiff {
  const view = (line: ServiceLineValue & { equipment: string[] }, reason: string | null): ProposalLine => ({
    description: line.description,
    visitMonths: [...line.visitMonths],
    costPerVisitCents: line.costPerVisitCents,
    annualCents: annual(line),
    equipment: line.equipment,
    reason,
  });
  const remaining = new Map<string, ServiceLineValue & { equipment: string[] }>();
  for (const line of current) if (!remaining.has(keyOf(line.assetTypeIds))) remaining.set(keyOf(line.assetTypeIds), line);
  const matched = new Set<ServiceLineValue>();
  const rows: ProposalRow[] = [];

  for (const line of proposed) {
    const before = remaining.get(keyOf(line.assetTypeIds));
    if (!before) {
      rows.push({ kind: "added", line: view(line, line.reason) });
      continue;
    }
    remaining.delete(keyOf(line.assetTypeIds));
    matched.add(before);
    const fields: ProposalField[] = [];
    if (before.description !== line.description) fields.push("description");
    if (keyOf(before.visitMonths) !== keyOf(line.visitMonths)) fields.push("visitMonths");
    if (before.costPerVisitCents !== line.costPerVisitCents) fields.push("costPerVisitCents");
    rows.push(fields.length > 0 ? { kind: "changed", line: view(line, line.reason), before: view(before, null), fields } : { kind: "unchanged", line: view(line, line.reason) });
  }

  return {
    rows,
    removed: current.filter((line) => !matched.has(line)).map((line) => view(line, null)),
    totalFromCents: current.reduce((sum, line) => sum + annual(line), 0),
    totalToCents: proposed.reduce((sum, line) => sum + annual(line), 0),
  };
}

/** Whether applying the proposal would change anything. */
export const hasChanges = (diff: ProposalDiff): boolean => diff.removed.length > 0 || diff.rows.some((row) => row.kind !== "unchanged");
