import { describe, expect, test } from "vitest";
import type { OrgSettingsValue } from "../org-settings";
import { buildAgreementDocument, type DocumentSource } from "./document";
import { isUnreached, monthRunsLabel, parseServiceScope, taskLabel, visitSchedule, type ScopeType } from "./index";

const HEATING = [1, 2, 3, 10, 11, 12];
const COOLING = [4, 5, 6, 7, 8, 9];
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const HEAT_TASK = "Inspect heat exchanger during heating season";
const COOL_TASK = "Check compressor operation during cooling operation";

const doc2 = (tasks: unknown[]) => ({ schema: 2, types: [{ code: "RTU", name: "Rooftop unit", tasks, assets: [] }] });

describe("parseServiceScope, schema 1 and 2", () => {
  test("C1108: schema 1 text tasks read as tasks for every visit", () => {
    const scope = parseServiceScope({ schema: 1, types: [{ code: "RTU", name: "Rooftop unit", tasks: ["Replace filters", "Check belts"], assets: [] }] });
    expect(scope?.types[0].tasks).toEqual([
      { description: "Replace filters", visitMonths: null },
      { description: "Check belts", visitMonths: null },
    ]);
  });

  test.each<[string, unknown]>([
    ["schema 0", { schema: 0, types: [] }],
    ["schema 3", { schema: 3, types: [] }],
    ["schema as text", { schema: "2", types: [] }],
    ["a bare string task", doc2(["Replace filters"])],
    ["no visitMonths key", doc2([{ description: "Replace filters" }])],
    ["visitMonths []", doc2([{ description: "x", visitMonths: [] }])],
    ["visitMonths [6, 3]", doc2([{ description: "x", visitMonths: [6, 3] }])],
    ["visitMonths [3, 3]", doc2([{ description: "x", visitMonths: [3, 3] }])],
    ["visitMonths [0]", doc2([{ description: "x", visitMonths: [0] }])],
    ["visitMonths [13]", doc2([{ description: "x", visitMonths: [13] }])],
    ["visitMonths [1.5]", doc2([{ description: "x", visitMonths: [1.5] }])],
    ["visitMonths \"4\"", doc2([{ description: "x", visitMonths: "4" }])],
  ])("C1109: %s gives null", (_, document) => {
    expect(parseServiceScope(document)).toBeNull();
  });

  test("C1109: schema 2 tasks keep their months, or null", () => {
    const scope = parseServiceScope(doc2([
      { description: "Fall test", visitMonths: [4, 10] },
      { description: "Replace filters", visitMonths: null },
    ]));
    expect(scope?.types[0].tasks).toEqual([
      { description: "Fall test", visitMonths: [4, 10] },
      { description: "Replace filters", visitMonths: null },
    ]);
  });
});

describe("monthRunsLabel", () => {
  test.each<[number[], string]>([
    [[4, 5, 6, 7, 8, 9], "Apr–Sep"],
    [[1, 2, 3, 10, 11, 12], "Oct–Mar"],
    [[3, 4, 5], "Mar–May"],
    [[4, 10], "Apr, Oct"],
    [[6], "Jun"],
    [[1, 2], "Jan, Feb"],
    [[12, 1], "Dec, Jan"],
    [[1, 2, 3, 5], "Jan–Mar, May"],
    [[12, 1, 3], "Dec, Jan, Mar"],
  ])("C1111: %j reads %s", (months, label) => {
    expect(monthRunsLabel(months)).toBe(label);
  });

  test("C1111: the dash is an en dash", () => {
    expect(monthRunsLabel(COOLING)).toContain("–");
  });
});

describe("taskLabel", () => {
  test("C1112: months in parentheses, none for every visit or all twelve", () => {
    expect(taskLabel({ description: "Check belts", visitMonths: COOLING })).toBe("Check belts (Apr–Sep visits)");
    expect(taskLabel({ description: "Replace filters", visitMonths: null })).toBe("Replace filters");
    expect(taskLabel({ description: "Replace filters", visitMonths: ALL })).toBe("Replace filters");
  });
});

const rtuLine = (visitMonths: number[]) => ({ visitMonths, equipment: [{ code: "RTU", name: "Rooftop unit" }] });

describe("isUnreached", () => {
  const heat = { description: HEAT_TASK, visitMonths: HEATING };

  test("C1116: no covering visit in the task's months is unreached; one is reached", () => {
    expect(isUnreached(heat, "RTU", [rtuLine([6])])).toBe(true);
    expect(isUnreached(heat, "RTU", [rtuLine([3, 6, 9, 12])])).toBe(false);
  });

  test("C1116: a type no line covers is unreached", () => {
    expect(isUnreached(heat, "RTU", [{ visitMonths: [3], equipment: [{ code: "AHU", name: "Air handling unit" }] }])).toBe(true);
  });

  test("C1116: a task for every visit, or all twelve months, is never unreached", () => {
    expect(isUnreached({ description: "x", visitMonths: null }, "RTU", [])).toBe(false);
    expect(isUnreached({ description: "x", visitMonths: ALL }, "RTU", [])).toBe(false);
  });

  test("C1116: two lines covering the type, {6} and {12}, reach it", () => {
    expect(isUnreached(heat, "RTU", [rtuLine([6]), rtuLine([12])])).toBe(false);
  });
});

