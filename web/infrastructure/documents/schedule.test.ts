import { describe, expect, test } from "vitest";
import type { AgreementDocument } from "@/domain/agreement";
import { reactPdfDocumentRenderer } from "./index";
import { pdfPages } from "./pdf-text.testing";

const base: AgreementDocument = {
  tenant: { name: "Kettle Ridge Mechanical Ltd.", address: null, phone: null, accent: "#1f6f8b" },
  number: "AG-1046",
  versionNo: 1,
  customerName: "Fernwood Dental",
  siteName: "Main",
  mark: null,
  lines: [
    { description: "HVAC", visitsPerYear: 4, costPerVisitCents: 25000, annualCents: 100000 },
    { description: "Boiler", visitsPerYear: 1, costPerVisitCents: 30000, annualCents: 30000 },
  ],
  totalCents: 130000,
  schedule: [
    { month: 3, equipment: ["AHU", "RTU"] },
    { month: 6, equipment: ["AHU", "RTU"] },
    { month: 9, equipment: ["AHU", "RTU"] },
    { month: 10, equipment: ["Boiler"] },
    { month: 12, equipment: ["AHU", "RTU"] },
  ],
  scope: { kind: "listed", recordedOn: null, types: [] },
  terms: [],
};

const render = async (over: Partial<AgreementDocument>) => (await pdfPages(await reactPdfDocumentRenderer.renderAgreement({ ...base, ...over }))).join("\n");

describe("the PDF's visit schedule", () => {
  test("C1081: Visit schedule prints after Service and price and before Service included, a line per month", async () => {
    const all = await render({});
    const at = (needle: string) => all.indexOf(needle);
    expect(at("Service and price")).toBeGreaterThanOrEqual(0);
    expect(at("Visit schedule")).toBeGreaterThan(at("Service and price"));
    expect(at("Service included")).toBeGreaterThan(at("Visit schedule"));
    const section = all.slice(at("Visit schedule"), at("Service included"));
    expect(section).toMatch(/March\s*AHU, RTU/);
    expect(section).toMatch(/October\s*Boiler/);
  });

  test("C1085: with no lines the section says No visits scheduled yet", async () => {
    const all = await render({ lines: [], totalCents: 0, schedule: [] });
    const section = all.slice(all.indexOf("Visit schedule"), all.indexOf("Service included"));
    expect(section).toContain("No visits scheduled yet");
  });
});
