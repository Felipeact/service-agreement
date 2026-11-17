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

  test.each(["Boiler pump.", "Chiller pump.", "Boiler tank.", "Exhaust fan motor.", "Pump motor."])("C7002: %s is not explained by a period alone", (raw) => {
    const types = [...TYPES, type("pump", "PUMP", "Pump")];
    expect(matchAssetType(raw, types)).toBeNull();
  });

  test.each(["RPZ pump", "Pump RPZ", "Pump BF", "Boiler RPZ", "Boiler DCVA 2in", "Boiler PVB", "Chiller RPZ"])("C7002: an alias only explains its own family, so %s is not typed", (raw) => {
    const types = [...TYPES, type("pump", "PUMP", "Pump")];
    expect(matchAssetType(raw, types)).toBeNull();
  });

  test.each(["Boiler (feed pump)", "Boiler (sump pump)", "Boiler (water heater)", "Chiller (pump)"])("C7002: bracketed equipment words keep the row for the review: %s", (raw) => {
    expect(matchAssetType(raw, TYPES)).toBeNull();
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

describe("matchAssetType: the gaps a tester found", () => {
  const MORE = [
    ...TYPES,
    type("fcu", "FAN_COIL", "Fan coil", ["fcu"]),
    type("fire", "FIRE_DAMPER", "Fire damper"),
    type("vrf", "VRF", "VRF (outdoor unit)"),
    type("erv", "ERV", "ERV", ["energy recovery ventilator"]),
    type("pump", "PUMP", "Pump", ["circulating pump"]),
    type("uhg", "UH_GAS", "Unit heater (gas)"),
    type("uhe", "UH_ELEC", "Unit heater (electric)"),
  ];

  test.each([
    ["Fire dampers", "fire"],
    ["FCU", "fcu"],
    ["VRV", "vrf"],
    ["Inline pump", "pump"],
    ["In-line pump", "pump"],
    ["Unit heater gas fired", "uhg"],
    ["Energy recovery ventilator (ERV)", "erv"],
    ["Ventilateur d'extraction", "exfan"],
    ["Chaudière", "boiler"],
    ["Registre coupe-feu", "fire"],
    ["Pompe", "pump"],
    ["Boilers", "boiler"],
  ])("%s is typed", (raw, id) => {
    expect(matchAssetType(raw, MORE)).toBe(id);
  });

  test.each(["Sump pump", "Pompe de puisard", "Boiler (feed pump)", "Unit heater"])("%s is still left for the review", (raw) => {
    expect(matchAssetType(raw, MORE)).toBeNull();
  });
});

describe("splitQuantity: a plural with a bare count", () => {
  test.each([
    ["Fire dampers 40", "Fire dampers", 40],
    ["WSHP x6", "WSHP", 6],
  ])("%s", (raw, label, qty) => {
    expect(splitQuantity(raw)).toEqual({ label, qty });
  });

  test.each(["Boiler 2", "Chassis 4", "Fire dampers 1", "Fire dampers 80", "RTU-3"])("%s is one row", (raw) => {
    expect(splitQuantity(raw)).toBeNull();
  });
});
