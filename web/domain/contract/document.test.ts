import { describe, expect, test } from "vitest";
import type { AgreementTerms, DocumentSource } from "@/domain/agreement";
import { PROVINCES } from "@/domain/org-settings";
import { buildContractDocument, contractClauses } from "./document";
import type { ContractParties } from "./parties";

const TERMS: AgreementTerms = {
  repairDiscountPct: 10,
  cpiCapPct: 3,
  cancellationNoticeDays: 60,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: "GST extra",
  renewalNoticeDays: 30,
  cpiRenegotiationThresholdPct: 5,
};

const PARTIES: ContractParties = {
  contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100" },
  customer: { name: "Fernwood Dental" },
  site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" },
  signer: { name: "Pat Lee", email: "pat@example.com" },
};

const source = (over: Partial<DocumentSource> = {}): DocumentSource => ({
  number: "AG-1052",
  customer: { name: "Other" },
  site: { name: "Other site" },
  editable: false,
  shown: {
    versionNo: 1,
    lines: [{ description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000, visitMonths: [3, 6, 9, 12], equipment: [{ code: "RTU", name: "Rooftop unit" }] }],
    annualCents: 180000,
  },
  serviceScope: { source: "frozen", takenAt: new Date("2026-10-20T15:00:00Z"), types: [] },
  terms: TERMS,
  term: { start: "2027-01-01", months: 12, end: "2027-12-31" },
  validUntil: null,
  ...over,
});

