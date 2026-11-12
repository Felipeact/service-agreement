import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { AgreementTerms } from "@/domain/agreement";
import type { ContractParties } from "./parties";
import { renderBlocks, SYSTEM_CONTRACT_BODY, templateValues, TEMPLATE_VARIABLES, validateBlocks, type TemplateBody } from "./template";

const TERMS: AgreementTerms = {
  repairDiscountPct: 10,
  cpiCapPct: 5,
  cancellationNoticeDays: 60,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: null,
  renewalNoticeDays: 30,
  cpiRenegotiationThresholdPct: 5,
};

const PARTIES: ContractParties = {
  contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: null, phone: null },
  customer: { name: "Fernwood Dental" },
  site: { name: "Fernwood Dental, Main", address: null },
  signer: null,
};

const render = (body: TemplateBody, terms: AgreementTerms | null = TERMS, months = 12, parties: ContractParties | null = PARTIES) =>
  renderBlocks(body, templateValues(terms, months, parties));
const texts = (body: TemplateBody, terms: AgreementTerms | null = TERMS) => render(body, terms).map((block) => block.text);
const body = (...blocks: { type: string; text: string }[]) => ({ schema: 1, blocks }) as TemplateBody;

const SENTENCES = [
  "Invoices are payable within 30 days.",
  "Either party may cancel this contract with 60 days' written notice.",
  "Repair work is discounted by 10%.",
  "The annual price may rise with CPI, capped at 5%.",
  "This contract is governed by the laws of British Columbia.",
  "This contract renews for successive 12 months terms unless CPI is at or above 5%, when the parties renegotiate; the customer is notified 30 days before the end date.",
];

describe("the system wording", () => {
  test("C5211: the system version renders a heading then the six sentences", () => {
    expect(render(SYSTEM_CONTRACT_BODY)).toEqual([{ type: "heading", text: "Terms" }, ...SENTENCES.map((text) => ({ type: "clause", text }))]);
  });

  test("C5211: the code's system version is the stored version 1", () => {
    const migration = readFileSync(new URL("../../../supabase/migrations/20261112230000_contract_templates.sql", import.meta.url), "utf8");
    const stored = /\$body\$([\s\S]*?)\$body\$/.exec(migration)?.[1];
    expect(JSON.parse(stored ?? "null")).toEqual(SYSTEM_CONTRACT_BODY);
  });
});

describe("a clause with a value missing", () => {
  test.each([
    ["paymentDays", { paymentDays: null }, 1],
    ["cancellationNoticeDays", { cancellationNoticeDays: null }, 2],
    ["governingProvince", { governingProvince: null }, 5],
    ["renewalNoticeDays", { renewalNoticeDays: null }, 6],
    ["cpiRenegotiationThresholdPct", { cpiRenegotiationThresholdPct: null }, 6],
  ])("C5212: a null %s omits exactly its clause and keeps the other five in order", (_name, over, dropped) => {
    const expected = SENTENCES.filter((_, index) => index + 1 !== dropped);
    expect(texts(SYSTEM_CONTRACT_BODY, { ...TERMS, ...over }).slice(1)).toEqual(expected);
  });
});

describe("headings and paragraphs", () => {
  test("C5213: a heading or paragraph with a missing value is printed with it replaced by nothing", () => {
    const out = render(body({ type: "heading", text: "Pay {{terms.paymentDays}}" }, { type: "paragraph", text: "Within {{terms.paymentDays}} of invoice." }), { ...TERMS, paymentDays: null });
    expect(out).toEqual([
      { type: "heading", text: "Pay " },
      { type: "paragraph", text: "Within  of invoice." },
    ]);
  });
});

