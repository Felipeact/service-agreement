import { describe, expect, test } from "vitest";
import type { OrgSettingsValue } from "../org-settings";
import { buildAgreementDocument, type DocumentSource } from "./document";
import { layoutOf, type DocOptions, type LayoutItem } from "./layout";
import { SYSTEM_AGREEMENT_BODY, validateAgreementTemplate, type AgreementTemplateBody, type AgreementTemplateBodyV1 } from "./template";

const DOC: DocOptions = { title: "Preventive maintenance service agreement", showMeta: true, pageHeader: "first", pageFooter: "number" };

const V1: AgreementTemplateBodyV1 = {
  schema: 1,
  name: "Welcome",
  description: "",
  intro: [
    { type: "heading", text: "About this agreement" },
    { type: "paragraph", text: "Welcome {{customer.name}}." },
  ],
  footer: [{ type: "clause", text: "Thank you." }],
  sections: { schedule: true, scope: true },
  preset: { termMonths: null, lines: [] },
};

const intro: LayoutItem[] = [
  { kind: "block", type: "heading", text: "About this agreement" },
  { kind: "block", type: "paragraph", text: "Welcome {{customer.name}}." },
];
const closing: LayoutItem[] = [{ kind: "block", type: "clause", text: "Thank you." }];
const section = (key: "price" | "schedule" | "included" | "equipment" | "terms"): LayoutItem => ({ kind: "section", key });

describe("layoutOf, a schema 1 body", () => {
  test.each<[string, boolean, boolean, LayoutItem[]]>([
    ["schedule and scope shown", true, true, [section("price"), section("schedule"), section("included"), section("equipment"), section("terms")]],
    ["schedule hidden", false, true, [section("price"), section("included"), section("equipment"), section("terms")]],
    ["scope hidden", true, false, [section("price"), section("schedule"), section("terms")]],
    ["both hidden", false, false, [section("price"), section("terms")]],
  ])("C5500: with %s the layout is the intro, price, the shown sections, terms, then the closing blocks", (_label, schedule, scope, middle) => {
    const { layout, doc } = layoutOf({ ...V1, sections: { schedule, scope } });
    expect(layout).toEqual([...intro, ...middle, ...closing]);
    expect(doc).toEqual({ title: "Preventive maintenance service agreement", showMeta: true, pageHeader: "first", pageFooter: "number" });
  });

  test("C5500: a body with no text is the price table, the optional sections and the terms alone", () => {
    expect(layoutOf(SYSTEM_AGREEMENT_BODY).layout).toEqual([section("price"), section("schedule"), section("included"), section("equipment"), section("terms")]);
  });
});

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

const SOURCE: DocumentSource = {
  number: "AG-1052",
  customer: { name: "Fernwood Dental" },
  site: { name: "Fernwood Dental, Main" },
  editable: false,
  shown: { versionNo: 1, lines: [], annualCents: 0 },
  serviceScope: { source: "live", takenAt: null, types: [] },
  terms: null,
  term: { start: null, months: 12, end: null },
  validUntil: null,
};

describe("layoutOf, a schema 2 body", () => {
  const stored: AgreementTemplateBody = {
    schema: 2,
    name: "Proposal",
    description: "",
    doc: { title: "MAINTENANCE SCHEDULE", showMeta: false, pageHeader: "every", pageFooter: "letterhead" },
    layout: [
      { kind: "block", type: "heading", text: "Scope", level: 2, indent: 1, pageBreakBefore: true },
      { kind: "section", key: "included", options: { title: "Service included:", showFrequency: true, uppercase: true } },
      section("price"),
    ],
    preset: { termMonths: null, lines: [] },
  };

  test("C5501: the layout and the document options come back exactly as stored", () => {
    const { layout, doc } = layoutOf(stored);
    expect(layout).toEqual(stored.schema === 2 ? stored.layout : []);
    expect(doc).toEqual({ title: "MAINTENANCE SCHEDULE", showMeta: false, pageHeader: "every", pageFooter: "letterhead" });
  });

  test("C5501: the system body has the layout of an agreement built with no template", () => {
    expect(layoutOf(SYSTEM_AGREEMENT_BODY).layout).toEqual(buildAgreementDocument(SOURCE, SETTINGS).layout);
    expect(layoutOf(SYSTEM_AGREEMENT_BODY).doc).toEqual(buildAgreementDocument(SOURCE, SETTINGS).doc);
  });
});

