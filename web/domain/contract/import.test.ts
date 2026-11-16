import { describe, expect, test } from "vitest";
import type { OrgSettingsValue } from "../org-settings";
import { IMPORT_VARIABLES, importedWordingForm, validateSplitBlocks } from "./import";
import { buildContractPreviewDocument, DEFAULT_CONTRACT_DOC, validateContractWording } from "./layout";
import { layoutFromRows } from "../agreement/layout-form";
import { TEMPLATE_VARIABLES } from "./template";

const clause = (text: string) => ({ type: "clause", text });

describe("importedWordingForm", () => {
  test("C5801: the form is the price section, the blocks in the order given, then the signatures section, with the default options, and is storable", () => {
    const blocks = [
      { type: "heading", text: "Terms" },
      { type: "paragraph", text: "This contract is between {{tenant.legalName}} and {{customer.name}}." },
      clause("Invoices are payable within 15 days."),
    ];
    const form = importedWordingForm(blocks)!;
    expect(form.doc).toEqual(DEFAULT_CONTRACT_DOC);
    expect(form.layout.map((row) => (row.kind === "block" ? `${row.type}:${row.text}` : `section:${row.key}`))).toEqual([
      "section:price",
      "heading:Terms",
      "paragraph:This contract is between {{tenant.legalName}} and {{customer.name}}.",
      "clause:Invoices are payable within 15 days.",
      "section:signatures",
    ]);
    expect(validateContractWording({ schema: 2, doc: form.doc, layout: layoutFromRows(form.layout) }).ok).toBe(true);
  });
});

describe("validateSplitBlocks bounds", () => {
  const many = (count: number) => Array.from({ length: count }, () => clause("x"));

  test("C5802: 1 and 40 blocks and 2,000 characters pass; 0 and 41 blocks, blank text, 2,001 characters, an unknown type and a non-string text fail", () => {
    expect(validateSplitBlocks(many(1))).toHaveLength(1);
    expect(validateSplitBlocks(many(40))).toHaveLength(40);
    expect(validateSplitBlocks([clause("a".repeat(2000))])).not.toBeNull();
    expect(validateSplitBlocks([])).toBeNull();
    expect(validateSplitBlocks(many(41))).toBeNull();
    expect(validateSplitBlocks([clause("")])).toBeNull();
    expect(validateSplitBlocks([clause("   ")])).toBeNull();
    expect(validateSplitBlocks([clause("a".repeat(2001))])).toBeNull();
    expect(validateSplitBlocks([{ type: "table", text: "x" }])).toBeNull();
    expect(validateSplitBlocks([{ type: "clause", text: 5 }])).toBeNull();
    expect(validateSplitBlocks("clauses")).toBeNull();
    expect(validateSplitBlocks([null])).toBeNull();
  });
});

describe("import variables", () => {
  test.each(IMPORT_VARIABLES)("C5803: {{%s}} is accepted, also with spaces inside the braces", (name) => {
    expect(validateSplitBlocks([clause(`Between {{${name}}} and {{ ${name} }}.`)])).not.toBeNull();
  });

  const refused = TEMPLATE_VARIABLES.filter((name) => !(IMPORT_VARIABLES as readonly string[]).includes(name));

  test("C5803: the whitelist names outside the import set are exactly the eight terms and province names", () => {
    expect([...refused].sort()).toEqual(
      ["province", "terms.cancellationNoticeDays", "terms.cpiCapPct", "terms.cpiRenegotiationThresholdPct", "terms.paymentDays", "terms.renewalNoticeDays", "terms.repairDiscountPct", "terms.taxNote"].sort(),
    );
  });

  test.each([...refused, "nope"])("C5803: {{%s}} refuses the whole answer", (name) => {
    expect(validateSplitBlocks([clause("fine"), clause(`Within {{${name}}}.`)])).toBeNull();
    expect(importedWordingForm([clause(`Within {{${name}}}.`)])).toBeNull();
  });
});

describe("an imported clause with an empty variable", () => {
  const SETTINGS: OrgSettingsValue = {
    legalName: "Kettle Ridge Mechanical Ltd.",
    address: "",
    phone: "604-555-0100",
    accentColor: "#1f6f8b",
    repairDiscountPct: 10,
    cpiCapPct: 5,
    cancellationNoticeDays: 60,
    paymentDays: 30,
    governingProvince: "BC",
    taxNote: "",
    defaultTermMonths: 12,
    renewalNoticeDays: 30,
    cpiRenegotiationThresholdPct: 5,
    renewalCpiPct: null,
    renewalCpiAsOf: null,
    proposalValidityDays: 30,
    itemSingular: "equipment",
    itemPlural: "equipment",
  };
  const body = (address: string | null) => {
    const form = importedWordingForm([clause("The contractor is located at {{tenant.address}}."), clause("Work is done by {{tenant.legalName}}.")])!;
    const checked = validateContractWording({ schema: 2, doc: form.doc, layout: layoutFromRows(form.layout) });
    if (!checked.ok) throw new Error("not storable");
    return buildContractPreviewDocument(checked.body, { ...SETTINGS, address: address as string }, null, "2026-11-13");
  };
  const texts = (document: ReturnType<typeof body>) => (document.layout ?? []).flatMap((item) => (item.kind === "block" ? [item.text] : []));

  test("C5812: the clause naming {{tenant.address}} is left out when the tenant has no address, and drawn when it has one", () => {
    expect(texts(body(null))).toEqual(["Work is done by Kettle Ridge Mechanical Ltd.."]);
    expect(texts(body("100 Sample Street"))).toEqual(["The contractor is located at 100 Sample Street.", "Work is done by Kettle Ridge Mechanical Ltd.."]);
  });
});
