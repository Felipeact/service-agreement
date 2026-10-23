import { describe, expect, test } from "vitest";
import { cents, lineAnnualCents, sumCents, type Cents } from "./index";

const MAX = Number.MAX_SAFE_INTEGER;

describe("money in integer cents", () => {
  test("C27: cents returns non-negative safe integers unchanged", () => {
    expect(cents(0)).toBe(0);
    expect(cents(1428050)).toBe(1428050);
  });

  test.each([-1, 0.5, NaN, Infinity, MAX + 1])("C28: cents(%s) throws RangeError", (value) => {
    expect(() => cents(value)).toThrow(RangeError);
  });

  test("C28: cents accepts Number.MAX_SAFE_INTEGER", () => {
    expect(cents(MAX)).toBe(MAX);
  });

  test("C29: lineAnnualCents multiplies visits by cost per visit", () => {
    expect(lineAnnualCents(4, cents(357000))).toBe(1428000);
  });

  test.each([0, -1, 1.5])("C30: lineAnnualCents with %s visits throws RangeError", (visits) => {
    expect(() => lineAnnualCents(visits, cents(100))).toThrow(RangeError);
  });

  test("C30: lineAnnualCents throws RangeError when the product is above the safe range", () => {
    expect(() => lineAnnualCents(2, cents(MAX))).toThrow(RangeError);
  });

  test("C31: sumCents adds, returns 0 for an empty list, and throws above the safe range", () => {
    expect(sumCents([])).toBe(0);
    expect(sumCents([cents(1428000), cents(50)])).toBe(1428050);
    expect(() => sumCents([cents(MAX), cents(1)])).toThrow(RangeError);
  });

  test("C36: a plain number is not Cents", () => {
    // @ts-expect-error a bare number must go through cents() first
    const amount: Cents = 100;
    expect(amount).toBe(100);
  });
});
