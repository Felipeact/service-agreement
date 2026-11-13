import { describe, expect, test } from "vitest";
import type { OrgSettingsValue } from "../org-settings";
import { buildAgreementDocument, DRAFT_MARK, frequencyLabel, NEUTRAL_ACCENT, typeFrequencies, type DocumentSource } from "./document";
import type { AgreementTemplateBody } from "./template";

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
  proposalValidityDays: 30, itemSingular: "equipment", itemPlural: "equipment",
};

const SOURCE: DocumentSource = {
  number: "AG-1052",
  customer: { name: "Fernwood Dental" },
  site: { name: "Fernwood Dental, Main" },
  editable: false,
  shown: {
    versionNo: 1,
    lines: [
      { id: "l1", description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000, visitMonths: [3, 6, 9, 12], equipment: [{ name: "Rooftop unit" }] },
      { id: "l2", description: "Filter change", visitsPerYear: 2, costPerVisitCents: 94500, annualCents: 189000, visitMonths: [4, 10], equipment: [{ name: "Rooftop unit" }] },
    ],
    annualCents: 387000,
  },
  serviceScope: { source: "live", takenAt: null, types: [] },
  // The shown version is frozen, so these are the terms it was sent with (customer-portal door 3).
  terms: {
    repairDiscountPct: 10,
    cpiCapPct: 5,
    cancellationNoticeDays: 30,
    paymentDays: 30,
    governingProvince: "BC",
    taxNote: "GST extra",
    renewalNoticeDays: null,
    cpiRenegotiationThresholdPct: null,
  },
  term: { start: null, months: 12, end: null },
  validUntil: null,
};

// The terms of a draft come from the org's settings (customer-portal AC 32); a frozen version prints its own.
const DRAFT_SOURCE: DocumentSource = { ...SOURCE, editable: true, terms: null };

