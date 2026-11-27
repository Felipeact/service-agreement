import type { ImportReviewReader, ImportRowStore } from "@/application/ports";
import { flagRows, normalized, type SiteAssetRef } from "@/domain/imports";
import type { ResolveEquipmentTypes } from "./resolve-equipment-types";

export type FixImportResult =
  | { ok: true; typed: number; newTypes: string[]; shortened: number; skippedRepeats: number; unresolved: number }
  | { ok: false; code: "not_found" | "not_ready" | "unavailable" };

const LIMITS = { unitNo: 40, typeModel: 120, location: 300 } as const;
const cut = (value: string | null, max: number) => (value !== null && value.length > max ? value.slice(0, max).trim() : value);

/**
 * Makes an extracted list ready to commit without a person, so an agreement made from an upload never stops at the review screen:
 * every row with no type is given one (a catalog type, or a new type the model names, see `resolveEquipmentTypes`), a field longer
 * than the asset form allows is cut to the limit, and a row that repeats an earlier row of the same file (same type and unit #) is
 * skipped. Rows already on the site are left to the commit, which never adds them twice. Low-confidence rows stay in: they are
 * real rows the model was unsure about, and the contractor can still edit them from the site. Nothing is invented for a field.
 */
export function makeFixImportRows(deps: {
  review: ImportReviewReader;
  rows: ImportRowStore;
  resolveTypes: ResolveEquipmentTypes;
  siteAssets: (siteId: string) => Promise<SiteAssetRef[]>;
}) {
  const { review, rows, resolveTypes, siteAssets } = deps;

  return async function fixImportRows(orgId: string, jobId: string): Promise<FixImportResult> {
    const first = await review.forJob(jobId).catch(() => null);
    if (!first) return { ok: false, code: "not_found" };
    if (first.job.status !== "extracted") return { ok: false, code: "not_ready" };

    // 1. Types: one resolution per distinct wording; a row with no wording at all gets the fallback type one by one.
    const untyped = first.rows.filter((row) => !row.skipped && row.assetTypeId === null);
    const resolved = await resolveTypes(orgId, untyped.map((row) => row.assetTypeRaw));
    const newTypes = new Set<string>();
    for (const type of resolved.byKey.values()) if (type.created) newTypes.add(type.name);
    let typed = 0;
    const mappedKeys = new Set<string>();
    for (const row of untyped) {
      const key = normalized(row.assetTypeRaw ?? "");
      const type = resolved.byKey.get(key);
      if (!type) continue;
      if (key !== "") {
        if (mappedKeys.has(key)) continue;
        mappedKeys.add(key);
        const mapped = await rows.mapType(jobId, key, type.typeId).catch(() => null);
        if (mapped?.ok) typed += mapped.rows;
        continue;
      }
      const saved = await rows.update(row.id, { assetTypeId: type.typeId, unitNo: row.unitNo, typeModel: row.typeModel, location: row.location }).catch(() => null);
      if (saved?.ok) typed += 1;
    }

    // 2. Fields over the asset form's limits are cut, and an earlier row's repeat in the same file is skipped.
    const second = (await review.forJob(jobId).catch(() => null)) ?? first;
    let shortened = 0;
    for (const row of second.rows) {
      if (row.skipped || row.assetTypeId === null) continue;
      const unitNo = cut(row.unitNo, LIMITS.unitNo);
      const typeModel = cut(row.typeModel, LIMITS.typeModel);
      const location = cut(row.location, LIMITS.location);
      if (unitNo === row.unitNo && typeModel === row.typeModel && location === row.location) continue;
      const saved = await rows.update(row.id, { assetTypeId: row.assetTypeId, unitNo, typeModel, location }).catch(() => null);
      if (saved?.ok) shortened += 1;
    }
    const third = (await review.forJob(jobId).catch(() => null)) ?? second;
    const onSite = await siteAssets(third.job.siteId).catch(() => []);
    const flags = flagRows(third.rows, onSite);
    let skippedRepeats = 0;
    for (const row of third.rows) {
      if (!(flags.get(row.id) ?? []).some((flag) => flag.kind === "same_as")) continue;
      const skipped = await rows.setSkipped(row.id, true).catch(() => null);
      if (skipped?.ok) skippedRepeats += 1;
    }
    const unresolved = third.rows.filter((row) => !row.skipped && row.assetTypeId === null).length;
    return { ok: true, typed, newTypes: [...newTypes], shortened, skippedRepeats, unresolved };
  };
}

export type FixImportRows = ReturnType<typeof makeFixImportRows>;
