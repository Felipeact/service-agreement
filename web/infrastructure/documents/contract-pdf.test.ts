import { describe, expect, test } from "vitest";
import { contractClauses, type ContractDocument } from "@/domain/contract";
import type { AgreementTerms } from "@/domain/agreement";
import { reactPdfContractRenderer } from "./index";
import { pdfColours, pdfPages, winAnsi } from "./pdf-text.testing";

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

const asset = (unitNo: string) => ({ unitNo, typeModel: "Model X", location: "Roof" });

const base: ContractDocument = {
  number: "AG-1052",
  versionNo: 1,
  contractor: { name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100", accent: "#1f6f8b" },
  customerName: "Fernwood Dental",
  site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" },
  signer: { name: "Pat Lee", email: "pat@example.com" },
  lines: [
    { description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 },
    { description: "Filter change", visitsPerYear: 2, costPerVisitCents: 94500, annualCents: 189000 },
  ],
  totalCents: 369000,
  schedule: [
    { month: 3, equipment: ["Rooftop unit"], tasks: [] },
    { month: 9, equipment: ["Rooftop unit"], tasks: [] },
  ],
  scope: {
    kind: "listed",
    recordedOn: null,
    types: [{ code: "RTU", name: "Rooftop unit", tasks: [{ description: "Replace filters", visitMonths: null }], assets: [asset("RTU-1"), asset("RTU-2")] }],
  },
  term: "Term: Jan 1, 2027 – Dec 31, 2027 (12 months)",
  taxNote: "GST extra",
  clauses: contractClauses(TERMS, 12),
  mark: null,
};

async function render(over: Partial<ContractDocument> = {}) {
  return reactPdfContractRenderer.renderContract({ ...base, ...over });
}
const pages = async (over: Partial<ContractDocument> = {}) => pdfPages(await render(over));
const text = (all: string[]) => all.join("\n");
const unwrapped = (all: string[]) => text(all).replace(/-\n/g, "").replace(/\n/g, "");
const indexOfIn = (haystack: string, ...needles: string[]) => needles.map((needle) => haystack.indexOf(needle));
const inOrder = (positions: number[]) => positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1]));

/** Enough equipment that the contract needs three pages, so the signature blocks cannot sit on page 1. */
const long = (): Partial<ContractDocument> => ({
  scope: {
    kind: "listed",
    recordedOn: null,
    types: Array.from({ length: 2 }, (_, t) => ({
      code: `T${t}`,
      name: `Type ${t + 1}`,
      tasks: [{ description: "Inspect", visitMonths: null }],
      assets: Array.from({ length: 18 }, (_, a) => asset(`T${t}-${a}`)),
    })),
  },
});

