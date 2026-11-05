import { describe, expect, test } from "vitest";
import { parseServiceScope } from "./index";

const asset = (unitNo: string | null) => ({ unitNo, typeModel: null, location: null });
const type = (name: string, over: Record<string, unknown> = {}) => ({ code: name.toUpperCase(), name, tasks: [], assets: [], ...over });

describe("parseServiceScope", () => {
  test("C803: types by name and units as numbers, no unit last, tasks as stored", () => {
    const scope = parseServiceScope({
      schema: 1,
      types: [
        type("Unit heater (gas)"),
        type("AHU", { tasks: ["Replace filters", "Check belts"], assets: [asset("RTU-10"), asset("RTU-2"), asset(null), asset("rtu-1")] }),
        type("boiler"),
      ],
    });
    expect(scope?.types.map((t) => t.name)).toEqual(["AHU", "boiler", "Unit heater (gas)"]);
    expect(scope?.types[0].assets.map((a) => a.unitNo)).toEqual(["rtu-1", "RTU-2", "RTU-10", null]);
    expect(scope?.types[0].tasks).toEqual([
      { description: "Replace filters", visitMonths: null },
      { description: "Check belts", visitMonths: null },
    ]);
    expect(scope?.takenAt).toBeNull();
  });

  test("C803: a frozen document carries when it was taken", () => {
    const scope = parseServiceScope({ schema: 1, types: [], takenAt: "2026-10-27T18:00:00.123456+00:00" });
    expect(scope?.takenAt).toBe("2026-10-27T18:00:00.123456+00:00");
  });

  test.each<[string, unknown]>([
    ["{}", {}],
    ["schema 3", { schema: 3, types: [] }],
    ["no types", { schema: 1 }],
    ["types not an array", { schema: 1, types: 3 }],
    ["a type with no name", { schema: 1, types: [{ code: "RTU", tasks: [], assets: [] }] }],
    ["a task that is not a string", { schema: 1, types: [type("RTU", { tasks: [1] })] }],
    ["an asset that is not an object", { schema: 1, types: [type("RTU", { assets: ["RTU-1"] })] }],
    ["a takenAt that is not a time", { schema: 1, types: [], takenAt: "yesterday" }],
    ["a takenAt that is not text, though Date.parse would read it", { schema: 1, types: [], takenAt: 2026 }],
    ["a takenAt that is a list", { schema: 1, types: [], takenAt: ["2026-10-27"] }],
    ["a code that is not text", { schema: 1, types: [type("RTU", { code: 7 })] }],
    ["tasks that are not a list", { schema: 1, types: [type("RTU", { tasks: "Replace filters" })] }],
    ["assets that are not a list", { schema: 1, types: [type("RTU", { assets: { unitNo: "RTU-1" } })] }],
    ["a unit # that is neither text nor null", { schema: 1, types: [type("RTU", { assets: [{ unitNo: 1, typeModel: null, location: null }] })] }],
    ["a type/model that is neither text nor null", { schema: 1, types: [type("RTU", { assets: [{ unitNo: "RTU-1", typeModel: 2, location: null }] })] }],
    ["a location that is neither text nor null", { schema: 1, types: [type("RTU", { assets: [{ unitNo: "RTU-1", typeModel: null, location: false }] })] }],
    ["an asset with a field missing", { schema: 1, types: [type("RTU", { assets: [{ unitNo: "RTU-1", typeModel: null }] })] }],
  ])("C803: %s is not a scope", (_, document) => {
    expect(parseServiceScope(document)).toBeNull();
  });
});
