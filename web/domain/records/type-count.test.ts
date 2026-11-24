import { describe, expect, it } from "vitest";
import { planTypeCount, sharedLocation, type CountUnit } from "./type-count";

const unit = (id: string, unitNo: string | null = null, typeModel: string | null = null, location: string | null = null): CountUnit => ({ id, unitNo, typeModel, location });

describe("planTypeCount", () => {
  it("adds blank units for a higher count", () => {
    expect(planTypeCount([unit("a"), unit("b")], 5, null)).toEqual({ ok: true, create: 3, deactivate: [], relocate: [], location: null });
  });

  it("takes off untagged units, newest first, for a lower count", () => {
    const plan = planTypeCount([unit("a", "RTU-1"), unit("b"), unit("c", "7"), unit("d")], 2, null);
    expect(plan).toEqual({ ok: true, create: 0, deactivate: ["d", "b"], relocate: [], location: null });
    expect(planTypeCount([unit("a", "RTU-1"), unit("b"), unit("c", "7"), unit("d")], 3, null)).toMatchObject({ deactivate: ["d"] });
  });

  it("refuses when too few units are untagged", () => {
    expect(planTypeCount([unit("a", "RTU-1"), unit("b", null, "Carrier"), unit("c")], 1, null)).toEqual({ ok: false, code: "tagged", tagged: 2 });
  });

  it("counts a plain sequence number as a tag the person typed, so it is kept", () => {
    expect(planTypeCount([unit("a", "27"), unit("b", "28")], 1, null)).toMatchObject({ ok: false, code: "tagged" });
  });

  it("takes every unit off at 0, tagged or not", () => {
    expect(planTypeCount([unit("a", "RTU-1"), unit("b")], 0, null)).toMatchObject({ ok: true, deactivate: ["a", "b"] });
  });

  it("sets the location on every staying unit that differs", () => {
    const plan = planTypeCount([unit("a", null, null, "Roof"), unit("b", null, null, "Basement"), unit("c")], 3, " Roof ");
    expect(plan).toEqual({ ok: true, create: 0, deactivate: [], relocate: ["b", "c"], location: "Roof" });
  });

  it("refuses a count that is not a whole number from 0 to 500", () => {
    for (const count of [-1, 1.5, 501, Number.NaN]) expect(planTypeCount([], count, null)).toEqual({ ok: false, code: "invalid" });
  });
});

describe("sharedLocation", () => {
  it("is the one location every unit has, else empty", () => {
    expect(sharedLocation([unit("a", null, null, "Roof"), unit("b", null, null, "Roof ")])).toBe("Roof");
    expect(sharedLocation([unit("a", null, null, "Roof"), unit("b")])).toBe("");
  });
});