describe("the contract PDF, rendered", () => {
  test("C1641: the pages are Letter size", async () => {
    const raw = Buffer.from(await render()).toString("latin1");
    expect(raw).toMatch(/\/MediaBox \[\s*0 0 612 792\s*\]/);
  });

  test("C1641: page 1 is headed Service Contract with the number, and prints the parties", async () => {
    const [first] = await pages();
    expect(first.startsWith("Kettle Ridge Mechanical Ltd.")).toBe(true);
    for (const expected of [
      "Service Contract",
      "AG-1052",
      "100 Sample Street, Burnaby, BC",
      "604-555-0100",
      "Fernwood Dental",
      "Fernwood Dental, Main",
      "12 Oak Ave",
      "Pat Lee",
      "pat@example.com",
    ]) {
      expect(first, expected).toContain(expected);
    }
    expect(inOrder(indexOfIn(first, "Kettle Ridge Mechanical Ltd.", "100 Sample Street, Burnaby, BC", "604-555-0100", "Service Contract"))).toBe(true);
  });

  test("C1641: the contractor's accent colour is the one drawn, and a different accent replaces it", async () => {
    expect(pdfColours(await render()).has("#1f6f8b")).toBe(true);
    const other = pdfColours(await render({ contractor: { ...base.contractor, accent: "#b45309" } }));
    expect(other.has("#b45309")).toBe(true);
    expect(other.has("#1f6f8b")).toBe(false);
  });

  test("C1641: a contractor with no address or phone and a site with no address print no empty or null line", async () => {
    const [first] = await pages({ contractor: { ...base.contractor, address: null, phone: null }, site: { name: "Fernwood Dental, Main", address: null } });
    expect(first).not.toMatch(/null|undefined/);
  });

  test("C1641: a contract with no signer still renders, and names none", async () => {
    const all = text(await pages({ signer: null }));
    expect(all).not.toMatch(/null|undefined/);
    expect(all).toContain("For the Customer");
    expect(all).not.toContain("Pat Lee");
  });

  test("C1642: the sections come in the agreement's order, then the clauses, then the signatures", async () => {
    const all = winAnsi(text(await pages()));
    expect(
      inOrder(
        indexOfIn(
          all,
          "Term: Jan 1, 2027 \x96 Dec 31, 2027 (12 months)",
          "Quarterly visit",
          "Total per year",
          "before tax",
          "GST extra",
          "Visit schedule",
          "Service included",
          "Equipment",
          "Invoices are payable within 30 days.",
          "For the Customer: Pat Lee",
        ),
      ),
    ).toBe(true);
    for (const expected of ["$450.00", "$1,800.00", "$945.00", "$1,890.00", "$3,690.00"]) expect(all, expected).toContain(expected);
  });

  test("C1643: every clause is printed once, in full", async () => {
    // Whitespace is taken out of both sides: a wrapped line loses its trailing space in the PDF text.
    const all = unwrapped(await pages()).replace(/\s+/g, "");
    for (const clause of contractClauses(TERMS, 12)) {
      const squeezed = clause.replace(/\s+/g, "");
      expect(all.split(squeezed).length - 1, clause).toBe(1);
    }
    expect(all).toContain("Repairworkisdiscountedby10%.");
    expect(all).toContain("ThiscontractisgovernedbythelawsofBritishColumbia.");
  });

  test("C1643: a null payment, cancellation, governing province and renewal print none of those four clauses", async () => {
    const terms = { ...TERMS, paymentDays: null, cancellationNoticeDays: null, governingProvince: null, renewalNoticeDays: null };
    const all = unwrapped(await pages({ clauses: contractClauses(terms, 12) }));
    for (const absent of ["Invoices are payable", "Either party may cancel", "governed by the laws", "renews for successive"]) expect(all, absent).not.toContain(absent);
    expect(all).toContain("Repair work is discounted by 10%.");
    expect(all).toContain("capped at 3%.");
  });

  test("C1644: the last page of a three-page contract holds both signature blocks, each with a Signature and a Date line", async () => {
    const all = await pages(long());
    expect(all).toHaveLength(3);
    const last = all[2];
    // Each label is looked for after the one before it, because the heading "Signatures" also contains "Signature".
    const customer = last.indexOf("For the Customer: Pat Lee");
    const customerSignature = last.indexOf("Signature", customer);
    const customerDate = last.indexOf("Date", customerSignature);
    const contractor = last.indexOf("For Kettle Ridge Mechanical Ltd.", customerDate);
    const contractorSignature = last.indexOf("Signature", contractor);
    const contractorDate = last.indexOf("Date", contractorSignature);
    expect(inOrder([customer, customerSignature, customerDate, contractor, contractorSignature, contractorDate])).toBe(true);
    for (const earlier of all.slice(0, 2)) expect(earlier).not.toContain("For the Customer");
  });

  test("C1645: every page of a three-page contract carries its own Page x of 3 and the number, and none says DRAFT", async () => {
    const all = await pages(long());
    expect(all).toHaveLength(3);
    all.forEach((page, index) => {
      expect(page).toContain(`Page ${index + 1} of 3`);
      expect(page).toContain("AG-1052");
    });
    expect(text(all)).not.toContain("DRAFT");
  });
});
