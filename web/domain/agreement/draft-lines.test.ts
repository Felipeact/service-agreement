import { describe, expect, test } from "vitest";
import { draftServiceLines, FALLBACK_VISIT_MONTHS } from "./draft-lines";

const RTU = { id: "rtu", name: "Rooftop unit", defaultVisitMonths: [12, 3, 9, 6] };
const BOILER = { id: "boiler", name: "Boiler", defaultVisitMonths: [10] };
const ODD = { id: "odd", name: "Odd unit", defaultVisitMonths: [] };

describe("draftServiceLines", () => {
  test("one unpriced line per type, with its best months ascending and the type as its scope", () => {
    expect(draftServiceLines([RTU, BOILER], [])).toEqual([
      { description: "Boiler preventive maintenance", visitMonths: [10], costPerVisitCents: 0, assetTypeIds: ["boiler"] },
      { description: "Rooftop unit preventive maintenance", visitMonths: [3, 6, 9, 12], costPerVisitCents: 0, assetTypeIds: ["rtu"] },
    ]);
  });

  test("a type a line already covers is left alone, so a second run adds nothing", () => {
    expect(draftServiceLines([RTU, BOILER], ["rtu"]).map((line) => line.assetTypeIds)).toEqual([["boiler"]]);
    expect(draftServiceLines([RTU, BOILER], ["rtu", "boiler"])).toEqual([]);
  });

  test("a type with no catalog months gets spring and fall", () => {
    expect(draftServiceLines([ODD], [])[0]?.visitMonths).toEqual([...FALLBACK_VISIT_MONTHS]);
  });
});
