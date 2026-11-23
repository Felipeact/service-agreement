import type { AgreementReader, ServiceLineStore } from "@/application/ports";
import type { ServiceLineValue } from "@/domain/agreement";

export type ApplyServiceLinesResult = { ok: true; lines: number } | { ok: false; code: "not_found" | "locked" | "invalid" | "unavailable" };

const MAX_LINES = 50;

/**
 * Replaces the lines of a draft's current version with the given ones: existing lines are rewritten in place, extra new lines
 * are added, and leftover old lines removed. Every type must be one the site has or a line already covers. The writes are
 * separate calls, so a failure part way leaves a mix; the draft stays editable and the review can be applied again.
 */
export function makeApplyServiceLines(reader: AgreementReader, store: ServiceLineStore) {
  return async function applyServiceLines(agreementId: string, next: ServiceLineValue[]): Promise<ApplyServiceLinesResult> {
    const agreement = await reader.get(agreementId).catch(() => undefined);
    if (agreement === undefined) return { ok: false, code: "unavailable" };
    if (agreement === null) return { ok: false, code: "not_found" };
    if (!agreement.editable) return { ok: false, code: "locked" };
    const allowed = new Set(agreement.equipmentChoices.map((type) => type.id));
    const fits = (line: ServiceLineValue) => line.assetTypeIds.length > 0 && line.assetTypeIds.every((id) => allowed.has(id));
    if (next.length === 0 || next.length > MAX_LINES || !next.every(fits)) return { ok: false, code: "invalid" };

    const old = agreement.shown.lines;
    const failed = (code: string) => ({ ok: false, code: code === "locked" ? "locked" : "unavailable" }) as const;
    try {
      for (let index = 0; index < Math.min(old.length, next.length); index++) {
        const saved = await store.update(old[index].id, next[index]);
        if (!saved.ok) return failed(saved.code);
      }
      for (const line of old.slice(next.length)) {
        const removed = await store.remove(line.id);
        if (!removed.ok) return failed(removed.code);
      }
      for (const line of next.slice(old.length)) {
        const added = await store.add(agreementId, line);
        if (!added.ok) return failed(added.code);
      }
    } catch {
      return { ok: false, code: "unavailable" };
    }
    return { ok: true, lines: next.length };
  };
}
