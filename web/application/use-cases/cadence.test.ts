import { describe, expect, test } from "vitest";
import { portalView } from "@/application/portal-view.testing";
import type { AgreementDetail } from "@/application/ports";
import { buildAgreementDocument } from "@/domain/agreement";
import type { OrgSettingsValue } from "@/domain/org-settings";
import { portalDocument } from "./portal";

describe("the portal PDF's schedule", () => {
  test("C1086: portalDocument gives the same schedule as buildAgreementDocument over the equivalent detail", () => {
    const view = portalView({
      lines: [
        {
          description: "HVAC",
          visitsPerYear: 4,
          costPerVisitCents: 25000,
          annualCents: 100000,
          visitMonths: [3, 6, 9, 12],
          equipment: [
            { code: "RTU", name: "RTU" },
            { code: "AHU", name: "AHU" },
          ],
        },
        { description: "Boiler", visitsPerYear: 1, costPerVisitCents: 30000, annualCents: 30000, visitMonths: [10], equipment: [{ code: "BOILER", name: "Boiler" }] },
      ],
      annualCents: 130000,
    });
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
        lines: view.lines.map((line, i) => ({
          ...line,
          id: `l${i}`,
          position: i,
          equipment: line.equipment.map((type) => ({ id: type.code, ...type })),
        })),
        annualCents: view.annualCents,
      },
      editable: false,
      equipmentChoices: [],
      serviceScope: { source: "not_recorded" },
      terms: view.terms,
      portalLink: null,
      linkEmail: null,
    };
    const settings = { legalName: "Kettle Ridge Mechanical Ltd.", address: null, phone: null, accentColor: null } as OrgSettingsValue;
    const staff = buildAgreementDocument(detail, settings).schedule;
    expect(portalDocument(view)?.schedule).toEqual(staff);
    expect(staff).toEqual([
      { month: 3, equipment: ["AHU", "RTU"], tasks: [] },
      { month: 6, equipment: ["AHU", "RTU"], tasks: [] },
      { month: 9, equipment: ["AHU", "RTU"], tasks: [] },
      { month: 10, equipment: ["Boiler"], tasks: [] },
      { month: 12, equipment: ["AHU", "RTU"], tasks: [] },
    ]);
  });
});
