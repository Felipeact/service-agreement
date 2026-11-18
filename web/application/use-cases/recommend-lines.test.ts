import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, AgreementReader, ServiceLineStore, SiteEquipmentReader } from "@/application/ports";
import { makeRecommendServiceLines } from "./recommend-lines";

const detail = (over: Partial<AgreementDetail> = {}) =>
  ({ editable: true, shown: { versionNo: 1, current: true, lines: [], annualCents: 0 }, ...over }) as AgreementDetail;

function setup(agreement: AgreementDetail | null, types = [{ id: "t-rtu", code: "RTU", name: "RTU", pack: "hvac", defaultVisitMonths: [3, 6, 9, 12], assetCount: 2 }]) {
  const agreements: AgreementReader = { get: vi.fn(async () => agreement) };
  const equipment: SiteEquipmentReader = { forAgreement: vi.fn(async () => (agreement ? { siteId: "s1", types } : null)) };
  const lines: ServiceLineStore = {
    add: vi.fn(async () => ({ ok: true as const, id: "l-new" })),
    update: vi.fn(),
    remove: vi.fn(),
    setRecommended: vi.fn(async () => ({ ok: true as const })),
  };
  return { recommend: makeRecommendServiceLines({ agreements, equipment, lines }), lines };
}

describe("recommendServiceLines use case", () => {
  test("adds each recommended line and tags it Recommended", async () => {
    const { recommend, lines } = setup(detail());
    expect(await recommend("a1")).toEqual({ ok: true, added: 1 });
    expect(lines.add).toHaveBeenCalledWith("a1", { description: "Heating and cooling preventive maintenance, quarterly", visitMonths: [3, 6, 9, 12], costPerVisitCents: 22000, assetTypeIds: ["t-rtu"] });
    expect(lines.setRecommended).toHaveBeenCalledWith("l-new", true);
  });

  test("a type a line already covers is not proposed again", async () => {
    const covered = detail({ shown: { versionNo: 1, current: true, annualCents: 0, lines: [{ equipment: [{ id: "t-rtu", code: "RTU", name: "RTU" }] }] as AgreementDetail["shown"]["lines"] } });
    const { recommend, lines } = setup(covered);
    expect(await recommend("a1")).toEqual({ ok: true, added: 0 });
    expect(lines.add).not.toHaveBeenCalled();
  });

  test("refuses a missing agreement, a locked one and a site with no equipment", async () => {
    expect(await setup(null).recommend("a1")).toEqual({ ok: false, code: "not_found" });
    expect(await setup(detail({ editable: false })).recommend("a1")).toEqual({ ok: false, code: "locked" });
    expect(await setup(detail(), []).recommend("a1")).toEqual({ ok: false, code: "no_equipment" });
  });
});
