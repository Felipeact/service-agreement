import type { AssetStore, AssetTypeCatalog, SiteRegister } from "@/application/ports";
import { planTypeCount } from "@/domain/records/type-count";

export type SiteTypeCountResult = { ok: true } | { ok: false; code: "not_found" | "invalid" | "tagged" | "in_term" | "forbidden" | "unavailable"; tagged?: number };

/**
 * Sets how many active units of one equipment type a site has, and where they are, as the agreement page edits equipment:
 * blank units are added, untagged ones taken off (made inactive, never deleted), and the location set on the rest
 * (`planTypeCount`). The type must be one of the org's; the site comes from the register, so another org's site is not found.
 * The writes are separate calls; a failure part way reports it and the page shows the site as it now is.
 */
export function makeSetSiteTypeCount(register: Pick<SiteRegister, "get">, catalog: Pick<AssetTypeCatalog, "list">, store: AssetStore) {
  return async function setSiteTypeCount(orgId: string, siteId: string, assetTypeId: string, count: number, location: string | null): Promise<SiteTypeCountResult> {
    const [site, types] = await Promise.all([register.get(siteId).catch(() => undefined), catalog.list().catch(() => undefined)]);
    if (site === undefined || types === undefined) return { ok: false, code: "unavailable" };
    if (site === null) return { ok: false, code: "not_found" };
    const type = types.find((candidate) => candidate.id === assetTypeId);
    if (!type) return { ok: false, code: "invalid" };

    const units = site.assets.filter((asset) => asset.active && asset.typeCode === type.code);
    const plan = planTypeCount(units, count, location);
    if (!plan.ok) return plan.code === "tagged" ? { ok: false, code: "tagged", tagged: plan.tagged } : { ok: false, code: "invalid" };

    try {
      for (const id of plan.deactivate) {
        const done = await store.setActive(id, false);
        if (!done.ok) return { ok: false, code: done.code === "in_term" ? "in_term" : done.code === "forbidden" || done.code === "not_found" ? done.code : "unavailable" };
      }
      for (const id of plan.relocate) {
        const unit = units.find((candidate) => candidate.id === id)!;
        const done = await store.update(id, { assetTypeId, unitNo: unit.unitNo, typeModel: unit.typeModel, location: plan.location });
        if (!done.ok) return { ok: false, code: done.code };
      }
      for (let index = 0; index < plan.create; index++) {
        const done = await store.create(orgId, siteId, { assetTypeId, unitNo: null, typeModel: null, location: plan.location });
        if (!done.ok) return { ok: false, code: done.code };
      }
    } catch {
      return { ok: false, code: "unavailable" };
    }
    return { ok: true };
  };
}
