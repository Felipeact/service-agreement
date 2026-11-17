import { describe, expect, test, vi } from "vitest";
import type { AssetTypeCatalog, TypeSuggester } from "@/application/ports";
import { makeSuggestImportTypes } from "./suggest-import-types";

const TYPES = [
  { id: "t-fcu", code: "FAN_COIL", name: "Fan coil", synonyms: [] },
  { id: "t-vrf", code: "VRF", name: "VRF", synonyms: [] },
];
const catalog = (over: Partial<AssetTypeCatalog> = {}): AssetTypeCatalog => ({ list: async () => TYPES, tradeContext: async () => "HVAC", ...over }) as AssetTypeCatalog;
const SPELLINGS = [
  { key: "fcu", raw: "FCU" },
  { key: "vrv", raw: "VRV" },
  { key: "sump pump", raw: "Sump pump" },
];

describe("suggestImportTypes", () => {
  test("a suggestion is kept for each spelling asked about whose code the org has, with its confidence", async () => {
    const suggest = vi.fn<TypeSuggester["suggest"]>(async () => ({
      ok: true,
      suggestions: [
        { spelling: "FCU", typeCode: "FAN_COIL", confidence: "high" },
        { spelling: "VRV", typeCode: "VRF", confidence: "medium" },
        { spelling: "Sump pump", typeCode: null, confidence: "low" },
        { spelling: "Never asked", typeCode: "VRF", confidence: "high" },
      ],
    }));
    const result = await makeSuggestImportTypes(catalog(), { suggest })(SPELLINGS);
    expect(result).toEqual({
      ok: true,
      suggestions: [
        { key: "fcu", typeId: "t-fcu", confidence: "high" },
        { key: "vrv", typeId: "t-vrf", confidence: "medium" },
      ],
    });
    // Only the spellings and the type names and codes leave.
    expect(suggest).toHaveBeenCalledWith(["FCU", "VRV", "Sump pump"], [{ code: "FAN_COIL", name: "Fan coil" }, { code: "VRF", name: "VRF" }], "HVAC");
  });

  test("a code the org does not have is dropped, matched case-insensitively by the spelling's key", async () => {
    const suggest: TypeSuggester["suggest"] = async () => ({
      ok: true,
      suggestions: [
        { spelling: "fcu", typeCode: "MADE_UP", confidence: "high" },
        { spelling: "V.R.V.", typeCode: "VRF", confidence: "high" },
      ],
    });
    const result = await makeSuggestImportTypes(catalog(), { suggest })(SPELLINGS);
    expect(result).toEqual({ ok: true, suggestions: [] });
  });

  test("nothing to ask asks nothing, and an outage of the model or the catalog is unavailable", async () => {
    const suggest = vi.fn<TypeSuggester["suggest"]>();
    expect(await makeSuggestImportTypes(catalog(), { suggest })([])).toEqual({ ok: true, suggestions: [] });
    expect(suggest).not.toHaveBeenCalled();

    expect(await makeSuggestImportTypes(catalog(), { suggest: async () => ({ ok: false, code: "unavailable" }) })(SPELLINGS)).toEqual({ ok: false, code: "unavailable" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = catalog({ list: async () => { throw new Error("down"); } });
    expect(await makeSuggestImportTypes(broken, { suggest })(SPELLINGS)).toEqual({ ok: false, code: "unavailable" });
  });
});
