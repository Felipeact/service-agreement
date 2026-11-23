import type { AgreementReader, ServiceLineStore } from "@/application/ports";
import { draftServiceLines } from "@/domain/agreement/draft-lines";

export type GenerateServiceLinesResult =
  | { ok: true; added: number }
  | { ok: false; code: "not_found" | "locked" | "unavailable"; added: number };

/**
 * Builds the service lines of a draft from the equipment on its site: one line for each equipment type no line covers yet,
 * with the type's best months. The visit schedule and the "Service included" list follow from the lines, so they fill in with
 * them. Lines are added one by one, so a failure part way reports how many were added, and a second run adds only the rest.
 */
export function makeGenerateServiceLines(reader: AgreementReader, lines: ServiceLineStore) {
  return async function generateServiceLines(agreementId: string): Promise<GenerateServiceLinesResult> {
    const agreement = await reader.get(agreementId).catch(() => undefined);
    if (agreement === undefined) return { ok: false, code: "unavailable", added: 0 };
    if (agreement === null) return { ok: false, code: "not_found", added: 0 };
    if (!agreement.editable) return { ok: false, code: "locked", added: 0 };

    const covered = agreement.shown.lines.flatMap((line) => line.equipment.map((type) => type.id));
    const drafts = draftServiceLines(agreement.equipmentChoices, covered);
    let added = 0;
    for (const draft of drafts) {
      const saved = await lines.add(agreementId, draft).catch(() => ({ ok: false, code: "unavailable" }) as const);
      if (!saved.ok) return { ok: false, code: saved.code === "locked" ? "locked" : "unavailable", added };
      added++;
    }
    return { ok: true, added };
  };
}
