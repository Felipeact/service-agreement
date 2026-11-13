import { describe, expect, test } from "vitest";
import type { DocumentSource } from "../agreement";
import type { LayoutItem } from "../agreement/layout";
import type { OrgSettingsValue } from "../org-settings";
import { buildContractDocument } from "./document";
import { buildContractPreviewDocument, contractLayoutOf, validateContractWording, type ContractLayoutBody } from "./layout";
import type { ContractParties } from "./parties";
import { SYSTEM_CONTRACT_BODY, type TemplateBody } from "./template";

const section = (key: "price" | "schedule" | "included" | "equipment" | "signatures" | "terms", options?: unknown): LayoutItem => ({ kind: "section", key, ...(options ? { options } : {}) }) as LayoutItem;
const para = (text: string): LayoutItem => ({ kind: "block", type: "paragraph", text });

describe("contractLayoutOf", () => {
  const V1: TemplateBody = {
    schema: 1,
    blocks: [
      { type: "heading", text: "Terms" },
      { type: "clause", text: "Invoices are payable within {{terms.paymentDays}}." },
    ],
  };

  test("C5521: a schema 1 body is the price, schedule, included, equipment, the wording blocks, then signatures, with today's options", () => {
    const { layout, doc } = contractLayoutOf(V1);
    expect(layout).toEqual([
      section("price"),
      section("schedule"),
      section("included"),
      section("equipment"),
      { kind: "block", type: "heading", text: "Terms" },
      { kind: "block", type: "clause", text: "Invoices are payable within {{terms.paymentDays}}." },
      section("signatures"),
    ]);
    expect(doc).toEqual({ title: "Service Contract", showMeta: true, pageHeader: "first", pageFooter: "number" });
  });

  test("C5521: a schema 2 body is returned as stored", () => {
    const stored: ContractLayoutBody = {
      schema: 2,
      doc: { title: "PREVENTIVE MAINTENANCE SERVICE AGREEMENT", showMeta: false, pageHeader: "every", pageFooter: "letterhead" },
      layout: [para("Client: {{customer.name}}"), section("price"), section("signatures", { nameField: true })],
    };
    expect(contractLayoutOf(stored)).toEqual({ doc: stored.doc, layout: stored.layout });
  });

  test("C5521: the system wording gives the layout the contract PDF drew before: the sections, the Terms heading and six clauses, then the signatures", () => {
    const { layout } = contractLayoutOf(SYSTEM_CONTRACT_BODY);
    expect(layout.map((item) => (item.kind === "section" ? item.key : item.type))).toEqual([
      "price",
      "schedule",
      "included",
      "equipment",
      "heading",
      "clause",
      "clause",
      "clause",
      "clause",
      "clause",
      "clause",
      "signatures",
    ]);
  });
});