describe("contractClauses", () => {
  test("C1639: every term set gives its sentence, in order", () => {
    expect(contractClauses(TERMS, 12)).toEqual([
      "Invoices are payable within 30 days.",
      "Either party may cancel this contract with 60 days' written notice.",
      "Repair work is discounted by 10%.",
      "The annual price may rise with CPI, capped at 3%.",
      "This contract is governed by the laws of British Columbia.",
      "This contract renews for successive 12 months terms unless CPI is at or above 5%, when the parties renegotiate; the customer is notified 30 days before the end date.",
    ]);
  });

  test("C1639: a day reads in the singular", () => {
    expect(contractClauses({ ...TERMS, paymentDays: 1 }, 12)).toContain("Invoices are payable within 1 day.");
    expect(contractClauses({ ...TERMS, cancellationNoticeDays: 1 }, 12)).toContain("Either party may cancel this contract with 1 day's written notice.");
  });

  test("C1639: a repair discount of 0 still prints", () => {
    expect(contractClauses({ ...TERMS, repairDiscountPct: 0 }, 12)).toContain("Repair work is discounted by 0%.");
  });

  test("C1639: a decimal percentage prints without trailing zeros", () => {
    expect(contractClauses({ ...TERMS, cpiCapPct: 2.5 }, 12)).toContain("The annual price may rise with CPI, capped at 2.5%.");
  });

  test.each([
    ["payment", { paymentDays: null }, "Invoices are payable"],
    ["cancellation", { cancellationNoticeDays: null }, "Either party may cancel"],
    ["governing law", { governingProvince: null }, "governed by the laws"],
    ["renewal notice", { renewalNoticeDays: null }, "renews for successive"],
    ["renewal threshold", { cpiRenegotiationThresholdPct: null }, "renews for successive"],
  ])("C1639: a null %s gives no clause", (_name, over, text) => {
    expect(contractClauses({ ...TERMS, ...over }, 12).join("\n")).not.toContain(text);
  });

  test.each(PROVINCES.map((code) => [code]))("C1639: province %s prints its name, not its code", (code) => {
    const clause = contractClauses({ ...TERMS, governingProvince: code }, 12).find((text) => text.startsWith("This contract is governed"));
    expect(clause).toMatch(/^This contract is governed by the laws of [A-Za-z' ]+\.$/);
    expect(clause).not.toContain(`of ${code}.`);
  });

  test("C1639: the thirteen names", () => {
    const names = PROVINCES.map((code) => contractClauses({ ...TERMS, governingProvince: code }, 12).find((text) => text.startsWith("This contract is governed")));
    expect(names).toEqual([
      "This contract is governed by the laws of Alberta.",
      "This contract is governed by the laws of British Columbia.",
      "This contract is governed by the laws of Manitoba.",
      "This contract is governed by the laws of New Brunswick.",
      "This contract is governed by the laws of Newfoundland and Labrador.",
      "This contract is governed by the laws of Nova Scotia.",
      "This contract is governed by the laws of the Northwest Territories.",
      "This contract is governed by the laws of Nunavut.",
      "This contract is governed by the laws of Ontario.",
      "This contract is governed by the laws of Prince Edward Island.",
      "This contract is governed by the laws of Quebec.",
      "This contract is governed by the laws of Saskatchewan.",
      "This contract is governed by the laws of Yukon.",
    ]);
  });

  test("C1639: a code outside the list prints as stored", () => {
    expect(contractClauses({ ...TERMS, governingProvince: "XX" }, 12)).toContain("This contract is governed by the laws of XX.");
  });

  test("C1639: the renewal clause uses the version's term months", () => {
    expect(contractClauses(TERMS, 24).at(-1)).toContain("successive 24 months terms");
  });

  test("C1639: no frozen terms give no clause", () => {
    expect(contractClauses(null, 12)).toEqual([]);
  });
});

describe("buildContractDocument", () => {
  const document = buildContractDocument(source(), PARTIES, "#1f6f8b");

  test("C1640: the contractor, customer, site and signer come from the parties only", () => {
    expect(document.contractor).toEqual({ name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100", accent: "#1f6f8b" });
    expect(document.customerName).toBe("Fernwood Dental");
    expect(document.site).toEqual({ name: "Fernwood Dental, Main", address: "12 Oak Ave" });
    expect(document.signer).toEqual({ name: "Pat Lee", email: "pat@example.com" });
  });

  test("C1640: the clauses come from the source's frozen terms, and none without them", () => {
    const clauseTexts = (built: typeof document) => built.body.filter((block) => block.type === "clause").map((block) => block.text);
    expect(clauseTexts(document)).toEqual(contractClauses(TERMS, 12));
    expect(buildContractDocument(source({ terms: null }), PARTIES, "#1f6f8b").body).toEqual([]);
  });

  test("C5220: a contract's own template body is rendered in order; without one the system wording is", () => {
    const own = {
      schema: 1 as const,
      blocks: [
        { type: "heading" as const, text: "Our terms" },
        { type: "paragraph" as const, text: "This contract is between {{tenant.legalName}} and {{customer.name}}." },
        { type: "clause" as const, text: "Work is done at {{site.name}}." },
      ],
    };
    expect(buildContractDocument(source(), PARTIES, "#1f6f8b", undefined, own).body).toEqual([
      { type: "heading", text: "Our terms" },
      { type: "paragraph", text: "This contract is between Kettle Ridge Mechanical Ltd. and Fernwood Dental." },
      { type: "clause", text: "Work is done at Fernwood Dental, Main." },
    ]);
    const system = buildContractDocument(source(), PARTIES, "#1f6f8b").body;
    expect(system[0]).toEqual({ type: "heading", text: "Terms" });
    expect(system).toHaveLength(7);
  });

  test("C1640: it carries the agreement's number, version, lines, total, term, tax note and no draft mark", () => {
    expect(document).toMatchObject({
      number: "AG-1052",
      versionNo: 1,
      totalCents: 180000,
      term: "Term: Jan 1, 2027 – Dec 31, 2027 (12 months)",
      taxNote: "GST extra",
      mark: null,
    });
    expect(document.lines).toEqual([{ description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 }]);
    expect(document.schedule.map((row) => row.month)).toEqual([3, 6, 9, 12]);
  });

  test("C1640: a schedule never reads the settings, and the tax note is null when the terms hold none", () => {
    expect(buildContractDocument(source({ terms: { ...TERMS, taxNote: null } }), PARTIES, "#1f6f8b").taxNote).toBeNull();
    expect(buildContractDocument(source({ terms: null }), PARTIES, "#1f6f8b").taxNote).toBeNull();
  });
});
