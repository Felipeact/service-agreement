import { describe, expect, test } from "vitest";
import { flagRows, pageOf, unmatchedSpellings, type ReviewFlag, type ReviewRow } from "./index";

const RTU = "type-rtu";
const MUA = "type-mua";

let next = 0;
function row(over: Partial<ReviewRow> = {}): ReviewRow {
  next += 1;
  return {
    id: `r${next}`,
    position: next,
    assetTypeRaw: "Rooftop unit",
    assetTypeId: RTU,
    unitNo: `U-${next}`,
    typeModel: null,
    location: null,
    confidence: "high",
    skipped: false,
    ...over,
  };
}

const flagsOf = (rows: ReviewRow[], site: { assetTypeId: string; unitNo: string | null }[] = []) => {
  const flags = flagRows(rows, site);
  return (r: ReviewRow): ReviewFlag[] => flags.get(r.id) ?? [];
};

describe("pager", () => {
  test.each([
    [120, "1", { page: 1, pages: 2, from: 1, to: 100 }],
    [120, "2", { page: 2, pages: 2, from: 101, to: 120 }],
    [100, "1", { page: 1, pages: 1, from: 1, to: 100 }],
    [101, "2", { page: 2, pages: 2, from: 101, to: 101 }],
    [120, "0", { page: 1, pages: 2, from: 1, to: 100 }],
    [120, "3", { page: 1, pages: 2, from: 1, to: 100 }],
    [120, "abc", { page: 1, pages: 2, from: 1, to: 100 }],
    [120, "1.5", { page: 1, pages: 2, from: 1, to: 100 }],
    [120, "-1", { page: 1, pages: 2, from: 1, to: 100 }],
    [120, undefined, { page: 1, pages: 2, from: 1, to: 100 }],
  ])("C604: %i rows, ?page=%s", (total, raw, expected) => {
    expect(pageOf(total, raw)).toEqual(expected);
  });
});

describe("flagger", () => {
  test("C609: an untyped included row needs a type; a clean typed row has no flag", () => {
    const untyped = row({ assetTypeId: null });
    const clean = row();
    const flags = flagsOf([untyped, clean]);
    expect(flags(untyped)).toEqual([{ kind: "needs_type" }]);
    expect(flags(clean)).toEqual([]);
  });

  test.each([
    ["unitNo", 40, null],
    ["unitNo", 41, "Unit #"],
    ["typeModel", 120, null],
    ["typeModel", 121, "Type/model"],
    ["location", 300, null],
    ["location", 301, "Location/access"],
  ] as const)("C610: %s of %i characters", (key, length, field) => {
    const r = row({ [key]: "x".repeat(length) });
    expect(flagsOf([r])(r)).toEqual(field ? [{ kind: "too_long", field }] : []);
  });

  test.each([
    ["low", [{ kind: "check" }]],
    ["medium", []],
    ["high", []],
  ] as const)("C611: confidence %s", (confidence, expected) => {
    const r = row({ confidence });
    expect(flagsOf([r])(r)).toEqual(expected);
  });

  test("C612: units read twice are flagged after the first, by normalized unit and type", () => {
    const a = row({ position: 1, unitNo: "RTU-1" });
    const b = row({ position: 3, unitNo: "rtu 1" });
    const c = row({ position: 5, unitNo: "Rtu_1" });
    const flags = flagsOf([c, a, b]);
    expect(flags(a)).toEqual([]);
    expect(flags(b)).toEqual([{ kind: "same_as", position: 1 }]);
    expect(flags(c)).toEqual([{ kind: "same_as", position: 1 }]);
  });

  test("C612: the same unit # of two types is not a duplicate", () => {
    const a = row({ unitNo: "1" });
    const b = row({ unitNo: "1", assetTypeId: MUA });
    const flags = flagsOf([a, b]);
    expect(flags(a)).toEqual([]);
    expect(flags(b)).toEqual([]);
  });

  test("C612: a skipped row is not the first of its key", () => {
    const a = row({ position: 1, unitNo: "RTU-1", skipped: true });
    const b = row({ position: 3, unitNo: "RTU-1" });
    const c = row({ position: 5, unitNo: "RTU-1" });
    const flags = flagsOf([a, b, c]);
    expect(flags(b)).toEqual([]);
    expect(flags(c)).toEqual([{ kind: "same_as", position: 3 }]);
  });

  test("C612: rows 2 and 7 sharing a key", () => {
    const a = row({ position: 2, unitNo: "AB" });
    const b = row({ position: 7, unitNo: "ab" });
    expect(flagsOf([a, b])(b)).toEqual([{ kind: "same_as", position: 2 }]);
  });

  test("C613: a unit already on the site, of the same type", () => {
    const rtu = row({ unitNo: "RTU 2" });
    const mua = row({ unitNo: "RTU 2", assetTypeId: MUA });
    const flags = flagsOf([rtu, mua], [{ assetTypeId: RTU, unitNo: "rtu-2" }]);
    expect(flags(rtu)).toEqual([{ kind: "on_site" }]);
    expect(flags(mua)).toEqual([]);
  });

  test("C614: a row with no unit # is never a duplicate", () => {
    const a = row({ unitNo: null });
    const b = row({ unitNo: null });
    const flags = flagsOf([a, b], [{ assetTypeId: RTU, unitNo: null }]);
    expect(flags(a)).toEqual([]);
    expect(flags(b)).toEqual([]);
  });

  test("C615: a skipped row has no flag", () => {
    const r = row({ skipped: true, assetTypeId: null, confidence: "low", unitNo: "x".repeat(41) });
    expect(flagsOf([r])(r)).toEqual([]);
  });
});

describe("spelling list", () => {
  test("C620: distinct spellings of included untyped rows, counted, most first", () => {
    const rows = [
      row({ position: 1, assetTypeId: null, assetTypeRaw: "Roof top HVAC" }),
      row({ position: 2, assetTypeId: null, assetTypeRaw: "Widget" }),
      row({ position: 3, assetTypeId: null, assetTypeRaw: "widget " }),
      row({ position: 4, assetTypeId: null, assetTypeRaw: "WIDGET" }),
      row({ position: 5, assetTypeId: null, assetTypeRaw: "roof-top hvac" }),
      row({ position: 6, assetTypeId: null, assetTypeRaw: null }),
      row({ position: 7, assetTypeId: null, assetTypeRaw: "Gizmo", skipped: true }),
      row({ position: 8, assetTypeRaw: "Widget" }),
    ];
    expect(unmatchedSpellings(rows)).toEqual([
      { key: "widget", raw: "Widget", count: 3 },
      { key: "roof top hvac", raw: "Roof top HVAC", count: 2 },
    ]);
  });
});