const TYPES: ScopeType[] = [
  {
    code: "RTU",
    name: "Rooftop unit",
    tasks: [
      { description: "Replace filters", visitMonths: null },
      { description: "Check belts", visitMonths: null },
      { description: HEAT_TASK, visitMonths: HEATING },
      { description: COOL_TASK, visitMonths: COOLING },
    ],
    assets: [],
  },
  { code: "AHU", name: "Air handling unit", tasks: [{ description: "Belts", visitMonths: ALL }], assets: [] },
  { code: "BOILER", name: "Boiler", tasks: [{ description: "Fall test", visitMonths: [10] }], assets: [] },
  { code: "CHILLER", name: "Chiller", tasks: [{ description: "Spring check", visitMonths: [3] }], assets: [] },
];
const HVAC = { visitMonths: [3, 6, 9, 12], equipment: [{ code: "RTU", name: "Rooftop unit" }, { code: "AHU", name: "Air handling unit" }] };
const BOILER = { visitMonths: [10], equipment: [{ code: "BOILER", name: "Boiler" }] };
const tasksByMonth = (rows: ReturnType<typeof visitSchedule>) => Object.fromEntries(rows.map((row) => [row.month, row.tasks]));

describe("visitSchedule, seasonal tasks", () => {
  test("C1118: a task is listed where its months meet a covering line's visits", () => {
    const heat = [{ type: "Rooftop unit", description: HEAT_TASK }];
    const cool = [{ type: "Rooftop unit", description: COOL_TASK }];
    expect(tasksByMonth(visitSchedule([HVAC, BOILER], TYPES))).toEqual({
      3: heat,
      6: cool,
      9: cool,
      10: [{ type: "Boiler", description: "Fall test" }],
      12: heat,
    });
  });

  test("C1118: a second line visiting March does not list the task twice", () => {
    const march = visitSchedule([HVAC, BOILER, rtuLine([3])], TYPES).find((row) => row.month === 3);
    expect(march?.tasks).toEqual([{ type: "Rooftop unit", description: HEAT_TASK }]);
  });

  test("C1119: by type name, then task position", () => {
    const types: ScopeType[] = [
      { code: "RTU", name: "Rooftop unit", tasks: [{ description: "R", visitMonths: [3] }], assets: [] },
      {
        code: "AHU",
        name: "Air handling unit",
        tasks: [
          { description: "A first", visitMonths: [3] },
          { description: "A second", visitMonths: [3, 4] },
        ],
        assets: [],
      },
    ];
    expect(visitSchedule([HVAC], types)[0].tasks).toEqual([
      { type: "Air handling unit", description: "A first" },
      { type: "Air handling unit", description: "A second" },
      { type: "Rooftop unit", description: "R" },
    ]);
  });

  test("C1124: a scope read from schema 1 lists no tasks", () => {
    const scope = parseServiceScope({
      schema: 1,
      types: [{ code: "RTU", name: "Rooftop unit", tasks: [HEAT_TASK, COOL_TASK], assets: [] }],
    });
    const rows = visitSchedule([HVAC, BOILER], scope?.types ?? []);
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.tasks.length === 0)).toBe(true);
  });
});

describe("buildAgreementDocument, seasonal tasks", () => {
  const SETTINGS: OrgSettingsValue = {
    legalName: "Kettle Ridge Mechanical Ltd.",
    address: null,
    phone: null,
    accentColor: null,
    repairDiscountPct: 10,
    cpiCapPct: 5,
    cancellationNoticeDays: null,
    paymentDays: null,
    governingProvince: null,
    taxNote: null,
  };
  const line = (description: string, l: typeof HVAC) => ({ description, visitsPerYear: l.visitMonths.length, costPerVisitCents: 100, annualCents: 100 * l.visitMonths.length, ...l });
  const source: DocumentSource = {
    number: "AG-1052",
    customer: { name: "Fernwood Dental" },
    site: { name: "Main" },
    editable: true,
    shown: { versionNo: 1, lines: [line("HVAC", HVAC), line("Boiler", BOILER)], annualCents: 500 },
    serviceScope: { source: "live", takenAt: null, types: TYPES },
    terms: null,
  };

  test("C1122: the document's schedule carries the scope's seasonal tasks", () => {
    expect(buildAgreementDocument(source, SETTINGS).schedule).toEqual(visitSchedule([HVAC, BOILER], TYPES));
    expect(buildAgreementDocument(source, SETTINGS).schedule[0].tasks).toEqual([{ type: "Rooftop unit", description: HEAT_TASK }]);
  });

  test("C1122: a scope that was not recorded lists no tasks", () => {
    const rows = buildAgreementDocument({ ...source, serviceScope: { source: "not_recorded" } }, SETTINGS).schedule;
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.tasks.length === 0)).toBe(true);
  });
});
