import type { AgreementReader, ServiceLineStore, SiteEquipmentReader } from "@/application/ports";
import { MAX_SERVICE_LINES } from "@/domain/agreement";
import { recommendServiceLines } from "@/domain/agreement/recommend";

export type RecommendLinesResult =
  /** `added` lines were created and tagged; 0 when every type on the site is already covered. */
  | { ok: true; added: number }
  | { ok: false; code: "not_found" | "locked" | "no_equipment" | "unavailable" | "forbidden" };

/**
 * Adds the recommended service lines to an agreement's current draft (recommended-lines): one line per trade and visit
 * pattern for every equipment type on the site that no line covers yet, each tagged Recommended until a person keeps or
 * edits it. Running it again only fills what is still uncovered, so it never duplicates a line.
 */
export function makeRecommendServiceLines(deps: { agreements: AgreementReader; equipment: SiteEquipmentReader; lines: ServiceLineStore }) {
  return async function recommendLines(agreementId: string): Promise<RecommendLinesResult> {
    const agreement = await deps.agreements.get(agreementId);
    if (!agreement) return { ok: false, code: "not_found" };
    if (!agreement.editable) return { ok: false, code: "locked" };
    const site = await deps.equipment.forAgreement(agreementId);
    if (!site) return { ok: false, code: "not_found" };
    if (site.types.length === 0) return { ok: false, code: "no_equipment" };

    const covered = agreement.shown.lines.flatMap((line) => line.equipment.map((type) => type.id));
    const proposals = recommendServiceLines(site.types, { coveredTypeIds: covered, room: MAX_SERVICE_LINES - agreement.shown.lines.length });
    let added = 0;
    for (const line of proposals) {
      const saved = await deps.lines.add(agreementId, {
        description: line.description,
        visitMonths: line.visitMonths,
        costPerVisitCents: line.costPerVisitCents,
        assetTypeIds: line.assetTypeIds,
      });
      if (!saved.ok) {
        if (added > 0) break;
        return { ok: false, code: saved.code === "too_many" ? "locked" : saved.code };
      }
      added += 1;
      // A line whose tag could not be set stays as a plain line: still correct, only unmarked.
      await deps.lines.setRecommended(saved.id, true);
    }
    return { ok: true, added };
  };
}