describe("buildAgreementDocument", () => {
  test("C858: the header carries the tenant's name, address, phone and accent", () => {
    expect(buildAgreementDocument(SOURCE, SETTINGS).tenant).toEqual({
      name: "Kettle Ridge Mechanical Ltd.",
      address: "100 Sample Street, Burnaby, BC",
      phone: "604-555-0100",
      accent: "#1f6f8b",
    });
  });

  test("C858: a tenant with no address, phone or accent gets the neutral accent and null fields, never text", () => {
    const { tenant } = buildAgreementDocument(SOURCE, { ...SETTINGS, address: null, phone: null, accentColor: null });
    expect(tenant).toEqual({ name: "Kettle Ridge Mechanical Ltd.", address: null, phone: null, accent: NEUTRAL_ACCENT });
    expect(NEUTRAL_ACCENT).toMatch(/^#[0-9a-f]{6}$/);
    expect(NEUTRAL_ACCENT).not.toBe("#1f6f8b");
  });

  test("C864: all six terms print in order with their values", () => {
    expect(buildAgreementDocument(DRAFT_SOURCE, SETTINGS).terms).toEqual([
      { label: "Repair discount", value: "10%" },
      { label: "CPI cap", value: "5%" },
      { label: "Cancellation notice", value: "30 days" },
      { label: "Payment terms", value: "30 days" },
      { label: "Governing province", value: "BC" },
      { label: "Tax note", value: "GST extra" },
      { label: "Renewal", value: "Renews automatically for another 12 months with the CPI increase, capped at 5%. If CPI is 5% or more, the renewal is renegotiated. Notice is given 30 days before the end date." },
    ]);
  });

  test.each<[string, Partial<OrgSettingsValue>, string]>([
    ["cancellation notice", { cancellationNoticeDays: null }, "Cancellation notice"],
    ["payment terms", { paymentDays: null }, "Payment terms"],
    ["governing province", { governingProvince: null }, "Governing province"],
    ["tax note", { taxNote: null }, "Tax note"],
  ])("C864: with %s null only that term is absent", (_name, over, label) => {
    const labels = buildAgreementDocument(DRAFT_SOURCE, { ...SETTINGS, ...over }).terms.map((term) => term.label);
    expect(labels).not.toContain(label);
    expect(labels).toHaveLength(6);
  });

  test("C864: with the four nullable terms null, the two numeric terms still print", () => {
    const bare = { ...SETTINGS, cancellationNoticeDays: null, paymentDays: null, governingProvince: null, taxNote: null };
    expect(buildAgreementDocument(DRAFT_SOURCE, bare).terms.map((term) => term.label)).toEqual(["Repair discount", "CPI cap", "Renewal"]);
  });

  test("C864: one day is singular and a fractional percent keeps its decimals", () => {
    const { terms } = buildAgreementDocument(DRAFT_SOURCE, { ...SETTINGS, cancellationNoticeDays: 1, repairDiscountPct: 12.5 });
    expect(terms[0].value).toBe("12.5%");
    expect(terms[2].value).toBe("1 day");
  });

  test("C859: number, version, customer and site come from the version shown", () => {
    const doc = buildAgreementDocument({ ...SOURCE, shown: { ...SOURCE.shown, versionNo: 2 } }, SETTINGS);
    expect([doc.number, doc.versionNo, doc.customerName, doc.siteName]).toEqual(["AG-1052", 2, "Fernwood Dental", "Fernwood Dental, Main"]);
  });

  test("C860: lines carry their cents and the total is the version's annualCents", () => {
    const doc = buildAgreementDocument(DRAFT_SOURCE, SETTINGS);
    expect(doc.lines.map((line) => line.annualCents)).toEqual([180000, 189000]);
    expect(doc.lines[0]).toEqual({ description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 });
    expect(doc.totalCents).toBe(387000);
    expect(buildAgreementDocument({ ...SOURCE, shown: { ...SOURCE.shown, annualCents: 1 } }, SETTINGS).totalCents).toBe(1);
  });

  test("C866: only an editable (current draft) version is marked", () => {
    expect(buildAgreementDocument({ ...SOURCE, editable: true }, SETTINGS).mark).toBe(DRAFT_MARK);
    expect(buildAgreementDocument({ ...SOURCE, editable: false }, SETTINGS).mark).toBeNull();
    expect(DRAFT_MARK).toBe("DRAFT - not yet sent to the customer");
  });

  test("C867: a frozen scope carries when it was taken, a live scope does not", () => {
    const takenAt = new Date("2026-10-20T15:00:00Z");
    expect(buildAgreementDocument({ ...SOURCE, serviceScope: { source: "frozen", takenAt, types: [] } }, SETTINGS).scope).toEqual({
      kind: "listed",
      recordedOn: takenAt,
      types: [],
    });
    expect(buildAgreementDocument(DRAFT_SOURCE, SETTINGS).scope).toEqual({ kind: "listed", recordedOn: null, types: [] });
  });

  test("C868: a scope nobody recorded stays not recorded", () => {
    expect(buildAgreementDocument({ ...SOURCE, serviceScope: { source: "not_recorded" } }, SETTINGS).scope).toEqual({ kind: "not_recorded" });
  });
});

describe("which terms the document prints", () => {
  const FROZEN_TERMS = {
    repairDiscountPct: 10,
    cpiCapPct: 5,
    cancellationNoticeDays: 30,
    paymentDays: 30,
    governingProvince: "BC",
    taxNote: "GST extra",
    renewalNoticeDays: null,
    cpiRenegotiationThresholdPct: null,
  };
  const LABELS = ["Repair discount", "CPI cap", "Cancellation notice", "Payment terms", "Governing province", "Tax note"];

  test("C934: a frozen version prints its frozen terms, in the order and with the labels agreement-pdf set", () => {
    const { terms } = buildAgreementDocument({ ...SOURCE, editable: false, terms: FROZEN_TERMS }, SETTINGS);
    expect(terms.map((term) => term.label)).toEqual(LABELS);
    expect(terms.map((term) => term.value)).toEqual(["10%", "5%", "30 days", "30 days", "BC", "GST extra"]);
  });

  test("C934: a frozen version keeps its terms after the settings differ", () => {
    const changed = { ...SETTINGS, repairDiscountPct: 15, cpiCapPct: 7, paymentDays: 45, taxNote: "Changed" };
    const { terms } = buildAgreementDocument({ ...SOURCE, editable: false, terms: FROZEN_TERMS }, changed);
    expect(terms.map((term) => term.value)).toEqual(["10%", "5%", "30 days", "30 days", "BC", "GST extra"]);
  });

  test("C934: the current version of a draft prints the settings' terms, not a stored copy", () => {
    const changed = { ...SETTINGS, repairDiscountPct: 15 };
    const { terms } = buildAgreementDocument({ ...SOURCE, editable: true, terms: null }, changed);
    expect(terms[0]).toEqual({ label: "Repair discount", value: "15%" });
    expect(terms).toHaveLength(7);
  });

  test("C934: a past version of a draft is frozen and prints its own terms", () => {
    const { terms } = buildAgreementDocument({ ...SOURCE, editable: false, terms: { ...FROZEN_TERMS, repairDiscountPct: 7 } }, { ...SETTINGS, repairDiscountPct: 15 });
    expect(terms[0]).toEqual({ label: "Repair discount", value: "7%" });
  });

  test("C935: a frozen version with no terms prints none and does not fall back to the settings", () => {
    const { terms } = buildAgreementDocument({ ...SOURCE, editable: false, terms: null }, { ...SETTINGS, repairDiscountPct: 99 });
    expect(terms).toEqual([]);
    expect(JSON.stringify(buildAgreementDocument({ ...SOURCE, editable: false, terms: null }, { ...SETTINGS, repairDiscountPct: 99 }))).not.toContain("99%");
  });
});

const TEMPLATE: AgreementTemplateBody = {
  schema: 1,
  name: "Welcome",
  description: "",
  intro: [{ type: "paragraph", text: "Welcome {{customer.name}}." }],
  footer: [{ type: "paragraph", text: "Thank you, {{tenant.legalName}}." }],
  sections: { schedule: true, scope: true },
  preset: { termMonths: null, lines: [] },
};

describe("buildAgreementDocument with a template", () => {
  test("C5320: a pinned body's intro and closing text come back rendered with the names filled in", () => {
    const doc = buildAgreementDocument(SOURCE, SETTINGS, TEMPLATE);
    expect(doc.intro).toEqual([{ type: "paragraph", text: "Welcome Fernwood Dental." }]);
    expect(doc.footer).toEqual([{ type: "paragraph", text: "Thank you, Kettle Ridge Mechanical Ltd.." }]);
  });

  test("C5320: with no template argument the intro and the closing text are empty", () => {
    const doc = buildAgreementDocument(SOURCE, SETTINGS);
    expect(doc.intro).toEqual([]);
    expect(doc.footer).toEqual([]);
    expect(doc.sections).toEqual({ schedule: true, scope: true });
  });

  test.each<[string, { schedule: boolean; scope: boolean }]>([
    ["both shown", { schedule: true, scope: true }],
    ["schedule hidden", { schedule: false, scope: true }],
    ["scope hidden", { schedule: true, scope: false }],
    ["both hidden", { schedule: false, scope: false }],
  ])("C5321: %s", (_label, sections) => {
    const shown = buildAgreementDocument(SOURCE, SETTINGS);
    const doc = buildAgreementDocument(SOURCE, SETTINGS, { ...TEMPLATE, sections });
    expect(doc.sections).toEqual(sections);
    expect(doc.schedule).toEqual(sections.schedule ? shown.schedule : []);
    expect(doc.scope).toEqual(sections.scope ? shown.scope : { kind: "hidden" });
    // The price table, the terms and the totals are always built.
    expect(doc.lines).toEqual(shown.lines);
    expect(doc.totalCents).toBe(387000);
    expect(doc.terms).toEqual(shown.terms);
    expect(shown.schedule.length).toBeGreaterThan(0);
  });

  const TERMS_TEMPLATE: AgreementTemplateBody = {
    ...TEMPLATE,
    intro: [{ type: "paragraph", text: "Payment {{terms.paymentDays}}; {{term.label}}." }],
    footer: [],
  };

  test("C5322: an editable draft fills the variables from today's settings", () => {
    const doc = buildAgreementDocument(DRAFT_SOURCE, { ...SETTINGS, paymentDays: 45, defaultTermMonths: 12 }, TERMS_TEMPLATE);
    expect(doc.intro).toEqual([{ type: "paragraph", text: "Payment 45 days; 12 months." }]);
  });

  test("C5322: a sent version fills them from its frozen terms, whatever the settings say now", () => {
    const sent = { ...SOURCE, term: { start: "2027-01-01", months: 24, end: "2028-12-31" } };
    const doc = buildAgreementDocument(sent, { ...SETTINGS, paymentDays: 45 }, TERMS_TEMPLATE);
    expect(doc.intro).toEqual([{ type: "paragraph", text: "Payment 30 days; 24 months." }]);
  });

  test("C5322: a sent version that recorded no terms prints a clause that needs one as nothing, and a paragraph with an empty replacement", () => {
    const template: AgreementTemplateBody = {
      ...TEMPLATE,
      intro: [
        { type: "clause", text: "Payment {{terms.paymentDays}}." },
        { type: "paragraph", text: "Within {{terms.paymentDays}}." },
      ],
    };
    expect(buildAgreementDocument({ ...SOURCE, terms: null }, SETTINGS, template).intro).toEqual([{ type: "paragraph", text: "Within ." }]);
  });
});


describe("buildAgreementDocument, the layout and options (block-editor)", () => {
  const type = (code: string, name: string) => ({ code, name, tasks: [], assets: [{ unitNo: "1", typeModel: null, location: null }] });
  const line = (description: string, visitsPerYear: number, codes: string[]) => ({
    id: description,
    description,
    visitsPerYear,
    costPerVisitCents: 10000,
    annualCents: visitsPerYear * 10000,
    visitMonths: [],
    equipment: codes.map((code) => ({ code, name: code })),
  });
  const V2 = (over: Partial<Extract<AgreementTemplateBody, { schema: 2 }>> = {}): AgreementTemplateBody => ({
    schema: 2,
    name: "Proposal",
    description: "",
    doc: { title: "Preventive maintenance service agreement", showMeta: true, pageHeader: "first", pageFooter: "number" },
    layout: [{ kind: "section", key: "price" }],
    preset: { termMonths: null, lines: [] },
    ...over,
  });

  test("C5506: the title's merge variables are filled, and an empty title stays empty", () => {
    const titled = buildAgreementDocument(SOURCE, SETTINGS, V2({ doc: { title: "Maintenance schedule for {{site.name}}", showMeta: true, pageHeader: "first", pageFooter: "number" } }));
    expect(titled.doc?.title).toBe("Maintenance schedule for Fernwood Dental, Main");
    const empty = buildAgreementDocument(SOURCE, SETTINGS, V2({ doc: { title: "", showMeta: true, pageHeader: "first", pageFooter: "number" } }));
    expect(empty.doc?.title).toBe("");
  });

  test("C5527: the document's layout text resolves tenant.address, tenant.phone, term.start and terms.taxNote for an agreement", () => {
    const template = V2({
      layout: [
        { kind: "block", type: "paragraph", text: "{{tenant.address}} | {{tenant.phone}} | {{term.start}} | {{terms.taxNote}}" },
        { kind: "section", key: "price" },
      ],
    });
    const source: DocumentSource = { ...SOURCE, term: { start: "2026-11-13", months: 12, end: "2027-11-12" } };
    const text = (built: ReturnType<typeof buildAgreementDocument>) => (built.layout?.[0] as { text: string }).text;
    expect(text(buildAgreementDocument(source, SETTINGS, template))).toBe("100 Sample Street, Burnaby, BC | 604-555-0100 | November 13, 2026 | GST extra");
    expect(text(buildAgreementDocument({ ...source, editable: true, terms: null }, SETTINGS, template))).toBe("100 Sample Street, Burnaby, BC | 604-555-0100 | November 13, 2026 | GST extra");
  });

  test("C5511: a sent version takes its layout and options only from its frozen pin: other settings and a newer template change nothing", () => {
    const pinned = V2({ layout: [{ kind: "block", type: "paragraph", text: "Terms are {{terms.paymentDays}}." }, { kind: "section", key: "price" }] });
    const before = buildAgreementDocument(SOURCE, SETTINGS, pinned);
    const after = buildAgreementDocument(SOURCE, { ...SETTINGS, paymentDays: 90, legalName: "Someone Else Ltd.", defaultTermMonths: 60 }, pinned);
    expect(after.layout).toEqual(before.layout);
    expect(after.doc).toEqual(before.doc);
    expect(before.layout).toEqual([{ kind: "block", type: "paragraph", text: "Terms are 30 days." }, { kind: "section", key: "price" }]);
  });

  test("C5515: the frequency label is MONTHLY for 12, QUARTERLY for 4, BI-ANNUAL for 2, ANNUAL for 1 and N TIMES PER YEAR otherwise", () => {
    expect([12, 4, 2, 1, 3, 6].map(frequencyLabel)).toEqual(["MONTHLY", "QUARTERLY", "BI-ANNUAL", "ANNUAL", "3 TIMES PER YEAR", "6 TIMES PER YEAR"]);
  });

  test("C5515: each equipment type takes the frequency of the line that covers it, and a type no line covers has none", () => {
    const types = [type("BOILER", "Boiler"), type("AHU", "AHU"), type("FD", "Fire damper"), type("CH", "Chiller"), type("PUMP", "Pump"), type("WYE", "Wye strainer")];
    const lines = [line("Boilers", 2, ["BOILER"]), line("Air handlers", 4, ["AHU"]), line("Dampers", 1, ["FD"]), line("Chillers", 12, ["CH"]), line("Pumps", 3, ["PUMP"])];
    expect(typeFrequencies(lines, types)).toEqual({ BOILER: "BI-ANNUAL", AHU: "QUARTERLY", FD: "ANNUAL", CH: "MONTHLY", PUMP: "3 TIMES PER YEAR" });
  });

  test("C5515: a line that records only a type name covers the type of that name", () => {
    const lines = [{ ...line("Units", 4, []), equipment: [{ name: "AHU" }] }];
    expect(typeFrequencies(lines, [type("AHU-1", "AHU")])).toEqual({ "AHU-1": "QUARTERLY" });
  });

  test("C5515: the document carries the frequencies only when the included section asks for them", () => {
    const source: DocumentSource = {
      ...SOURCE,
      shown: { versionNo: 1, lines: [line("Air handlers", 4, ["AHU"])], annualCents: 40000 },
      serviceScope: { source: "live", takenAt: null, types: [type("AHU", "AHU")] },
    };
    const asked = V2({ layout: [{ kind: "section", key: "included", options: { showFrequency: true } }, { kind: "section", key: "price" }] });
    expect(buildAgreementDocument(source, SETTINGS, asked).frequencies).toEqual({ AHU: "QUARTERLY" });
    expect(buildAgreementDocument(source, SETTINGS).frequencies).toBeUndefined();
  });
});