describe("validateContractWording", () => {
  const body = (over: Record<string, unknown> = {}) => ({
    schema: 2,
    doc: { title: "Service Contract", showMeta: true, pageHeader: "first", pageFooter: "number" },
    layout: [section("price"), para("Wording."), section("signatures")],
    ...over,
  });
  const reasonOf = (input: unknown) => {
    const result = validateContractWording(input);
    return result.ok ? null : result.reason;
  };
  const many = (count: number, item: LayoutItem) => Array.from({ length: count }, () => item);

  test("C5525: a valid schema 2 body is accepted, and so is a schema 1 body", () => {
    expect(validateContractWording(body()).ok).toBe(true);
    expect(validateContractWording({ schema: 1, blocks: [{ type: "paragraph", text: "x" }] }).ok).toBe(true);
    expect(validateContractWording(body({ layout: [section("signatures", { customerLabel: "Client", contractorLabel: "For and on behalf of {{tenant.legalName}}", caption: "Signed electronically", nameField: true }), section("price")] })).ok).toBe(true);
  });

  test("C5525: price and signatures can sit at any position", () => {
    for (const layout of [
      [section("signatures"), para("x"), section("price")],
      [section("price"), section("signatures")],
      [para("x"), section("signatures"), section("equipment"), section("included"), section("price")],
    ]) {
      expect(validateContractWording(body({ layout })).ok).toBe(true);
    }
  });

  test.each<[string, unknown, string]>([
    ["a layout with no signatures", body({ layout: [section("price"), para("x")] }), "needs the signatures section"],
    ["a repeated signatures", body({ layout: [section("price"), section("signatures"), section("signatures")] }), "signatures section is in the layout more than once"],
    ["a missing price", body({ layout: [section("signatures")] }), "needs the price table"],
    ["an unknown section key", body({ layout: [section("price"), section("signatures"), { kind: "section", key: "footer" }] }), "does not have: footer"],
    ["a terms section", body({ layout: [section("price"), section("signatures"), section("terms")] }), "does not have: terms"],
    ["62 items", body({ layout: [...many(59, para("x")), section("price"), section("signatures"), section("schedule")] }), "too many items (62, at most 60)"],
    ["41 blocks", body({ layout: [...many(41, para("x")), section("price"), section("signatures")] }), "too many text blocks (41, at most 40)"],
    ["a text of 2,001 characters", body({ layout: [para("x".repeat(2001)), section("price"), section("signatures")] }), "too long (2001 characters, at most 2000)"],
    ["an unknown variable", body({ layout: [para("Hi {{nope}}"), section("price"), section("signatures")] }), "unknown variable: nope"],
    ["an unknown document option value", body({ doc: { title: "x", showMeta: true, pageHeader: "last", pageFooter: "number" } }), "page header must be first or every"],
    ["an unknown document option", body({ doc: { title: "x", showMeta: true, pageHeader: "first", pageFooter: "number", margin: 2 } }), "unknown key: margin"],
  ])("C5525: %s is refused with its own message", (_label, input, expected) => {
    expect(reasonOf(input)).toContain(expected);
  });

  test("C5525: exactly 61 items is refused as 61", () => {
    expect(reasonOf(body({ layout: [...many(59, para("x")), section("price"), section("signatures")] }))).toContain("too many items (61, at most 60)");
  });

  test("C5525: the ten refusals each have a message of their own", () => {
    const reasons = [
      body({ layout: [section("price"), para("x")] }),
      body({ layout: [section("price"), section("signatures"), section("signatures")] }),
      body({ layout: [section("signatures")] }),
      body({ layout: [section("price"), section("signatures"), { kind: "section", key: "footer" }] }),
      body({ layout: [section("price"), section("signatures"), section("terms")] }),
      body({ layout: [...many(59, para("x")), section("price"), section("signatures")] }),
      body({ layout: [...many(41, para("x")), section("price"), section("signatures")] }),
      body({ layout: [para("x".repeat(2001)), section("price"), section("signatures")] }),
      body({ layout: [para("Hi {{nope}}"), section("price"), section("signatures")] }),
      body({ doc: { title: "x", showMeta: true, pageHeader: "last", pageFooter: "number" } }),
    ].map(reasonOf);
    expect(reasons.every((reason) => reason !== null)).toBe(true);
    expect(new Set(reasons).size).toBe(10);
  });

  test("C5525: input that is not an object, schema 1 with an unknown variable and a schema 2 body with extra or missing keys are refused", () => {
    expect(reasonOf(null)).toContain("not an object");
    expect(reasonOf({ schema: 1, blocks: [{ type: "clause", text: "{{nope}}" }] })).toContain("unknown variable");
    expect(reasonOf({ ...body(), blocks: [] })).toContain("schema 2");
    expect(reasonOf({ schema: 2, layout: [] })).toContain("schema 2");
  });
});

