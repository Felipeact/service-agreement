import { describe, expect, test } from "vitest";
import { portalView } from "@/application/portal-view.testing";
import type { AgreementDetail } from "@/application/ports";
import { buildAgreementDocument, parseServiceScope } from "@/domain/agreement";
import type { OrgSettingsValue } from "@/domain/org-settings";
import { portalDocument, portalScope } from "./portal";

const HEAT_TASK = "Inspect heat exchanger during heating season";
const COOL_TASK = "Check compressor operation during cooling operation";
const SCOPE = {
  schema: 2,
  takenAt: "2026-10-20T15:00:00Z",
  types: [
    {
      code: "RTU",
      name: "Rooftop unit",
      tasks: [
        { description: "Replace filters", visitMonths: null },
        { description: HEAT_TASK, visitMonths: [1, 2, 3, 10, 11, 12] },
        { description: COOL_TASK, visitMonths: [4, 5, 6, 7, 8, 9] },
      ],
      assets: [],
    },
    { code: "AHU", name: "Air handling unit", tasks: [{ description: "Belts", visitMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }], assets: [] },
    { code: "BOILER", name: "Boiler", tasks: [{ description: "Fall test", visitMonths: [10] }], assets: [] },
  ],
};

describe("the portal's seasonal tasks", () => {
  test("C1110: portalScope reads a schema 2 task with its months", () => {
    const scope = portalScope(portalView({ scope: SCOPE }));
    expect(scope.source === "frozen" && scope.types.find((type) => type.code === "BOILER")?.tasks).toEqual([{ description: "Fall test", visitMonths: [10] }]);
  });

  test("C1123: portalDocument gives the same schedule, tasks included, as buildAgreementDocument over the equivalent detail", () => {
    const view = portalView({
      lines: [
        {
          description: "HVAC",
          visitsPerYear: 4,
          costPerVisitCents: 25000,
          annualCents: 100000,
          visitMonths: [3, 6, 9, 12],
          equipment: [
            { code: "RTU", name: "Rooftop unit" },
            { code: "AHU", name: "Air handling unit" },
          ],
        },
        { description: "Boiler", visitsPerYear: 1, costPerVisitCents: 30000, annualCents: 30000, visitMonths: [10], equipment: [{ code: "BOILER", name: "Boiler" }] },
      ],
      annualCents: 130000,
      scope: SCOPE,
    });
    const parsed = parseServiceScope(SCOPE);
    const detail: AgreementDetail = {
      id: "g1",
      number: view.agreement.number,
      status: "sent",
      stage: "sent",
      site: { id: "s1", name: view.site.name },
      customer: { id: "c1", name: view.customer.name },
      versions: [{ versionNo: 1, createdAt: new Date("2026-10-20T15:00:00Z") }],
      shown: {
        versionNo: 1,
        current: true,
        lines: view.lines.map((line, i) => ({ ...line, id: `l${i}`, position: i, equipment: line.equipment.map((type) => ({ id: type.code, ...type })) })),
        annualCents: view.annualCents,
      },
      editable: false,
      equipmentChoices: [],
      serviceScope: { source: "frozen", takenAt: new Date(SCOPE.takenAt), types: parsed?.types ?? [] },
      terms: view.terms,
      portalLink: null,
      linkEmail: null,
    };
    const settings = { legalName: "Kettle Ridge Mechanical Ltd.", address: null, phone: null, accentColor: null } as OrgSettingsValue;
    const staff = buildAgreementDocument(detail, settings).schedule;
    expect(portalDocument(view)?.schedule).toEqual(staff);
    const heat = [{ type: "Rooftop unit", description: HEAT_TASK }];
    const cool = [{ type: "Rooftop unit", description: COOL_TASK }];
    expect(staff.map((row) => [row.month, row.tasks])).toEqual([
      [3, heat],
      [6, cool],
      [9, cool],
      [10, [{ type: "Boiler", description: "Fall test" }]],
      [12, heat],
    ]);
  });
});
