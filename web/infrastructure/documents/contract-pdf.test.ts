import { describe, expect, test } from "vitest";
import { buildContractDocument, contractClauses, SYSTEM_CONTRACT_BODY, type ContractDocument, type RenderedBlock } from "@/domain/contract";
import type { AgreementTerms, DocumentSource } from "@/domain/agreement";
import { itemWords } from "@/domain/org-settings";
import { reactPdfContractRenderer } from "./index";
import { customerNameTag, signerTags, TermsBlocks } from "./contract-pdf";
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

describe("the contract PDF, layout and options (block-editor)", () => {
  type Item = NonNullable<ContractDocument["layout"]>[number];
  const price: Item = { kind: "section", key: "price" };
  const signatures = (options?: Extract<Item, { key: "signatures" }>["options"]): Item => ({ kind: "section", key: "signatures", ...(options ? { options } : {}) });
  const heading = (value: string, extra: Partial<Extract<Item, { kind: "block" }>> = {}): Item => ({ kind: "block", type: "heading", text: value, ...extra });
  const para = (value: string, extra: Partial<Extract<Item, { kind: "block" }>> = {}): Item => ({ kind: "block", type: "paragraph", text: value, ...extra });
  const DOC = { title: "PREVENTIVE MAINTENANCE SERVICE AGREEMENT", showMeta: false, pageHeader: "first", pageFooter: "number" } as const;
  const draw = async (layout: Item[], doc: Partial<NonNullable<ContractDocument["doc"]>> = {}, over: Partial<ContractDocument> = {}) =>
    pages({ doc: { ...DOC, ...doc }, layout, ...over });
  const flat = (all: string[]) => unwrapped(all).replace(/\s+/g, "");

  test("C5522: the title, then the meta lines when showMeta, then the layout items in order, the schedules after the signatures each on a new page", async () => {
    const all = await draw([
      heading("1. Service provided"),
      para("The Contractor will maintain the equipment."),
      heading("2. Price & payment"),
      price,
      para("By signing, the Customer accepts this agreement."),
      signatures(),
      heading("SCHEDULE A - List of Equipment", { pageBreakBefore: true }),
      { kind: "section", key: "equipment" },
      heading("SCHEDULE B - Maintenance Task List", { pageBreakBefore: true }),
      { kind: "section", key: "included" },
    ]);
    const joined = text(all);
    expect(
      inOrder(
        indexOfIn(
          joined,
          "PREVENTIVE MAINTENANCE SERVICE AGREEMENT",
          "1. Service provided",
          "2. Price & payment",
          "Service and price",
          "By signing, the Customer accepts this agreement.",
          "For the Customer: Pat Lee",
          "SCHEDULE A - List of Equipment",
          "Equipment\n",
          "SCHEDULE B - Maintenance Task List",
          "Service included",
        ),
      ),
    ).toBe(true);
    const at = (needle: string) => all.findIndex((page) => page.includes(needle));
    expect(at("For the Customer: Pat Lee")).toBeGreaterThanOrEqual(0);
    expect(at("For the Customer: Pat Lee")).toBeLessThan(at("SCHEDULE A - List of Equipment"));
    expect(at("SCHEDULE A - List of Equipment")).toBeLessThan(at("SCHEDULE B - Maintenance Task List"));
    expect(all[at("SCHEDULE A - List of Equipment")].split("\n")[0]).toBe("SCHEDULE A - List of Equipment");
    expect(all[at("SCHEDULE B - Maintenance Task List")].split("\n")[0]).toBe("SCHEDULE B - Maintenance Task List");
  });

  test("C5522: the meta lines print with showMeta and are gone without, and the title stays", async () => {
    const off = text(await draw([price, signatures()], { showMeta: false }));
    for (const absent of ["Fernwood Dental", "12 Oak Ave", "pat@example.com", "Term: Jan 1, 2027"]) expect(off, absent).not.toContain(absent);
    expect(off).toContain("PREVENTIVE MAINTENANCE SERVICE AGREEMENT");
    const on = text(await draw([price, signatures()], { showMeta: true }));
    for (const present of ["Fernwood Dental", "12 Oak Ave", "pat@example.com", "Term: Jan 1, 2027"]) expect(on, present).toContain(present);
  });

  test("C5522: the page header and footer options apply to the contract: the letterhead on every page and the company name, address and phone at the foot", async () => {
    const all = await draw([price, { kind: "section", key: "included" }, { kind: "section", key: "equipment" }, signatures()], { pageHeader: "every", pageFooter: "letterhead" }, long());
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (const page of all) {
      expect(page.startsWith("Kettle Ridge Mechanical Ltd.")).toBe(true);
      expect(page.split("\n").slice(-3)).toEqual(["Kettle Ridge Mechanical Ltd.", "100 Sample Street, Burnaby, BC", "604-555-0100"]);
    }
  });

  test("C5522: a price option title and the price table inside the numbered wording", async () => {
    const joined = text(await draw([heading("2. Price & payment"), { kind: "section", key: "price", options: { title: "Service charge" } }, signatures()]));
    expect(joined).toContain("Service charge");
    expect(joined).not.toContain("Service and price");
    expect(joined.indexOf("2. Price & payment")).toBeLessThan(joined.indexOf("Service charge"));
  });

  test("C5523: the default customer block is headed For the Customer and the signer, the contractor block For the company, each with one Signature and one Date line and its tags", async () => {
    const all = await draw([price, signatures()]);
    const joined = text(all);
    expect(joined).toContain("For the Customer: Pat Lee");
    expect(joined).toContain("For Kettle Ridge Mechanical Ltd.");
    expect(joined.split("Signature\n").length - 1).toBe(2);
    expect(joined.split("Date\n").length - 1).toBe(2);
    const squeezed = flat(all);
    for (const tag of ["{{Sig;role=Customer;type=signature}}", "{{Date;role=Customer;type=date}}", "{{Sig;role=Contractor;type=signature}}", "{{Date;role=Contractor;type=date}}"]) {
      expect(squeezed.split(tag).length - 1, tag).toBe(1);
    }
    expect(joined).not.toContain("Name & title");
    expect(squeezed).not.toContain("{{Name;");
    expect(joined).not.toContain("Signed electronically");
    // A schema 2 signatures section has no title of its own.
    expect(joined).not.toContain("Signatures\n");
  });

  test("C5523: the labels and the caption replace the defaults, the caption under each heading", async () => {
    const joined = text(await draw([price, signatures({ customerLabel: "Client", contractorLabel: "For and on behalf of Kettle Ridge Mechanical Ltd.", caption: "Signed electronically" })]));
    const rows = joined.split("\n");
    const client = rows.indexOf("Client");
    expect(client).toBeGreaterThan(-1);
    expect(rows[client + 1]).toBe("Signed electronically");
    const contractor = rows.indexOf("For and on behalf of Kettle Ridge Mechanical Ltd.");
    expect(contractor).toBeGreaterThan(client);
    expect(rows[contractor + 1]).toBe("Signed electronically");
    expect(joined).not.toContain("For the Customer");
  });

  test("C5523: a schema 1 layout (no layout on the document) still prints the Signatures title before the blocks", async () => {
    const joined = text(await pages());
    expect(joined).toContain("Signatures\n");
    expect(joined.indexOf("Signatures\n")).toBeLessThan(joined.indexOf("For the Customer: Pat Lee"));
  });

  test("C5524: with nameField the customer block gains a Name & title (print) line carrying the Name tag, and the contractor block gains none", async () => {
    const all = await draw([price, signatures({ nameField: true })]);
    const joined = text(all);
    expect(joined.split("Name & title (print)").length - 1).toBe(1);
    const squeezed = flat(all);
    const tag = "{{Name;role=Customer;type=text}}";
    expect(squeezed.split(tag).length - 1).toBe(1);
    expect(squeezed.split("{{Name;").length - 1).toBe(1);
    const customer = squeezed.indexOf("FortheCustomer:PatLee");
    const contractor = squeezed.indexOf("ForKettleRidgeMechanicalLtd.");
    expect(squeezed.indexOf(tag)).toBeGreaterThan(customer);
    expect(squeezed.indexOf(tag)).toBeLessThan(contractor);
    // The existing four tags are still there.
    for (const kept of ["{{Sig;role=Customer;type=signature}}", "{{Date;role=Customer;type=date}}", "{{Sig;role=Contractor;type=signature}}", "{{Date;role=Contractor;type=date}}"]) expect(squeezed).toContain(kept);
  });

  test("C5524: the signature tags are exported with the new Name tag text", () => {
    expect(customerNameTag).toBe("{{Name;role=Customer;type=text}}");
    expect(signerTags("Customer")).toEqual({ signature: "{{Sig;role=Customer;type=signature}}", date: "{{Date;role=Customer;type=date}}" });
  });

  test("C5526: a contract built from a schema 1 body or the system wording prints the same text as the document without a layout", async () => {
    const SOURCE: DocumentSource = {
      number: "AG-1052",
      customer: { name: "Fernwood Dental" },
      site: { name: "Fernwood Dental, Main" },
      editable: false,
      shown: { versionNo: 1, lines: [{ id: "l", description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000, visitMonths: [3, 6, 9, 12], equipment: [{ code: "RTU", name: "Rooftop unit" }] }], annualCents: 180000 },
      serviceScope: { source: "live", takenAt: null, types: base.scope.kind === "listed" ? base.scope.types : [] },
      terms: TERMS,
      term: { start: "2027-01-01", months: 12, end: "2027-12-31" },
      validUntil: null,
    };
    const parties = { contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100" }, customer: { name: "Fernwood Dental" }, site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" }, signer: { name: "Pat Lee", email: "pat@example.com" } };
    for (const template of [SYSTEM_CONTRACT_BODY, { schema: 1 as const, blocks: [{ type: "paragraph" as const, text: "Org wording for {{customer.name}}." }] }]) {
      const built = buildContractDocument(SOURCE, parties, "#1f6f8b", undefined, template);
      const before: Partial<ContractDocument> = { ...built };
      delete before.layout;
      delete before.doc;
      const withLayout = pdfPages(await reactPdfContractRenderer.renderContract(built));
      const without = pdfPages(await reactPdfContractRenderer.renderContract(before as ContractDocument));
      expect(withLayout).toEqual(without);
      expect(text(withLayout)).toContain("Service Contract");
      expect(text(withLayout)).toContain("Signatures\n");
    }
    // A document built with no template is the system wording.
    expect(buildContractDocument(SOURCE, parties, "#1f6f8b").layout).toEqual(buildContractDocument(SOURCE, parties, "#1f6f8b", undefined, SYSTEM_CONTRACT_BODY).layout);
  });
});