const SETTINGS: OrgSettingsValue = {
  legalName: "Kettle Ridge Mechanical Ltd.",
  address: "100 Sample Street, Burnaby, BC",
  phone: "604-555-0100",
  accentColor: "#1f6f8b",
  repairDiscountPct: 10,
  cpiCapPct: 5,
  cancellationNoticeDays: 60,
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

describe("buildContractPreviewDocument", () => {
  const posted: ContractLayoutBody = {
    schema: 2,
    doc: { title: "Contract for {{customer.name}}", showMeta: false, pageHeader: "every", pageFooter: "letterhead" },
    layout: [para("Payable within {{terms.paymentDays}} from {{term.start}}."), section("price"), section("signatures", { nameField: true })],
  };
  const logo = { bytes: new Uint8Array([1, 2, 3]), format: "png" as const };

  test("C5531: the document carries the sample number, customer, site, a signer and one priced line, and the org's letterhead and terms", () => {
    const document = buildContractPreviewDocument(posted, SETTINGS, null, "2026-11-13");
    expect(document.number).toBe("AG-0000");
    expect(document.customerName).toBe("Sample Customer Ltd.");
    expect(document.site.name).toBe("Sample Site");
    expect(document.signer).toEqual({ name: "Sample Signer", email: "signer@example.test" });
    expect(document.lines).toHaveLength(1);
    expect(document.lines[0].annualCents).toBe(document.lines[0].visitsPerYear * document.lines[0].costPerVisitCents);
    expect(document.totalCents).toBe(document.lines[0].annualCents);
    expect(document.contractor).toEqual({ name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100", accent: "#1f6f8b" });
    expect(document.taxNote).toBe("GST extra");
  });

  test("C5531: the posted layout and options are the document's, with today's terms and the term start filled into the wording", () => {
    const document = buildContractPreviewDocument(posted, SETTINGS, null, "2026-11-13");
    expect(document.doc).toEqual({ title: "Contract for Sample Customer Ltd.", showMeta: false, pageHeader: "every", pageFooter: "letterhead" });
    expect(document.layout).toEqual([
      { kind: "block", type: "paragraph", text: "Payable within 30 days from November 13, 2026." },
      section("price"),
      section("signatures", { nameField: true }),
    ]);
  });

  test("C5531: the term runs from today for the org's default term, and the logo is the org's when it has one", () => {
    const document = buildContractPreviewDocument(posted, SETTINGS, logo, "2026-11-13");
    expect(document.term).toBe("Term: Nov 13, 2026 – Nov 12, 2027 (12 months)");
    expect(document.contractor.logo).toBe(logo);
    expect(buildContractPreviewDocument(posted, SETTINGS, null, "2026-11-13").contractor.logo).toBeUndefined();
  });

  test("C5531: a schema 1 body is drawn too, as the layout the contract always had", () => {
    const document = buildContractPreviewDocument(SYSTEM_CONTRACT_BODY, SETTINGS, null, "2026-11-13");
    expect(document.layout?.map((item) => (item.kind === "section" ? item.key : item.type))[0]).toBe("price");
    expect(document.body.filter((block) => block.type === "clause")).toHaveLength(6);
  });
});

describe("buildContractDocument, the layout", () => {
  const PARTIES: ContractParties = {
    contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street", phone: "604-555-0100" },
    customer: { name: "Fernwood Dental" },
    site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" },
    signer: { name: "Pat Lee", email: "pat@example.com" },
  };
  const SOURCE: DocumentSource = {
    number: "AG-1052",
    customer: { name: "Fernwood Dental" },
    site: { name: "Fernwood Dental, Main" },
    editable: false,
    shown: { versionNo: 1, lines: [], annualCents: 0 },
    serviceScope: { source: "live", takenAt: null, types: [] },
    terms: { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: 60, paymentDays: 30, governingProvince: "BC", taxNote: "GST extra", renewalNoticeDays: 30, cpiRenegotiationThresholdPct: 5 },
    term: { start: "2027-01-01", months: 12, end: "2027-12-31" },
    validUntil: null,
  };

  test("C5521: a contract built from the system wording has the layout the PDF drew before, the Signatures title included", () => {
    const { layout, doc, body } = buildContractDocument(SOURCE, PARTIES, null);
    expect(doc).toEqual({ title: "Service Contract", showMeta: true, pageHeader: "first", pageFooter: "number" });
    expect(layout?.slice(0, 4)).toEqual([section("price"), section("schedule"), section("included"), section("equipment")]);
    expect(layout?.slice(4, -1)).toEqual(body.map((block) => ({ kind: "block", type: block.type, text: block.text })));
    expect(layout?.at(-1)).toEqual({ kind: "section", key: "signatures", options: { heading: "Signatures" } });
    expect(body[0]).toEqual({ type: "heading", text: "Terms" });
  });

  test("C5527: a schema 2 wording can use the effective date, the tenant's address and phone, the signer and the tax note", () => {
    const template: ContractLayoutBody = {
      schema: 2,
      doc: { title: "Agreement effective {{term.start}}", showMeta: true, pageHeader: "first", pageFooter: "number" },
      layout: [para("{{tenant.legalName}}, {{tenant.address}}, {{tenant.phone}}. Signed by {{signer.name}}. {{terms.taxNote}}."), section("price"), section("signatures")],
    };
    const { doc, layout } = buildContractDocument(SOURCE, PARTIES, null, undefined, template);
    expect(doc?.title).toBe("Agreement effective January 1, 2027");
    expect(layout?.[0]).toEqual({ kind: "block", type: "paragraph", text: "Kettle Ridge Mechanical Ltd., 100 Sample Street, 604-555-0100. Signed by Pat Lee. GST extra." });
  });
});
