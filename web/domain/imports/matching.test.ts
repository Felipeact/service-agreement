import { describe, expect, test } from "vitest";
import { matchAssetType, splitQuantity, type AssetTypeRef } from "./index";

const type = (id: string, code: string, name: string, synonyms: string[] = []): AssetTypeRef => ({ id, code, name, synonyms });
const TYPES = [
  type("boiler", "BOILER", "Boiler"),
  type("chiller", "CHILLER", "Chiller"),
  type("exfan", "EXFAN", "Exhaust fan"),
  type("backflow", "BACKFLOW", "Backflow preventer"),
  type("rtu", "RTU", "Rooftop unit", ["Roof top unit"]),
];

describe("matchAssetType: tokens, abbreviations and aliases", () => {
  test.each([
    ["Boiler (condensing)", "boiler"],
    ["Boiler cond.", "boiler"],
    ["Chlr", "chiller"],
    ["Exh. fan", "exfan"],
    ["Backflow DCVA 2in", "backflow"],
    ['Backflow RPZ 4"', "backflow"],
  ])("C7001: %s is typed", (raw, id) => {
    expect(matchAssetType(raw, TYPES)).toBe(id);
  });

  test.each(["Water heater", "Sump pump", "Grease interceptor", "", "  "])("C7002: %j has no type of the org", (raw) => {
    expect(matchAssetType(raw, TYPES)).toBeNull();
  });

  test("C7002: an exact name, a code and a synonym still win", () => {
    expect(matchAssetType("rooftop unit", TYPES)).toBe("rtu");
    expect(matchAssetType("RTU", TYPES)).toBe("rtu");
    expect(matchAssetType("Roof top unit", TYPES)).toBe("rtu");
  });

  test("C7002: an exact name beats a longer name that also fits by tokens", () => {
    const types = [type("fan", "FAN", "Fan"), type("exfan", "EXFAN", "Exhaust fan")];
    expect(matchAssetType("Fan", types)).toBe("fan");
    expect(matchAssetType("Exhaust fan", types)).toBe("exfan");
    expect(matchAssetType("Exhaust fan (roof)", types)).toBe("exfan");
  });

  test.each([
    ["Boiler feed pump", "boiler"],
    ["Boiler room exhaust fan", "boiler"],
    ["Boiler water treatment tank", "boiler"],
  ])("C7002: %s is not typed as the shorter Boiler", (raw) => {
    expect(matchAssetType(raw, TYPES)).toBeNull();
  });

  test.each(["Sump pump", "Condensate pump", "Backflow pump", "Fan coil unit"])("C7002: %s is not typed as a one-word type that it only contains", (raw) => {
    const types = [type("pump", "PUMP", "Pump"), type("fan", "FAN", "Fan")];
    expect(matchAssetType(raw, types)).toBeNull();
  });

  test("C7001: an alias alone types the row, with no help from the words of the type", () => {
    expect(matchAssetType("DCVA 2in", TYPES)).toBe("backflow");
    expect(matchAssetType("RPZ", TYPES)).toBe("backflow");
    expect(matchAssetType("RPZ", TYPES.filter((t) => t.id !== "backflow"))).toBeNull();
  });

  test("C7001: a qualifier in brackets or marked with a period never blocks a match", () => {
    expect(matchAssetType("Chiller (water cooled)", TYPES)).toBe("chiller");
    expect(matchAssetType("Boiler cond.", TYPES)).toBe("boiler");
    expect(matchAssetType("Boiler gas", TYPES)).toBe("boiler");
  });

  test("C7003: a short form that fits two whole types gives no guess", () => {
    const types = [type("a", "XA", "Exhaust"), type("b", "XB", "Exhibit")];
    expect(matchAssetType("Exh.", types)).toBeNull();
  });

  test("C7003: two equally good types give no guess", () => {
    const types = [type("a", "BFP", "Boiler feed pump"), type("b", "BFT", "Boiler feed tank")];
    expect(matchAssetType("Boiler feed", types)).toBeNull();
  });
});

describe("splitQuantity", () => {
  test.each([
    ["VAV boxes (qty 24)", { label: "VAV boxes", qty: 24 }],
    ["VAV boxes qty: 24", { label: "VAV boxes", qty: 24 }],
    ["Exhaust fans x6", { label: "Exhaust fans", qty: 6 }],
    ["x 6 Exhaust fans", { label: "Exhaust fans", qty: 6 }],
    ["24 x VAV boxes", { label: "VAV boxes", qty: 24 }],
    ["Heat pumps (x 12)", { label: "Heat pumps", qty: 12 }],
  ])("C7004: %s", (raw, expected) => {
    expect(splitQuantity(raw)).toEqual(expected);
  });

  test.each(["VAV boxes", "Boiler 2", "Boiler (qty 1)", "VAV boxes (qty 51)", "VAV boxes (qty 500)", "", "qty 4"])("C7004: %j is not a quantity row", (raw) => {
    expect(splitQuantity(raw)).toBeNull();
  });
});
