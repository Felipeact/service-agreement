import type { AgreementReader, ServiceLineStore } from "@/application/ports";
import { planServiceLines } from "@/domain/agreement/service-plan";

export type GenerateServiceLinesResult =
  | { ok: true; added: number }
  | { ok: false; code: "not_found" | "locked" | "unavailable"; added: number };

/**
 * Builds the service lines of a draft from the equipment on its site, using the standard plan: equipment no line covers yet is
 * grouped by frequency (monthly, quarterly, semi-annual, annual), one line per group, priced from the labour of its units. The
 * visit schedule and the "Service included" list follow from the lines. Lines are added one by one, so a failure part way
 * reports how many were added, and a second run adds only the rest.
 */
export function makeGenerateServiceLines(reader: AgreementReader, lines: ServiceLineStore) {
  return async function generateServiceLines(agreementId: string): Promise<GenerateServiceLinesResult> {
    const agreement = await reader.get(agreementId).catch(() => undefined);
    if (agreement === undefined) return { ok: false, code: "unavailable", added: 0 };
    if (agreement === null) return { ok: false, code: "not_found", added: 0 };
    if (!agreement.editable) return { ok: false, code: "locked", added: 0 };

    const covered = new Set(agreement.shown.lines.flatMap((line) => line.equipment.map((type) => type.id)));
    const uncovered = agreement.equipmentChoices.filter((type) => !covered.has(type.id)).map((type) => ({ ...type, units: type.units ?? 1 }));
    let added = 0;
    for (const plan of planServiceLines(uncovered)) {
      const draft = { description: plan.description, visitMonths: plan.visitMonths, costPerVisitCents: plan.costPerVisitCents, assetTypeIds: plan.assetTypeIds };
      const saved = await lines.add(agreementId, draft).catch(() => ({ ok: false, code: "unavailable" }) as const);
      if (!saved.ok) return { ok: false, code: saved.code === "locked" ? "locked" : "unavailable", added };
      added++;
    }
    return { ok: true, added };
  };
}
