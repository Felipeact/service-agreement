import { describe, expect, test } from "vitest";
import { contractClauses, type ContractDocument, type RenderedBlock } from "@/domain/contract";
import type { AgreementTerms } from "@/domain/agreement";
import { itemWords } from "@/domain/org-settings";
import { reactPdfContractRenderer } from "./index";
import { TermsBlocks } from "./contract-pdf";
import { styles } from "./pdf-sections";
import { pdfColours, pdfPages, winAnsi } from "./pdf-text.testing";
import { pngBytes } from "./logo.testing";

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

/** The Terms heading and one clause block per sentence, or nothing for no sentences: what the system wording renders to. */
const termsBody = (clauses: string[]): RenderedBlock[] =>
  clauses.length === 0 ? [] : [{ type: "heading", text: "Terms" }, ...clauses.map((text): RenderedBlock => ({ type: "clause", text }))];

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
  body: termsBody(contractClauses(TERMS, 12)),
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
    const all = unwrapped(await pages({ body: termsBody(contractClauses(terms, 12)) }));
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

describe("the DocuSeal tags in the signature blocks", () => {
  const TAGS = [
    "{{Sig;role=Customer;type=signature}}",
    "{{Date;role=Customer;type=date}}",
    "{{Sig;role=Contractor;type=signature}}",
    "{{Date;role=Contractor;type=date}}",
  ];
  const compact = (all: string[]) => unwrapped(all).replace(/\s+/g, "");

  test("C1713: the four tags appear once each, the Customer pair after the customer's heading and before the Contractor pair", async () => {
    const all = await pages();
    const flat = compact(all);
    for (const tag of TAGS) {
      expect(flat.split(tag).length - 1, tag).toBe(1);
    }
    const at = TAGS.map((tag) => flat.indexOf(tag));
    const customerHeading = flat.indexOf("FortheCustomer:PatLee");
    expect(customerHeading).toBeGreaterThan(-1);
    expect(at[0]).toBeGreaterThan(customerHeading);
    expect(at[1]).toBeGreaterThan(at[0]);
    expect(at[2]).toBeGreaterThan(at[1]);
    expect(at[3]).toBeGreaterThan(at[2]);
    expect(flat.indexOf("ForKettleRidgeMechanicalLtd.")).toBeGreaterThan(at[1]);
    expect(flat.indexOf("ForKettleRidgeMechanicalLtd.")).toBeLessThan(at[2]);
  });

  test("C1713: with no hyphen removed a tag still reads verbatim, because it fits its line and the word cut applies only where a word must wrap", async () => {
    // A cut would insert a hyphen every 12 characters (`{{Sig;role=C-ustomer;...`); `unwrapped` hides that, so read the raw text.
    const raw = text(await pages()).replace(/\s+/g, "");
    for (const tag of TAGS) expect(raw, tag).toContain(tag);
  });

  test("C1714: with 40 clauses the last page holds both headings and all four tags", async () => {
    const clauses = Array.from({ length: 40 }, (_, i) => `Clause ${i + 1}: Invoices are payable within 30 days of receipt by the customer.`);
    const all = await pages({ body: termsBody(clauses) });
    expect(all.length).toBeGreaterThan(1);
    const last = compact([all[all.length - 1]]);
    expect(last).toContain("FortheCustomer:PatLee");
    expect(last).toContain("ForKettleRidgeMechanicalLtd.");
    for (const tag of TAGS) expect(last, tag).toContain(tag);
  });
});

describe("the contract PDF, item words", () => {
  test("C2023: the contract's covered-items section is headed with the org's plural, and the default keeps Equipment", async () => {
    const scope = { kind: "listed" as const, recordedOn: null, types: [{ code: "AHU", name: "AHU", tasks: [], assets: [{ unitNo: "A-1", typeModel: null, location: null }] }] };
    const set = text(await pages({ scope, words: itemWords("station", "stations") }));
    expect(set).toContain("Stations");
    expect(set).not.toMatch(/Equipment/i);
    expect(text(await pages({ scope }))).toContain("Equipment");
  });
});

describe("the contract PDF, with a logo", () => {
  const withLogo: ContractDocument = { ...base, contractor: { ...base.contractor, logo: { bytes: pngBytes(320, 96), format: "png" } } };

  test("C3327: with a logo the PDF holds an image object; with none it holds none and says what it said before", async () => {
    const drawn = await reactPdfContractRenderer.renderContract(withLogo);
    const plain = await reactPdfContractRenderer.renderContract(base);
    expect(Buffer.from(drawn).toString("latin1")).toContain("/Subtype /Image");
    expect(Buffer.from(plain).toString("latin1")).not.toContain("/Subtype /Image");
    // The logo makes room above the name, so a line may move to the next page: the same words appear, in a different place.
    const words = (bytes: Uint8Array) => pdfPages(bytes).join(" ").replace(/Page \d+ of \d+/g, "").split(/\s+/).filter(Boolean).sort();
    expect(words(drawn)).toEqual(words(plain));
  });
});

describe("the template's blocks on the contract", () => {
  const custom: RenderedBlock[] = [
    { type: "heading", text: "Our agreement" },
    { type: "paragraph", text: "Paragraph words here." },
    { type: "clause", text: "Clause words here." },
  ];

  test("C5221: the blocks come after the scope and before the signatures, in their own order", async () => {
    const all = winAnsi(text(await pages({ body: custom })));
    expect(inOrder(indexOfIn(all, "Equipment", "Our agreement", "Paragraph words here.", "Clause words here.", "For the Customer: Pat Lee"))).toBe(true);
    expect(all).not.toContain("Invoices are payable");
  });

  test("C5221: a heading is drawn in the second-level heading style with the accent, a paragraph and a clause in body text with 4 points below", () => {
    const accent = { color: "#1f6f8b" };
    // The element tree is read as plain objects: an adapter test imports no UI library.
    type Node = { props: { style: unknown; children: string } };
    const fragment = TermsBlocks({ body: custom, accent }) as unknown as { props: { children: unknown } };
    const nodes = ([] as unknown[]).concat(fragment.props.children).flat() as Node[];
    expect(nodes.map((node) => node.props.children)).toEqual(["Our agreement", "Paragraph words here.", "Clause words here."]);
    expect(nodes[0].props.style).toEqual([styles.h2, accent]);
    expect(nodes[1].props.style).toEqual({ marginBottom: 4 });
    expect(nodes[2].props.style).toEqual({ marginBottom: 4 });
  });

  test("C5222: an empty body draws no Terms section and still ends with the signatures", async () => {
    const all = winAnsi(text(await pages({ body: [] })));
    expect(all).not.toContain("Terms");
    expect(all).toContain("For the Customer: Pat Lee");
  });
});
