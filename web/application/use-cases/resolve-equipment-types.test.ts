import { describe, expect, test, vi } from "vitest";
import type { EquipmentTypeCreator, TypeSuggester } from "@/application/ports";
import { makeResolveEquipmentTypes } from "./resolve-equipment-types";

const RTU = { id: "t-rtu", code: "RTU", name: "Rooftop unit", synonyms: ["Carrier rooftop"] };
const FAN = { id: "t-fan", code: "EXHAUST_FAN", name: "Exhaust fan", synonyms: [] };

function setup(over: { suggest?: TypeSuggester["suggest"]; create?: EquipmentTypeCreator["create"]; types?: (typeof RTU)[] } = {}) {
  const suggest = vi.fn<TypeSuggester["suggest"]>(over.suggest ?? (async () => ({ ok: true, suggestions: [] })));
  const create = vi.fn<EquipmentTypeCreator["create"]>(
    over.create ?? (async (_org, name) => ({ ok: true, type: { id: `new-${name}`, code: name.toUpperCase().replace(/\W+/g, "_"), name, created: true } })),
  );
  const resolve = makeResolveEquipmentTypes({
    catalog: { list: async () => over.types ?? [RTU, FAN], tradeContext: async () => "HVAC" },
    suggester: { suggest },
    creator: { create },
  });
  return { resolve, suggest, create };
}

describe("resolveEquipmentTypes", () => {
  test("a wording the catalog already knows is matched and nothing is asked or created", async () => {
    const { resolve, suggest, create } = setup();
    const { byKey, failed } = await resolve("org", ["Rooftop unit", "Carrier rooftop"]);
    expect(byKey.get("rooftop unit")).toMatchObject({ typeId: "t-rtu", created: false });
    expect(byKey.get("carrier rooftop")).toMatchObject({ typeId: "t-rtu" });
    expect(failed).toEqual([]);
    expect(suggest).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  test("the model's pick among the catalog's types is used, and an invented code is not", async () => {
    const { resolve, create } = setup({
      suggest: async () => ({
        ok: true,
        suggestions: [
          { spelling: "Kitchen exhaust fan NCA14FA", typeCode: "EXHAUST_FAN", confidence: "high" },
          { spelling: "Mystery thing", typeCode: "NOT_A_TYPE", confidence: "high", newType: { name: "Mystery equipment", months: [4, 10] } },
        ],
      }),
    });
    const { byKey } = await resolve("org", ["Kitchen exhaust fan NCA14FA", "Mystery thing"]);
    expect(byKey.get("kitchen exhaust fan nca14fa")).toMatchObject({ typeId: "t-fan", created: false });
    expect(create).toHaveBeenCalledWith("org", "Mystery equipment", [4, 10]);
    expect(byKey.get("mystery thing")).toMatchObject({ name: "Mystery equipment", created: true });
  });

  test("a wording no type fits becomes a NEW type with the model's name and months", async () => {
    const { resolve, create } = setup({
      suggest: async () => ({ ok: true, suggestions: [{ spelling: "Captive Aire MUA A2-D.500", typeCode: null, confidence: "medium", newType: { name: "Make-up air unit", months: [3, 6, 9, 12] } }] }),
    });
    const { byKey } = await resolve("org", ["Captive Aire MUA A2-D.500"]);
    expect(create).toHaveBeenCalledWith("org", "Make-up air unit", [3, 6, 9, 12]);
    expect(byKey.get("captive aire mua a2 d 500")).toMatchObject({ name: "Make-up air unit", created: true });
  });

  test("two wordings the model names alike share one new type", async () => {
    const { resolve, create } = setup({
      suggest: async () => ({
        ok: true,
        suggestions: [
          { spelling: "MUA 1", typeCode: null, confidence: "high", newType: { name: "Make-up air unit", months: [] } },
          { spelling: "Make up air", typeCode: null, confidence: "high", newType: { name: "make-up air unit", months: [] } },
        ],
      }),
    });
    const { byKey } = await resolve("org", ["MUA 1", "Make up air"]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(byKey.get("mua 1")?.typeId).toBe(byKey.get("make up air")?.typeId);
  });

  test("when the model is unavailable the tidied wording becomes the type, so nothing blocks", async () => {
    const { resolve, create } = setup({ suggest: async () => ({ ok: false, code: "unavailable" }) });
    const { byKey, failed } = await resolve("org", ["Condensing unit (roof, east)"]);
    expect(create).toHaveBeenCalledWith("org", "Condensing unit", []);
    expect(byKey.get("condensing unit roof east")).toMatchObject({ name: "Condensing unit" });
    expect(failed).toEqual([]);
  });

  test("a row with no wording at all gets the fallback type", async () => {
    const { resolve, create } = setup();
    const { byKey } = await resolve("org", [null, "  "]);
    expect(create).toHaveBeenCalledWith("org", "Other equipment", []);
    expect(byKey.get("")).toMatchObject({ name: "Other equipment" });
  });

  test("a creation the member may not make, or a catalog that cannot be read, is reported, not thrown", async () => {
    const refused = setup({ create: async () => ({ ok: false, code: "forbidden" }) });
    expect((await refused.resolve("org", ["Sump pump"])).failed).toEqual(["Sump pump"]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = makeResolveEquipmentTypes({
      catalog: { list: async () => Promise.reject(new Error("down")), tradeContext: async () => null },
      suggester: { suggest: async () => ({ ok: true, suggestions: [] }) },
      creator: { create: async () => ({ ok: false, code: "unavailable" }) },
    });
    expect((await broken("org", ["Sump pump"])).failed).toEqual(["Sump pump"]);
  });
});