describe("validation", () => {
  test("C5214: a variable outside the list is rejected by name, and renders as no value", () => {
    const unknown = body({ type: "clause", text: "Fee {{terms.unknown}}." }, { type: "paragraph", text: "See {{terms.unknown}}." });
    const checked = validateBlocks(unknown);
    expect(checked.ok).toBe(false);
    expect(!checked.ok && checked.reason).toContain("terms.unknown");
    expect(render(unknown)).toEqual([{ type: "paragraph", text: "See ." }]);
  });

  test("C5215: the schema, the block type, the block count and the text length are each rejected with their own reason", () => {
    const reasons = [
      validateBlocks({ schema: 2, blocks: [] }),
      validateBlocks({ schema: 1, blocks: [{ type: "image", text: "x" }] }),
      validateBlocks({ schema: 1, blocks: Array.from({ length: 61 }, () => ({ type: "paragraph", text: "x" })) }),
      validateBlocks({ schema: 1, blocks: [{ type: "paragraph", text: "x".repeat(2001) }] }),
    ].map((result) => (result.ok ? null : result.reason));
    expect(reasons.every((reason) => reason !== null)).toBe(true);
    expect(new Set(reasons).size).toBe(4);
    expect(reasons[0]).toMatch(/schema/i);
    expect(reasons[1]).toContain("image");
    expect(reasons[2]).toContain("61");
    expect(reasons[3]).toContain("2001");
  });

  test("C5215: 60 blocks and a text of 2,000 characters are accepted", () => {
    expect(validateBlocks({ schema: 1, blocks: Array.from({ length: 60 }, () => ({ type: "paragraph", text: "x" })) }).ok).toBe(true);
    expect(validateBlocks({ schema: 1, blocks: [{ type: "paragraph", text: "x".repeat(2000) }] }).ok).toBe(true);
  });

  test("C5215: input that is not an object with a list of blocks is rejected", () => {
    for (const input of [null, "x", 3, { schema: 1 }, { schema: 1, blocks: "no" }, { schema: 1, blocks: [null] }, { schema: 1, blocks: [{ type: "clause" }] }]) {
      expect(validateBlocks(input).ok).toBe(false);
    }
  });
});

describe("values", () => {
  const value = (name: (typeof TEMPLATE_VARIABLES)[number], terms: AgreementTerms | null = TERMS, months = 12) => templateValues(terms, months, PARTIES)[name];

  test("C5216: days, the cancellation notice and percentages read right", () => {
    expect(value("terms.paymentDays", { ...TERMS, paymentDays: 1 })).toBe("1 day");
    expect(value("terms.paymentDays")).toBe("30 days");
    expect(value("terms.cancellationNoticeDays", { ...TERMS, cancellationNoticeDays: 1 })).toBe("1 day's");
    expect(value("terms.cancellationNoticeDays")).toBe("60 days'");
    expect(value("terms.repairDiscountPct")).toBe("10%");
    expect(value("terms.repairDiscountPct", { ...TERMS, repairDiscountPct: 10.0 })).toBe("10%");
    expect(value("terms.cpiCapPct", { ...TERMS, cpiCapPct: 7.5 })).toBe("7.5%");
    expect(value("terms.repairDiscountPct", { ...TERMS, repairDiscountPct: 0 })).toBe("0%");
  });

  test("C5217: a value that looks like a variable is printed as it is and not expanded", () => {
    const parties = { ...PARTIES, customer: { name: "{{terms.paymentDays}}" } };
    expect(renderBlocks(body({ type: "paragraph", text: "For {{customer.name}}." }), templateValues(TERMS, 12, parties))).toEqual([
      { type: "paragraph", text: "For {{terms.paymentDays}}." },
    ]);
  });

  test("C5218: with no frozen terms the system version renders nothing, not even its heading", () => {
    expect(render(SYSTEM_CONTRACT_BODY, null)).toEqual([]);
  });

  test("C5219: the whitelist is exactly these eleven names", () => {
    expect([...TEMPLATE_VARIABLES].sort()).toEqual(
      [
        "customer.name",
        "province",
        "site.name",
        "tenant.legalName",
        "term.label",
        "terms.cancellationNoticeDays",
        "terms.cpiCapPct",
        "terms.cpiRenegotiationThresholdPct",
        "terms.paymentDays",
        "terms.renewalNoticeDays",
        "terms.repairDiscountPct",
      ].sort(),
    );
  });

  test.each(TEMPLATE_VARIABLES.map((name) => [name]))("C5219: %s resolves for a full context, and is usable in a clause", (name) => {
    const values = templateValues(TERMS, 12, PARTIES);
    expect(values[name]).toEqual(expect.any(String));
    expect(values[name]).not.toBe("");
    const out = renderBlocks(body({ type: "clause", text: `[{{${name}}}]` }), values);
    expect(out).toEqual([{ type: "clause", text: `[${values[name]}]` }]);
    expect(validateBlocks(body({ type: "clause", text: `[{{ ${name} }}]` })).ok).toBe(true);
  });

  test("C5219: the contract's own words come from the parties", () => {
    expect(value("tenant.legalName")).toBe("Kettle Ridge Mechanical Ltd.");
    expect(value("customer.name")).toBe("Fernwood Dental");
    expect(value("site.name")).toBe("Fernwood Dental, Main");
    expect(value("term.label", TERMS, 24)).toBe("24 months");
    expect(value("province")).toBe("British Columbia");
  });
});
