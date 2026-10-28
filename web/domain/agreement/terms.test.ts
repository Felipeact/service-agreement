import { describe, expect, test } from "vitest";
import { parseTerms } from "./index";

const TERMS = {
  repairDiscountPct: 10,
  cpiCapPct: 5,
  cancellationNoticeDays: 30,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: "GST extra",
};

describe("parseTerms", () => {
  test("C936: the six-key document is accepted from a snapshot", () => {
    expect(parseTerms({ schema: 1, types: [], terms: TERMS })).toEqual(TERMS);
  });

  test("C936: the four nullable terms may be JSON null", () => {
    const bare = { ...TERMS, cancellationNoticeDays: null, paymentDays: null, governingProvince: null, taxNote: null };
    expect(parseTerms({ terms: bare })).toEqual(bare);
  });

  const withoutCpi = Object.fromEntries(Object.entries(TERMS).filter(([key]) => key !== "cpiCapPct"));
  test.each<[string, unknown]>([
    ["a missing key", { terms: withoutCpi }],
    ["a string percent", { terms: { ...TERMS, repairDiscountPct: "10" } }],
    ["a negative day count", { terms: { ...TERMS, paymentDays: -1 } }],
    ["terms an array", { terms: [TERMS] }],
    ["terms absent", { schema: 1, types: [] }],
  ])("C936: %s gives null", (_name, snapshot) => {
    expect(parseTerms(snapshot)).toBeNull();
  });

  test("C936: a snapshot that is not an object gives null", () => {
    expect(parseTerms(null)).toBeNull();
    expect(parseTerms({})).toBeNull();
  });
});
