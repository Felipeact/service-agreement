import { describe, expect, test } from "vitest";
import { DEFAULT_ITEM_WORDS, itemWords, type OrgSettingsValue } from "../org-settings";
import type { TenantLogo } from "../org-settings/logo";
import { SYSTEM_AGREEMENT_BODY, type AgreementTemplateBody } from "./template";
import { buildTemplatePreviewDocument, PREVIEW_MARK } from "./template-preview";

const SETTINGS: OrgSettingsValue = {
  legalName: "Kettle Ridge Mechanical Ltd.",
  address: "100 Sample Street, Burnaby, BC",
  phone: "604-555-0100",
  accentColor: "#1f6f8b",
  repairDiscountPct: 10,
  cpiCapPct: 5,
  cancellationNoticeDays: 30,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: "GST extra",
  defaultTermMonths: 12,
  renewalNoticeDays: 30,
  cpiRenegotiationThresholdPct: 5,
  renewalCpiPct: null,
  renewalCpiAsOf: null,
  proposalValidityDays: 30,
  itemSingular: "equipment",
  itemPlural: "equipment",
};

const BODY: AgreementTemplateBody = {
  ...SYSTEM_AGREEMENT_BODY,
  name: "Quarterly HVAC",
  intro: [{ type: "paragraph", text: "Welcome {{customer.name}}." }],
  footer: [{ type: "paragraph", text: "Thank you, {{tenant.legalName}}." }],
  preset: {
    termMonths: 24,
    lines: [
      { description: "Quarterly visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisitCents: 45000 },
      { description: "Filter check", visitMonths: [6], assetTypeCodes: [], costPerVisitCents: null },
    ],
  },
};

const build = (body = BODY, logo: TenantLogo | null = null) => buildTemplatePreviewDocument(body, SETTINGS, logo, DEFAULT_ITEM_WORDS);

describe("the template preview document", () => {
  test("C5436: it is marked TEMPLATE PREVIEW and made of the sample customer, site and number", () => {
    const document = build();
    expect(document).toMatchObject({ number: "AG-0000", customerName: "Sample Customer Ltd.", siteName: "Sample Site", mark: "TEMPLATE PREVIEW", versionNo: 1 });
    expect(PREVIEW_MARK).toBe("TEMPLATE PREVIEW");
  });

  test("C5436: one price row per preset line, with the preset's price, and $0.00 (zero cents) for a line with none", () => {
    const { lines, totalCents } = build();
    expect(lines).toEqual([
      { description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 },
      { description: "Filter check", visitsPerYear: 1, costPerVisitCents: 0, annualCents: 0 },
    ]);
    expect(totalCents).toBe(180000);
  });

  test("C5436: a template with no preset lines has no price rows and a zero total", () => {
    const { lines, totalCents } = build({ ...BODY, preset: { termMonths: null, lines: [] } });
    expect(lines).toEqual([]);
    expect(totalCents).toBe(0);
  });

  test("C5436: the intro and closing text are the template's, with the sample names filled in", () => {
    const document = build();
    expect(document.intro).toEqual([{ type: "paragraph", text: "Welcome Sample Customer Ltd.." }]);
    expect(document.footer).toEqual([{ type: "paragraph", text: "Thank you, Kettle Ridge Mechanical Ltd.." }]);
  });

  test.each([
    ["both on", true, true],
    ["schedule off", false, true],
    ["scope off", true, false],
    ["both off", false, false],
  ])("C5436: with %s the schedule and the service-included section follow the switches", (_label, schedule, scope) => {
    const document = build({ ...BODY, sections: { schedule, scope } });
    expect(document.sections).toEqual({ schedule, scope });
    expect(document.schedule.length > 0).toBe(schedule);
    expect(document.scope.kind).toBe(scope ? "listed" : "hidden");
  });

  test("C5436: the schedule lists the months the preset visits, in calendar order", () => {
    expect(build().schedule.map((row) => row.month)).toEqual([3, 6, 9, 12]);
  });

  test("C5436: the terms are the org's today and the term is the preset's, else the org's default", () => {
    const document = build();
    expect(document.terms.map((term) => term.label)).toEqual(["Repair discount", "CPI cap", "Cancellation notice", "Payment terms", "Governing province", "Tax note", "Renewal"]);
    expect(document.term).toContain("24 months");
    expect(build({ ...BODY, preset: { termMonths: null, lines: [] } }).term).toContain("12 months");
  });

  test("C5436: the letterhead is the org's: legal name, address, phone, accent, the logo when it has one, and its item words", () => {
    const logo: TenantLogo = { bytes: new Uint8Array([1, 2, 3]), format: "png" };
    const words = itemWords("station", "stations");
    const document = buildTemplatePreviewDocument(BODY, SETTINGS, logo, words);
    expect(document.tenant).toEqual({ name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100", accent: "#1f6f8b", logo });
    expect(document.words).toBe(words);
    expect("logo" in build().tenant).toBe(false);
  });
});
