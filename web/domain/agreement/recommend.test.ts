import { describe, expect, test } from "vitest";
import { MAX_SERVICE_LINES } from "./index";
import { MINIMUM_VISIT_CENTS, cadenceWords, recommendServiceLines, tradeOf, unitRateCents, type SiteEquipmentType } from "./recommend";

const type = (over: Partial<SiteEquipmentType> & Pick<SiteEquipmentType, "id" | "code">): SiteEquipmentType => ({
  name: over.code,
  pack: null,
  defaultVisitMonths: [],
  assetCount: 1,
  ...over,
});

describe("tradeOf", () => {
  test("a seeded type takes its pack, and the five refrigeration codes are refrigeration even in the HVAC pack", () => {
    expect(tradeOf({ code: "RTU", name: "RTU", pack: "hvac" })).toBe("hvac");
    expect(tradeOf({ code: "WALK_IN_COOLER", name: "Walk-in cooler", pack: "hvac" })).toBe("refrigeration");
    expect(tradeOf({ code: "BACKFLOW_PREVENTER", name: "Backflow preventer", pack: "plumbing" })).toBe("plumbing");
    expect(tradeOf({ code: "GENERATOR", name: "Standby generator", pack: "electrical" })).toBe("electrical");
  });

  test("a type of the org's own is placed by the catalog code it shares, then by the words in its name", () => {
    expect(tradeOf({ code: "SUMP_PUMP", name: "Sump", pack: null })).toBe("plumbing");
    expect(tradeOf({ code: "SPRINKLER_RISER", name: "Sprinkler riser", pack: null })).toBe("fire_life_safety");
    expect(tradeOf({ code: "REACH_IN", name: "Reach-in freezer", pack: null })).toBe("refrigeration");
    expect(tradeOf({ code: "GEO_HP", name: "Geothermal heat pump", pack: null })).toBe("hvac");
    expect(tradeOf({ code: "LIGHT_POLE", name: "Parking light pole", pack: null })).toBe("electrical");
    expect(tradeOf({ code: "GATE", name: "Overhead door", pack: null })).toBe("general");
  });
});

describe("recommendServiceLines", () => {
  const site = [
    type({ id: "rtu", code: "RTU", name: "RTU", pack: "hvac", defaultVisitMonths: [3, 6, 9, 12], assetCount: 4 }),
    type({ id: "mua", code: "MUA", name: "MUA", pack: "hvac", defaultVisitMonths: [3, 6, 9, 12], assetCount: 1 }),
    type({ id: "boiler", code: "BOILER", name: "Boiler", pack: "hvac", defaultVisitMonths: [10], assetCount: 2 }),
    type({ id: "wic", code: "WALK_IN_COOLER", name: "Walk-in cooler", pack: "hvac", defaultVisitMonths: [3, 6, 9, 12], assetCount: 1 }),
    type({ id: "grease", code: "GREASE_INTERCEPTOR", name: "Grease interceptor", pack: "plumbing", defaultVisitMonths: [3, 6, 9, 12], assetCount: 1 }),
    type({ id: "panel", code: "DISTRIBUTION_PANEL", name: "Distribution panel", pack: "electrical", defaultVisitMonths: [10], assetCount: 3 }),
  ];

  test("one line per trade and visit pattern, HVAC first, more visits first within a trade", () => {
    const lines = recommendServiceLines(site);
    expect(lines.map((line) => [line.description, line.visitMonths, line.assetTypeIds])).toEqual([
      ["Heating and cooling preventive maintenance, quarterly", [3, 6, 9, 12], ["mua", "rtu"]],
      ["Heating and cooling annual inspection", [10], ["boiler"]],
      ["Refrigeration preventive maintenance, quarterly", [3, 6, 9, 12], ["wic"]],
      ["Plumbing preventive maintenance, quarterly", [3, 6, 9, 12], ["grease"]],
      ["Electrical annual inspection", [10], ["panel"]],
    ]);
  });

  test("the price per visit is the units times their typical rate, rounded up to $5, never under the minimum", () => {
    const [hvac, boiler, cooler] = recommendServiceLines(site);
    expect(hvac.costPerVisitCents).toBe(4 * unitRateCents(site[0]) + unitRateCents(site[1]));
    expect(hvac.unitCount).toBe(5);
    expect(boiler.costPerVisitCents).toBe(2 * 22000);
    expect(cooler.costPerVisitCents).toBe(MINIMUM_VISIT_CENTS);
    expect(recommendServiceLines([type({ id: "x", code: "ODD", name: "Odd thing", assetCount: 1 })])[0].costPerVisitCents).toBe(MINIMUM_VISIT_CENTS);
  });

  test("types already covered, without units or beyond the room left are not proposed", () => {
    expect(recommendServiceLines(site, { coveredTypeIds: ["rtu", "mua", "boiler", "wic", "grease"] }).map((line) => line.assetTypeIds)).toEqual([["panel"]]);
    expect(recommendServiceLines([type({ id: "a", code: "RTU", assetCount: 0 })])).toEqual([]);
    expect(recommendServiceLines(site, { room: 2 })).toHaveLength(2);
    expect(recommendServiceLines(site, { room: MAX_SERVICE_LINES })).toHaveLength(5);
  });

  test("a type with no default months visits on its trade's usual pattern", () => {
    const [line] = recommendServiceLines([type({ id: "s", code: "SUMP_PUMP", name: "Sump pump", pack: "plumbing", defaultVisitMonths: [] })]);
    expect(line.visitMonths).toEqual([4, 10]);
    expect(line.description).toBe("Plumbing preventive maintenance, semi-annual");
  });
});

test("cadenceWords names the common patterns", () => {
  expect([12, 4, 2, 1, 3].map((n) => cadenceWords(Array.from({ length: n }, (_, i) => i + 1)))).toEqual(["monthly", "quarterly", "semi-annual", "annual", "3 visits a year"]);
});
