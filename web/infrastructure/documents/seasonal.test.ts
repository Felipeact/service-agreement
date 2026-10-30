import { describe, expect, test } from "vitest";
import { buildAgreementDocument, type DocumentSource, type ScopeType } from "@/domain/agreement";
import type { OrgSettingsValue } from "@/domain/org-settings";
import { reactPdfDocumentRenderer } from "./index";
import { pdfPages, winAnsi } from "./pdf-text.testing";

const HEAT_TASK = "Inspect heat exchanger during heating season";
const RTU: ScopeType = {
  code: "RTU",
  name: "Rooftop unit",
  tasks: [
    { description: "Replace filters", visitMonths: null },
    { description: "Check belts", visitMonths: [4, 5, 6, 7, 8, 9] },
    { description: HEAT_TASK, visitMonths: [1, 2, 3, 10, 11, 12] },
  ],
  assets: [{ unitNo: "RTU-1", typeModel: null, location: null }],
};
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
const source = (visitMonths: number[]): DocumentSource => ({
  number: "AG-1046",
  customer: { name: "Fernwood Dental" },
  site: { name: "Main" },
  editable: false,
  shown: {
    versionNo: 1,
    lines: [
      {
        description: "HVAC",
        visitsPerYear: visitMonths.length,
        costPerVisitCents: 25000,
        annualCents: 25000 * visitMonths.length,
        visitMonths,
        equipment: [{ code: "RTU", name: "Rooftop unit" }],
      },
    ],
    annualCents: 25000 * visitMonths.length,
  },
  serviceScope: { source: "frozen", takenAt: new Date("2026-10-20T15:00:00Z"), types: [RTU] },
  terms: null,
});
const render = async (visitMonths: number[]) =>
  (await pdfPages(await reactPdfDocumentRenderer.renderAgreement(buildAgreementDocument(source(visitMonths), SETTINGS)))).join("\n");

describe("the PDF's seasonal tasks", () => {
  test("C1115: the checklist prints a seasonal task with its months, and a task for every visit alone", async () => {
    const all = await render([3, 6, 9, 12]);
    const included = all.slice(all.lastIndexOf("Service included"));
    expect(included).toContain(winAnsi("- Check belts (Apr–Sep visits)"));
    expect(included).toMatch(/- Replace filters\s*\n/);
  });

  test("C1117: the PDF never prints No visit in these months", async () => {
    expect(await render([6])).not.toContain("No visit in these months");
  });

  test("C1122: the March row prints the heating task before the June row", async () => {
    const all = await render([3, 6, 9, 12]);
    const at = (needle: string, from = 0) => all.indexOf(needle, from);
    const march = at("March", at("Visit schedule"));
    const task = at(`Rooftop unit: ${HEAT_TASK}`, march);
    expect(march).toBeGreaterThan(0);
    expect(task).toBeGreaterThan(at("Rooftop unit", march));
    expect(task).toBeLessThan(at("June", march));
  });
});
