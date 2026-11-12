import { describe, expect, test } from "vitest";
import { validateDraft, validateTrade, type DraftType } from ".";

const type = (over: Partial<DraftType> = {}): DraftType => ({ name: "Termite inspection", months: [3, 9], tasks: ["Check bait stations"], ...over });
const many = (n: number) => Array.from({ length: n }, (_, i) => type({ name: `Type ${i + 1}` }));

describe("validateDraft", () => {
  test("C4102: every bound is accepted at its edge and refused one past it", () => {
    const cases: [string, unknown, boolean][] = [
      ["types 0", [], false],
      ["types 1", many(1), true],
      ["types 40", many(40), true],
      ["types 41", many(41), false],
      ["name 0", [type({ name: "" })], false],
      ["name 1", [type({ name: "A" })], true],
      ["name 60", [type({ name: "A".repeat(60) })], true],
      ["name 61", [type({ name: "A".repeat(61) })], false],
      ["months count 0", [type({ months: [] })], false],
      ["months count 1", [type({ months: [6] })], true],
      ["months count 12", [type({ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] })], true],
      ["months count 13", [type({ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12] })], false],
      ["month value 0", [type({ months: [0] })], false],
      ["month value 1", [type({ months: [1] })], true],
      ["month value 12", [type({ months: [12] })], true],
      ["month value 13", [type({ months: [13] })], false],
      ["tasks 0", [type({ tasks: [] })], true],
      ["tasks 12", [type({ tasks: Array.from({ length: 12 }, (_, i) => `Task ${i}`) })], true],
      ["tasks 13", [type({ tasks: Array.from({ length: 13 }, (_, i) => `Task ${i}`) })], false],
      ["task length 0", [type({ tasks: [""] })], false],
      ["task length 1", [type({ tasks: ["A"] })], true],
      ["task length 200", [type({ tasks: ["A".repeat(200)] })], true],
      ["task length 201", [type({ tasks: ["A".repeat(201)] })], false],
    ];
    for (const [label, input, ok] of cases) expect(validateDraft(input) !== null, label).toBe(ok);
  });

  test("C4102: names equal ignoring case are refused; months come back sorted without repeats", () => {
    expect(validateDraft([type({ name: "Gutters" }), type({ name: "gutters" })])).toBeNull();
    expect(validateDraft([type({ months: [9, 3, 3] })])?.[0].months).toEqual([3, 9]);
  });

  test("C4102: a non-array, a non-object type and a non-integer month are refused", () => {
    expect(validateDraft("x")).toBeNull();
    expect(validateDraft([null])).toBeNull();
    expect(validateDraft([type({ months: [1.5] })])).toBeNull();
  });
});

describe("validateTrade", () => {
  test("C4103: empty, 61 characters and a semicolon are refused; 1, 60 and the whole alphabet pass", () => {
    expect(validateTrade("")).toBeNull();
    expect(validateTrade("   ")).toBeNull();
    expect(validateTrade("a".repeat(61))).toBeNull();
    expect(validateTrade("pest;control")).toBeNull();
    expect(validateTrade("a")).toBe("a");
    expect(validateTrade("a".repeat(60))).toBe("a".repeat(60));
    expect(validateTrade("Pest control, A&B / it's-ok")).toBe("Pest control, A&B / it's-ok");
  });
});
