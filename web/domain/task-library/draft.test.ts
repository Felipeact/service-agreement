import { describe, expect, test } from "vitest";
import { normalizeDraft } from "./draft";

const type = (over: Record<string, unknown> = {}) => ({
  name: "Pool pump",
  defaultVisitMonths: [4, 10],
  synonyms: ["pool pumps"],
  tasks: [{ description: "Check seals" }],
  ...over,
});

describe("normalizeDraft", () => {
  test("C3400: only valid pieces survive, and a type left with no task or month is dropped", () => {
    const kept = normalizeDraft({
      types: [
        type({ name: "  Pool pump  " }),
        type({ name: "x".repeat(61) }),
        type({ name: "---" }),
        type({ name: "Months", defaultVisitMonths: [9, 3, 3, 13, 0, 2.5, "x"] }),
        type({ name: "No months", defaultVisitMonths: [] }),
        type({ name: "Only bad months", defaultVisitMonths: [0, 13] }),
        type({ name: "Spellings", synonyms: ["Pool Pumps ", "pump", "pump", "", "y".repeat(61), "!!!", ...Array.from({ length: 12 }, (_, i) => `s${i}`)] }),
        type({ name: "Tasks", tasks: [{ description: "" }, { description: "a".repeat(201) }, { description: "b".repeat(200) }, { description: "  trimmed  " }, {}] }),
        type({ name: "No tasks", tasks: [] }),
        type({ name: "Only bad tasks", tasks: [{ description: "" }, { description: "a".repeat(201) }] }),
      ],
    });
    expect(kept.map((t) => t.name)).toEqual(["Pool pump", "Months", "Spellings", "Tasks"]);
    expect(kept[0]).toEqual({ name: "Pool pump", defaultVisitMonths: [4, 10], synonyms: ["pool pumps"], tasks: [{ description: "Check seals" }] });
    expect(kept[1].defaultVisitMonths).toEqual([3, 9]);
    expect(kept[2].synonyms).toEqual(["pool pumps", "pump", "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
    expect(kept[3].tasks.map((t) => t.description)).toEqual(["b".repeat(200), "trimmed"]);
  });

  test("C3400: anything that is not a list of types is an empty draft", () => {
    for (const raw of [null, undefined, "x", 3, [], {}, { types: "x" }, { types: [null, 4, "x"] }]) expect(normalizeDraft(raw)).toEqual([]);
  });

  test("C3401: a duplicate name ignoring case keeps the first, 30 types are kept of 31, 15 tasks of 17", () => {
    const dup = normalizeDraft({ types: [type({ name: "Valve" }), type({ name: "VALVE", defaultVisitMonths: [1] }), type({ name: "valve " })] });
    expect(dup).toHaveLength(1);
    expect(dup[0].defaultVisitMonths).toEqual([4, 10]);

    const many = normalizeDraft({ types: Array.from({ length: 31 }, (_, i) => type({ name: `Type ${i + 1}` })) });
    expect(many).toHaveLength(30);
    expect(many.at(-1)?.name).toBe("Type 30");

    const tasks = Array.from({ length: 17 }, (_, i) => ({ description: `Task ${i + 1}` }));
    const cut = normalizeDraft({ types: [type({ tasks })] });
    expect(cut[0].tasks).toHaveLength(15);
    expect(cut[0].tasks.at(-1)?.description).toBe("Task 15");
  });

  test("C3401: an invalid first type does not block a later one with the same name", () => {
    const kept = normalizeDraft({ types: [type({ name: "Valve", tasks: [] }), type({ name: "valve" })] });
    expect(kept.map((t) => t.name)).toEqual(["valve"]);
  });

  test("C3402: when every type is invalid the draft is empty", () => {
    expect(normalizeDraft({ types: [type({ name: "" }), type({ tasks: [] }), type({ defaultVisitMonths: [] })] })).toEqual([]);
  });
});
