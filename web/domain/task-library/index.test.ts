import { describe, expect, test } from "vitest";
import { pickType, validateTaskLibraryType, validateTypeName, TYPE_NAME_MESSAGE, type LibraryType, type TaskLibraryInput } from "./index";

const type = (code: string): LibraryType => ({ id: `id-${code}`, code, name: code, pack: null, defaultVisitMonths: [3, 6, 9, 12], tasks: [] });
const TYPES = [type("BOILER"), type("RTU")];

const input = (patch: Partial<TaskLibraryInput> = {}): TaskLibraryInput => ({
  typeCode: "RTU",
  defaultVisitMonths: ["3", "6", "9", "12"],
  tasks: [{ description: "Inspect belts", visitMonths: [] }],
  ...patch,
});
const task = (description: string, visitMonths: string[] = []) => ({ description, visitMonths });

describe("pickType", () => {
  test.each([
    ["an existing code", "RTU", "RTU"],
    ["an unknown code", "NOPE", "BOILER"],
    ["undefined", undefined, "BOILER"],
    ["an empty string", "", "BOILER"],
    ["a repeated parameter", ["RTU", "BOILER"], "BOILER"],
  ])("C1410: %s picks %s", (_label, code, expected) => {
    expect(pickType(TYPES, code)?.code).toBe(expected);
  });

  test("C1410: an empty list picks nothing", () => {
    expect(pickType([], "RTU")).toBeNull();
  });
});

describe("validateTaskLibraryType, default months", () => {
  test("C1417: valid months come back as ascending numbers", () => {
    const result = validateTaskLibraryType(input());
    expect(result).toMatchObject({ ok: true, value: { defaultVisitMonths: [3, 6, 9, 12] } });
  });

  test.each([
    ["empty", []],
    ["unsorted", ["6", "3"]],
    ["duplicated", ["3", "3"]],
    ["zero", ["0"]],
    ["thirteen", ["13"]],
  ])("C1418: %s default months are invalid", (_label, months) => {
    const result = validateTaskLibraryType(input({ defaultVisitMonths: months }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.defaultVisitMonths).toBeTruthy();
  });
});

describe("validateTaskLibraryType, tasks", () => {
  test("C1422: tasks keep their order, descriptions are trimmed, no months means every visit", () => {
    const result = validateTaskLibraryType(input({ tasks: [task("  Cooling start-up  ", ["3", "4", "5"]), task("Inspect belts")] }));
    expect(result).toMatchObject({
      ok: true,
      value: {
        tasks: [
          { description: "Cooling start-up", visitMonths: [3, 4, 5] },
          { description: "Inspect belts", visitMonths: null },
        ],
      },
    });
  });

  test.each([
    ["empty", "", false],
    ["blank", "   ", false],
    ["one character", "a", true],
    ["200 characters", "a".repeat(200), true],
    ["201 characters", "a".repeat(201), false],
  ])("C1423: a %s description is accepted: %s", (_label, description, accepted) => {
    const result = validateTaskLibraryType(input({ tasks: [task("Fine"), task(description)] }));
    expect(result.ok).toBe(accepted);
    if (!result.ok) expect(result.errors.rows?.[1]?.description).toBeTruthy();
  });

  test("C1424: 40 tasks are accepted", () => {
    const tasks = Array.from({ length: 40 }, (_, index) => task(`Task ${index}`));
    expect(validateTaskLibraryType(input({ tasks })).ok).toBe(true);
  });

  test("C1424: 41 tasks are invalid with an error on tasks", () => {
    const tasks = Array.from({ length: 41 }, (_, index) => task(`Task ${index}`));
    const result = validateTaskLibraryType(input({ tasks }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.tasks).toBeTruthy();
  });

  test.each([
    ["zero", ["0"]],
    ["thirteen", ["13"]],
    ["duplicated", ["3", "3"]],
    ["unsorted", ["6", "3"]],
    ["non-numeric", ["x"]],
  ])("C1425: a task with %s months is invalid on its row", (_label, months) => {
    const result = validateTaskLibraryType(input({ tasks: [task("Fine"), task("Seasonal", months)] }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.rows?.[1]?.visitMonths).toBeTruthy();
    expect(!result.ok && result.errors.rows?.[0]).toBeUndefined();
  });
});

describe("validateTypeName", () => {
  test.each([["empty", ""], ["spaces", "   "], ["61 characters", "a".repeat(61)], ["no letter or number", "--- !!!"]])(
    "C1906: %s is refused with the message",
    (_label, raw) => {
      expect(validateTypeName(raw)).toEqual({ ok: false, message: "Name the type in 1 to 60 characters, with at least one letter or number" });
      expect(TYPE_NAME_MESSAGE).toBe("Name the type in 1 to 60 characters, with at least one letter or number");
    },
  );

  test("C1906: the name comes back trimmed, and 60 characters are allowed", () => {
    expect(validateTypeName("  Sump pump  ")).toEqual({ ok: true, name: "Sump pump" });
    expect(validateTypeName("a".repeat(60))).toEqual({ ok: true, name: "a".repeat(60) });
  });
});
