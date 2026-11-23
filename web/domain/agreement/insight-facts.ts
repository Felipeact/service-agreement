/** The slice of an agreement the insight reads; the page's `AgreementDetail` satisfies it. */
export type InsightSource = {
  status: string;
  shown: {
    versionNo: number;
    annualCents: number;
    lines: { description: string; visitMonths: number[]; costPerVisitCents: number; annualCents: number; equipment: { name: string }[] }[];
  };
  term: { months: number; start: string | null };
  serviceScope: { source: "live" | "frozen" | "not_recorded"; types?: { name: string; assets: unknown[] }[] };
  scopeDraft?: { uncovered: { name: string; assetCount: number }[] };
};

/**
 * What the model is told: amounts, months and equipment by type. No customer, site, contact or address is read here, so none can
 * reach the model.
 */
export function insightFacts(source: InsightSource, tradeContext: string | null) {
  const covered = (source.serviceScope.types ?? []).map((type) => ({ type: type.name, units: type.assets.length, covered: true }));
  const uncovered = (source.scopeDraft?.uncovered ?? []).map((type) => ({ type: type.name, units: type.assetCount, covered: false }));
  return {
    status: source.status,
    versionNo: source.shown.versionNo,
    term: { months: source.term.months, start: source.term.start },
    totalPerYearCents: source.shown.annualCents,
    lines: source.shown.lines.map((line) => ({
      description: line.description,
      visitMonths: line.visitMonths,
      costPerVisitCents: line.costPerVisitCents,
      annualCents: line.annualCents,
      equipment: line.equipment.map((type) => type.name),
    })),
    equipment: [...covered, ...uncovered],
    tradeContext,
  };
}