describe("validateAgreementTemplate, schema 2", () => {
  const body = (over: Record<string, unknown> = {}) => ({
    schema: 2,
    name: "Layout",
    description: "",
    doc: { ...DOC },
    layout: [section("price")],
    preset: { termMonths: null, lines: [] },
    ...over,
  });
  const reasonOf = (input: unknown) => {
    const result = validateAgreementTemplate(input);
    return result.ok ? null : result.reason;
  };
  const text = (value: string): LayoutItem => ({ kind: "block", type: "paragraph", text: value });
  const many = (count: number, item: LayoutItem) => Array.from({ length: count }, () => item);

  test("C5512: a valid schema 2 body is accepted, with every optional field and option", () => {
    const full = body({
      doc: { title: "Maintenance schedule for {{site.name}}", showMeta: false, pageHeader: "every", pageFooter: "letterhead" },
      layout: [
        { kind: "block", type: "heading", text: "H", level: 1, indent: 0, pageBreakBefore: true },
        { kind: "block", type: "clause", text: "Payable within {{terms.paymentDays}}", indent: 3 },
        { kind: "section", key: "included", options: { title: "Service included:", showFrequency: true, uppercase: true } },
        {
          kind: "section",
          key: "price",
          options: { title: "Charge", visitsFormat: "times_per_year", columns: { description: "A", visits: "B", perVisit: "C", perYear: "D", total: "E" } },
        },
        { kind: "section", key: "equipment", options: { title: "EQUIPMENT LIST" } },
        { kind: "section", key: "schedule", options: { title: "Schedule" } },
        section("terms"),
      ],
    });
    expect(validateAgreementTemplate(full).ok).toBe(true);
    expect(validateAgreementTemplate(body()).ok).toBe(true);
  });

  test.each<[string, unknown, string]>([
    ["an unknown item kind", body({ layout: [section("price"), { kind: "image", text: "x" }] }), "unknown kind: image"],
    ["an unknown section key", body({ layout: [section("price"), { kind: "section", key: "signatures" }] }), "does not have: signatures"],
    ["an unknown pageHeader", body({ doc: { ...DOC, pageHeader: "last" } }), "page header must be first or every, not last"],
    ["an unknown pageFooter", body({ doc: { ...DOC, pageFooter: "none" } }), "page footer must be number or letterhead, not none"],
    ["a repeated section", body({ layout: [section("price"), section("schedule"), section("schedule")] }), "schedule section is in the layout more than once"],
    ["a missing price", body({ layout: [section("schedule")] }), "needs the price table"],
    ["a repeated price", body({ layout: [section("price"), section("price")] }), "price table is in the layout more than once"],
    ["61 items", body({ layout: [...many(60, section("schedule")), section("price")] }), "too many items (61, at most 60)"],
    ["41 blocks", body({ layout: [...many(41, text("x")), section("price")] }), "too many text blocks (41, at most 40)"],
    ["a text of 2,001 characters", body({ layout: [text("x".repeat(2001)), section("price")] }), "too long (2001 characters, at most 2000)"],
    ["a title of 121 characters", body({ doc: { ...DOC, title: "x".repeat(121) } }), "title is too long (121 characters, at most 120)"],
    ["an unknown variable", body({ layout: [text("Hello {{nope}}"), section("price")] }), "unknown variable: nope"],
    ["an indent of 4", body({ layout: [{ kind: "block", type: "paragraph", text: "x", indent: 4 }, section("price")] }), "indent of 4"],
    ["a heading level of 3", body({ layout: [{ kind: "block", type: "heading", text: "x", level: 3 }, section("price")] }), "heading level of 3"],
  ])("C5512: %s is refused with its own message", (_label, input, expected) => {
    expect(reasonOf(input)).toContain(expected);
  });

  test("C5512: every one of those fourteen refusals has a message of its own", () => {
    const inputs = [
      body({ layout: [section("price"), { kind: "image", text: "x" }] }),
      body({ layout: [section("price"), { kind: "section", key: "signatures" }] }),
      body({ doc: { ...DOC, pageHeader: "last" } }),
      body({ doc: { ...DOC, pageFooter: "none" } }),
      body({ layout: [section("price"), section("schedule"), section("schedule")] }),
      body({ layout: [section("schedule")] }),
      body({ layout: [section("price"), section("price")] }),
      body({ layout: [...many(60, section("schedule")), section("price")] }),
      body({ layout: [...many(41, text("x")), section("price")] }),
      body({ layout: [text("x".repeat(2001)), section("price")] }),
      body({ doc: { ...DOC, title: "x".repeat(121) } }),
      body({ layout: [text("Hello {{nope}}"), section("price")] }),
      body({ layout: [{ kind: "block", type: "paragraph", text: "x", indent: 4 }, section("price")] }),
      body({ layout: [{ kind: "block", type: "heading", text: "x", level: 3 }, section("price")] }),
    ];
    expect(new Set(inputs.map(reasonOf)).size).toBe(14);
  });

  test("C5512: a refusal names the field and the item it belongs to", () => {
    const result = validateAgreementTemplate(body({ layout: [section("price"), { kind: "block", type: "paragraph", text: "x", indent: 4 }] }));
    expect(!result.ok && result.errors.map((error) => error.field)).toEqual(["layout.1.indent"]);
  });

  test("C5512: schema 1 is still accepted, and a schema 2 body that carries the schema 1 keys is refused", () => {
    expect(validateAgreementTemplate(SYSTEM_AGREEMENT_BODY).ok).toBe(true);
    expect(reasonOf({ ...body(), intro: [] })).toContain("schema 2");
    expect(reasonOf({ schema: 3 })).toContain("schemas 1 and 2");
  });

  test("C5512: the section options are checked: an unknown option, a bad column set, a bad visits format and an unknown variable", () => {
    const withOptions = (key: string, options: unknown) => body({ layout: [{ kind: "section", key: "price" }, { kind: "section", key, options }] });
    expect(reasonOf(withOptions("schedule", { uppercase: true }))).toContain("unknown option: uppercase");
    expect(reasonOf(body({ layout: [{ kind: "section", key: "price", options: { columns: { description: "A" } } }] }))).toContain("columns");
    expect(reasonOf(body({ layout: [{ kind: "section", key: "price", options: { visitsFormat: "daily" } }] }))).toContain("visits format");
    expect(reasonOf(withOptions("equipment", { title: "List for {{nope}}" }))).toContain("unknown variable: nope");
    expect(reasonOf(withOptions("equipment", { title: "x".repeat(121) }))).toContain("too long");
  });
});
