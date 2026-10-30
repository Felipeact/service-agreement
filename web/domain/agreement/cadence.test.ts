import { describe, expect, test } from "vitest";
import type { OrgSettingsValue } from "../org-settings";
import { buildAgreementDocument, type DocumentSource } from "./document";
import { MONTH_PRESETS, prefillMonths, validateServiceLine, visitSchedule } from "./index";

const TYPE = "55555555-5555-4555-8555-555555555555";
const valid = { description: "HVAC", visitMonths: ["3", "6", "9", "12"], costPerVisit: "250.00", assetTypeIds: [TYPE] };

describe("month presets", () => {
  test("C1063: quarterly, semi-annual and monthly check their months", () => {
    expect(MONTH_PRESETS.quarterly).toEqual([3, 6, 9, 12]);
    expect(MONTH_PRESETS.semiAnnual).toEqual([4, 10]);
    expect(MONTH_PRESETS.monthly).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("validateServiceLine, months and equipment", () => {
  test("C1064: no month is refused with Choose at least one visit month", () => {
    const result = validateServiceLine({ ...valid, visitMonths: [] });
    expect(result).toEqual({ ok: false, errors: { visitMonths: "Choose at least one visit month" } });
  });

  test("C1068: no equipment type is refused with Choose at least one equipment type", () => {
    const result = validateServiceLine({ ...valid, assetTypeIds: [] });
    expect(result).toEqual({ ok: false, errors: { assetTypeIds: "Choose at least one equipment type" } });
  });

  test("C1064 (extra): months come back ascending and once each, and a month outside 1-12 is refused", () => {
    const result = validateServiceLine({ ...valid, visitMonths: ["12", "3", "3"] });
    expect(result.ok && result.value.visitMonths).toEqual([3, 12]);
    expect(validateServiceLine({ ...valid, visitMonths: ["13"] }).ok).toBe(false);
    expect(validateServiceLine({ ...valid, visitMonths: ["0"] }).ok).toBe(false);
  });
});

describe("prefillMonths", () => {
  const choices = [
    { id: "rtu", defaultVisitMonths: [3, 6, 9, 12] },
    { id: "boiler", defaultVisitMonths: [10] },
  ];

  test("C1069: the union of the checked types' defaults, or no month for none", () => {
    expect(prefillMonths({ choices, checked: ["rtu", "boiler"], current: [], edited: false })).toEqual([3, 6, 9, 10, 12]);
    expect(prefillMonths({ choices, checked: ["boiler"], current: [3], edited: false })).toEqual([10]);
    expect(prefillMonths({ choices, checked: [], current: [10], edited: false })).toEqual([]);
  });

  test("C1069: once the grid was edited by hand the current months stay", () => {
    expect(prefillMonths({ choices, checked: ["rtu", "boiler"], current: [1, 7], edited: true })).toEqual([1, 7]);
  });
});

const HVAC = { visitMonths: [3, 6, 9, 12], equipment: [{ name: "AHU" }, { name: "RTU" }] };
const BOILER = { visitMonths: [10], equipment: [{ name: "Boiler" }] };
const MARCH_RTU = { visitMonths: [3], equipment: [{ name: "RTU" }] };

describe("visitSchedule", () => {
  test("C1080: one row per visited month, names once each by name; none for no lines", () => {
    expect(visitSchedule([HVAC, BOILER, MARCH_RTU])).toEqual([
      { month: 3, equipment: ["AHU", "RTU"] },
      { month: 6, equipment: ["AHU", "RTU"] },
      { month: 9, equipment: ["AHU", "RTU"] },
      { month: 10, equipment: ["Boiler"] },
      { month: 12, equipment: ["AHU", "RTU"] },
    ]);
    expect(visitSchedule([])).toEqual([]);
  });
});

describe("buildAgreementDocument, schedule", () => {
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
    shown: { versionNo: 1, lines: [line("HVAC", HVAC), line("Boiler", BOILER), line("RTU", MARCH_RTU)], annualCents: 900 },
    serviceScope: { source: "live", takenAt: null, types: [] },
    terms: null,
  };

  test("C1081: the document carries the schedule of its lines", () => {
    expect(buildAgreementDocument(source, SETTINGS).schedule).toEqual(visitSchedule([HVAC, BOILER, MARCH_RTU]));
    expect(buildAgreementDocument(source, SETTINGS).schedule[0]).toEqual({ month: 3, equipment: ["AHU", "RTU"] });
    expect(buildAgreementDocument({ ...source, shown: { ...source.shown, lines: [] } }, SETTINGS).schedule).toEqual([]);
  });
});
