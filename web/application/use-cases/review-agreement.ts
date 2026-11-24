import type { AgreementDetail, AgreementReader, AgreementReviewer, AssetTypeCatalog } from "@/application/ports";
import { diffProposal, proposeLines, type ProposalDiff, type ProposedLine } from "@/domain/agreement/proposal";
import { DEFAULT_RATES, TYPE_RECIPES, type PlanType } from "@/domain/agreement/service-plan";

export type AgreementReviewOutcome =
  | {
      ok: true;
      /** `ai` when the model answered; `standard` when it could not and the standard plan is offered instead. */
      source: "ai" | "standard";
      summary: string;
      proposal: ProposedLine[];
      diff: ProposalDiff;
    }
  | { ok: false; code: "not_found" | "locked" | "unavailable" | "no_equipment" };

/** The site's equipment as the plan reads it: types with at least one unit. */
export function planTypesOf(agreement: Pick<AgreementDetail, "equipmentChoices">): PlanType[] {
  return agreement.equipmentChoices.map((type) => ({ ...type, units: type.units ?? 0 })).filter((type) => type.units > 0);
}

/**
 * Reviews the whole draft (equipment, lines, visits, prices, units left out, term) and suggests the service lines it should
 * have, saying what applying them changes. The model judges each equipment type (how often, how long per unit, why), starting
 * from the standard recipe; the domain then groups the types by frequency and prices each line from its labour. Nothing is
 * saved here: the person applies the proposal or not.
 */
export function makeReviewAgreement(reader: AgreementReader, catalog: Pick<AssetTypeCatalog, "tradeContext">, reviewer: AgreementReviewer) {
  return async function reviewAgreement(agreementId: string): Promise<AgreementReviewOutcome> {
    const agreement = await reader.get(agreementId).catch(() => undefined);
    if (agreement === undefined) return { ok: false, code: "unavailable" };
    if (agreement === null) return { ok: false, code: "not_found" };
    if (!agreement.editable) return { ok: false, code: "locked" };
    const types = planTypesOf(agreement);
    if (types.length === 0) return { ok: false, code: "no_equipment" };

    const lineOf = (code: string) => agreement.shown.lines.find((line) => line.equipment.some((type) => type.code === code));
    const tradeContext = await catalog.tradeContext().catch(() => null);
    const answer = await reviewer
      .review({
        equipment: types.map((type) => {
          const line = lineOf(type.code);
          const standard = TYPE_RECIPES[type.code];
          return {
            code: type.code,
            name: type.name,
            units: type.units,
            standard: standard ? { frequency: standard.frequency, minutesPerUnit: standard.minutesPerUnit } : null,
            current: line ? { visitMonths: line.visitMonths, costPerVisitCents: line.costPerVisitCents, typesOnLine: line.equipment.length } : null,
            leftOut: (agreement.scopeDraft?.controls ?? []).filter((control) => control.typeCode === type.code && control.excluded).length,
          };
        }),
        agreement: {
          lineCount: agreement.shown.lines.length,
          totalPerYearCents: agreement.shown.annualCents,
          termMonths: agreement.term.months,
          termStartSet: agreement.term.start !== null,
        },
        rates: DEFAULT_RATES,
        tradeContext,
      })
      .catch(() => ({ ok: false, code: "unavailable" }) as const);

    const proposal = proposeLines(types, answer.ok ? answer.review.types : []);
    const nameOf = new Map(agreement.equipmentChoices.map((type) => [type.id, type.name]));
    const diff = diffProposal(
      agreement.shown.lines.map((line) => ({
        description: line.description,
        visitMonths: line.visitMonths,
        costPerVisitCents: line.costPerVisitCents,
        assetTypeIds: line.equipment.map((type) => type.id),
        equipment: line.equipment.map((type) => type.name),
      })),
      proposal.map((line) => ({ ...line, equipment: line.assetTypeIds.map((id) => nameOf.get(id) ?? "Unknown") })),
    );
    return {
      ok: true,
      source: answer.ok ? "ai" : "standard",
      summary: answer.ok ? answer.review.summary : "The AI review is not available right now, so this is the standard plan for the equipment on site.",
      proposal,
      diff,
    };
  };
}
