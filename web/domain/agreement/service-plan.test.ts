import { describe, expect, it } from "vitest";
import { frequencyLabel, planServiceLines, suggestedCostPerVisit, type PlanType } from "./service-plan";
import { diffProposal, proposeLines } from "./proposal";
import { detailText, staffUnitLabel, unitDetails } from "./unit-details";

const type = (code: string, units: number, defaultVisitMonths: number[] = [3, 6, 9, 12]): PlanType => ({
  id: `00000000-0000-4000-8000-${code.length.toString().padStart(4, "0")}${code.slice(0, 8).padEnd(8, "0").replace(/[^0-9a-f]/gi, "a").toLowerCase()}`,
  code,
  name: code,
  units,
  defaultVisitMonths,
});

describe("planServiceLines", () => {
  const site = [type("RTU", 7), type("FAN_COIL", 18), type("CHILLER", 1), type("COOLING_TOWER", 1), type("PUMP", 3), type("BOILER", 3), type("FIRE_DAMPER", 40), type("FURNACE", 2)];

  it("groups equipment by frequency, most frequent first", () => {
    const lines = planServiceLines(site);
    expect(lines.map((line) => line.frequency)).toEqual(["Monthly", "Quarterly", "Semi-annual", "Annual"]);
    expect(lines.map((line) => line.visitMonths.length)).toEqual([12, 4, 2, 1]);
  });

  it("puts each type on one line and says the visits and units", () => {
    const lines = planServiceLines(site);
    const quarterly = lines[1];
    expect(quarterly.units).toBe(25);
    expect(quarterly.description).toBe("Quarterly preventive maintenance: 4 visits a year, 25 units");
    expect(lines.flatMap((line) => line.assetTypeIds)).toHaveLength(site.length);
  });

  it("prices a visit from the labour of its units", () => {
    // 7 RTU x 60 + 18 fan coils x 20 = 780 minutes = 13 h at $135 = $1,755.
    expect(planServiceLines(site)[1].costPerVisitCents).toBe(175_500);
  });

  it("leaves out types with no units and falls back to catalog months for unknown codes", () => {
    const lines = planServiceLines([type("RTU", 0), type("GREASE_TRAP", 2, [1, 7])]);
    expect(lines).toHaveLength(1);
    expect(lines[0].visitMonths).toEqual([1, 7]);
  });
});

describe("suggestedCostPerVisit", () => {
  it("never goes under the visit minimum and rounds up to $5", () => {
    expect(suggestedCostPerVisit(10)).toBe(15_000);
    expect(suggestedCostPerVisit(91)).toBe(20_500);
  });
});

describe("frequencyLabel", () => {
  it("names the usual frequencies", () => {
    expect(frequencyLabel([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe("Monthly");
    expect(frequencyLabel([3, 6, 9, 12])).toBe("Quarterly");
    expect(frequencyLabel([4, 10])).toBe("Semi-annual");
    expect(frequencyLabel([10])).toBe("Annual");
    expect(frequencyLabel([1, 5, 9])).toBe("3 visits a year");
  });
});

describe("proposeLines", () => {
  const types = [type("RTU", 2), type("BOILER", 3), type("GREASE_TRAP", 1, [5])];

  it("is the standard plan with no judgements", () => {
    const lines = proposeLines(types);
    expect(lines.map((line) => line.visitMonths.length)).toEqual([4, 2, 1]);
    expect(lines[0].reason).toBe("Quarterly, 2 h of labour a visit at $135/h.");
  });

  it("applies a judgement, ignores unknown codes and bad frequencies, and says why a type moved", () => {
    const lines = proposeLines(types, [
      { code: "BOILER", frequency: "quarterly", minutesPerUnit: 60, reason: "Heavy use." },
      { code: "GHOST", frequency: "monthly", minutesPerUnit: 10, reason: "" },
      { code: "RTU", frequency: "weekly", minutesPerUnit: 10, reason: "" },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].assetTypeIds).toHaveLength(2);
    // 2 RTU x 60 + 3 boilers x 60 = 300 minutes = 5 h at $135 = $675.
    expect(lines[0].costPerVisitCents).toBe(67_500);
    expect(lines[0].reason).toBe("Quarterly, 5 h of labour a visit at $135/h. BOILER: Heavy use.");
  });
});

describe("diffProposal", () => {
  it("matches lines by equipment and lists the rest as added or removed", () => {
    const current = [
      { description: "RTU", visitMonths: [3, 6, 9, 12], costPerVisitCents: 0, assetTypeIds: ["a"], equipment: ["RTU"] },
      { description: "Pump", visitMonths: [4, 10], costPerVisitCents: 0, assetTypeIds: ["b"], equipment: ["Pump"] },
    ];
    const proposed = [
      { description: "RTU", visitMonths: [3, 6, 9, 12], costPerVisitCents: 10_000, assetTypeIds: ["a"], equipment: ["RTU"], reason: "Priced" },
      { description: "Both", visitMonths: [4, 10], costPerVisitCents: 5_000, assetTypeIds: ["b", "c"], equipment: ["Pump", "Fan"], reason: "Grouped" },
    ];
    const diff = diffProposal(current, proposed);
    expect(diff.rows.map((row) => row.kind)).toEqual(["changed", "added"]);
    expect(diff.rows[0]).toMatchObject({ fields: ["costPerVisitCents"] });
    expect(diff.removed.map((line) => line.description)).toEqual(["Pump"]);
    expect(diff.totalFromCents).toBe(0);
    expect(diff.totalToCents).toBe(50_000);
  });
});

describe("unitDetails", () => {
  const unit = (unitNo: string | null, typeModel: string | null = null, location: string | null = null) => ({ unitNo, typeModel, location });

  it("counts bare numbers without listing them and groups shared details", () => {
    expect(unitDetails([unit("27"), unit("#34"), unit(null)])).toEqual([]);
    const fanCoils = unitDetails([unit("1", null, "floors 2-3"), unit("2", null, "floors 2-3")]);
    expect(fanCoils.map(detailText)).toEqual(["floors 2-3 · 2 units"]);
  });

  it("keeps tags and models", () => {
    expect(unitDetails([unit("RTU-3", "Carrier 48TC", "Roof")]).map(detailText)).toEqual(["RTU-3 · Carrier 48TC · Roof"]);
  });

  it("names a bare number for staff", () => {
    expect(staffUnitLabel(unit("27"))).toBe("Unit 27");
    expect(staffUnitLabel(unit(null, null, "Roof"))).toBe("No unit # · Roof");
  });
});
