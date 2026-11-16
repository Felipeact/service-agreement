import { describe, expect, test } from "vitest";
import { parseScopeDraft } from "./scope-controls";

describe("parseScopeDraft", () => {
  test("C6013: reads controls and uncovered types from a live scope document", () => {
    const draft = parseScopeDraft({
      schema: 2,
      types: [],
      uncovered: [{ code: "BOILER", name: "Boiler", assetCount: 3 }],
      controls: [{ assetId: "a1", typeCode: "RTU", typeName: "Rooftop unit", unitNo: "RTU-1", typeModel: null, location: "Roof", excluded: true }],
    });
    expect(draft.uncovered).toEqual([{ code: "BOILER", name: "Boiler", assetCount: 3 }]);
    expect(draft.controls).toEqual([{ assetId: "a1", typeCode: "RTU", typeName: "Rooftop unit", unitNo: "RTU-1", typeModel: null, location: "Roof", excluded: true }]);
  });

  test.each([null, {}, "x", [], { controls: "x", uncovered: 3 }])("C6013: %j gives empty lists", (document) => {
    expect(parseScopeDraft(document)).toEqual({ controls: [], uncovered: [] });
  });

  test("C6013: a malformed row is dropped and the good one kept", () => {
    const draft = parseScopeDraft({
      controls: [{ assetId: "a1" }, { assetId: "a2", typeCode: "RTU", typeName: "RTU", unitNo: null, typeModel: null, location: null, excluded: false }],
      uncovered: [{ code: "X" }, { code: "CH", name: "Chiller", assetCount: 1 }],
    });
    expect(draft.controls.map((c) => c.assetId)).toEqual(["a2"]);
    expect(draft.uncovered.map((u) => u.code)).toEqual(["CH"]);
  });
});
