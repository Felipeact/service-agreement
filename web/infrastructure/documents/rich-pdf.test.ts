import { afterEach, describe, expect, test, vi } from "vitest";
import { buildAgreementDocument, type AgreementDocument, type AgreementTemplateBodyV3 } from "@/domain/agreement";
import { buildContractDocument, type ContractDocument } from "@/domain/contract";
import { DEFAULT_ITEM_WORDS, type OrgSettingsValue } from "@/domain/org-settings";
import type { RichDoc } from "@/domain/rich-document";
import { renderAgreementPdf } from "./agreement-pdf";
import { renderContractPdf, signerTags } from "./contract-pdf";
import { hasImage } from "./logo-fallback";
import { corruptPngBytes, pngBytes } from "./logo.testing";
import { pdfColours, pdfPages } from "./pdf-text.testing";

/** A designed page (schema 3, rich-templates) drawn in the agreement and contract PDFs. */

const ORG = "11111111-1111-4111-8111-111111111111";
const PHOTO = `${ORG}/22222222-2222-4222-8222-222222222222.png`;
const GONE = `${ORG}/33333333-3333-4333-8333-333333333333.png`;

const SETTINGS: OrgSettingsValue = {
  legalName: "Kettle Ridge HVAC",
  address: "1 Main St",
  phone: "555-0100",
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

const SOURCE = {
  number: "AG-1052",
  customer: { name: "Fernwood Dental" },
  site: { name: "Main office" },
  editable: false,
  shown: {
    versionNo: 2,
    lines: [{ description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000, visitMonths: [3, 6, 9, 12], equipment: [] }],
    annualCents: 180000,
  },
  serviceScope: { source: "not_recorded" as const },
  terms: SETTINGS,
  term: { start: "2026-12-01", months: 12, end: "2027-11-30" },
  validUntil: null,
};

const PAGE: RichDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1, textAlign: "center" }, content: [{ type: "text", text: "Maintenance plan for " }, { type: "variable", attrs: { name: "customer.name" } }] },
    { type: "paragraph", content: [{ type: "text", text: "Coloured words", marks: [{ type: "textStyle", attrs: { color: "#be123c", fontSize: "18px", fontFamily: "serif" } }, { type: "bold" }] }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "First point" }] }] }] },
    { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Third point" }] }] }] },
    {
      type: "table",
      content: [
        { type: "tableRow", content: [{ type: "tableHeader", attrs: { background: "#dbeafe" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Season" }] }] }, { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Work" }] }] }] },
        { type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Spring" }] }] }, { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Start the chillers" }] }] }] },
      ],
    },
    { type: "section", attrs: { key: "price", options: { title: "Your investment" } } },
    { type: "pageBreak" },
    { type: "paragraph", content: [{ type: "text", text: "After the break" }] },
    { type: "image", attrs: { asset: PHOTO, width: 50, align: "center" } },
    { type: "horizontalRule" },
    { type: "section", attrs: { key: "terms" } },
    { type: "paragraph", content: [{ type: "text", text: "Visit our site", marks: [{ type: "link", attrs: { href: "https://example.com" } }] }] },
  ],
};

const BODY: AgreementTemplateBodyV3 = {
  schema: 3,
  name: "Designed",
  description: "",
  doc: { title: "", showMeta: false, pageHeader: "first", pageFooter: "number" },
  content: PAGE,
  preset: { termMonths: null, lines: [] },
};

const document = (content: RichDoc = PAGE): AgreementDocument => buildAgreementDocument(SOURCE, SETTINGS, { ...BODY, content });
const text = (bytes: Uint8Array) => pdfPages(bytes);
const loader = (bytes: Record<string, Uint8Array>) => vi.fn(async (key: string) => (bytes[key] ? { bytes: bytes[key], format: "png" as const } : null));

afterEach(() => vi.restoreAllMocks());

describe("a designed page in the agreement PDF", () => {
  test("text, fields, lists, a table and the live sections print in the page's order, with the break starting a new page", async () => {
    const pages = text(await renderAgreementPdf(document(), loader({ [PHOTO]: pngBytes(400, 200) })));
    const first = pages[0];
    for (const part of ["Maintenance plan for Fernwood Dental", "Coloured words", "First point", "3.", "Third point", "Season", "Work", "Spring", "Start the chillers", "Your investment", "Quarterly visit"]) {
      expect(first).toContain(part);
    }
    expect(first.indexOf("Start the chillers")).toBeLessThan(first.indexOf("Your investment"));
    expect(first).not.toContain("After the break");
    expect(pages[1]).toContain("After the break");
    expect(pages[1]).toContain("Repair discount");
    expect(pages[1]).toContain("Visit our site");
  });

  test("the text colour, the cell fill and the accent all reach the PDF", async () => {
    const colours = pdfColours(await renderAgreementPdf(document()));
    expect(colours.has("#be123c")).toBe(true);
    expect(colours.has("#dbeafe")).toBe(true);
  });

  test("an uploaded picture is drawn from the loader; one that cannot be read is left out and the PDF still goes out", async () => {
    const load = loader({ [PHOTO]: pngBytes(400, 200) });
    expect(hasImage(await renderAgreementPdf(document(), load))).toBe(true);
    expect(load).toHaveBeenCalledWith(PHOTO);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const missing = await renderAgreementPdf(document({ type: "doc", content: [{ type: "image", attrs: { asset: GONE, width: 50, align: "left" } }, { type: "paragraph", content: [{ type: "text", text: "Still here" }] }] }), loader({}));
    expect(hasImage(missing)).toBe(false);
    expect(text(missing).join(" ")).toContain("Still here");
    const broken = await renderAgreementPdf(document(), loader({ [PHOTO]: corruptPngBytes(10, 10) }));
    expect(text(broken).join(" ")).toContain("Coloured words");
    error.mockRestore();
  });

  test("without a loader no picture is fetched, and a document with no designed page is passed on unchanged", async () => {
    const plain = buildAgreementDocument(SOURCE, SETTINGS);
    const load = vi.fn();
    const before = text(await renderAgreementPdf(plain));
    expect(text(await renderAgreementPdf(plain, load))).toEqual(before);
    expect(load).not.toHaveBeenCalled();
  });

  test("a field with no value prints nothing, and a hide-when-empty paragraph is left out", async () => {
    const page: RichDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Signer: " }, { type: "variable", attrs: { name: "signer.name" } }, { type: "text", text: " end" }] },
        { type: "paragraph", attrs: { omitIfMissing: true }, content: [{ type: "text", text: "Signed by " }, { type: "variable", attrs: { name: "signer.name" } }] },
      ],
    };
    const all = text(await renderAgreementPdf(document(page))).join(" ");
    expect(all).toContain("Signer:  end");
    expect(all).not.toContain("Signed by");
  });
});

describe("a designed page in the contract PDF", () => {
  const contract = (content: RichDoc): ContractDocument =>
    buildContractDocument(SOURCE, { contractor: { legalName: "Kettle Ridge HVAC", address: null, phone: null }, customer: { name: "Fernwood Dental" }, site: { name: "Main office", address: null }, signer: { name: "Pat Lee", email: "pat@example.com" } }, "#1f6f8b", DEFAULT_ITEM_WORDS, {
      schema: 3,
      doc: { title: "Service contract", showMeta: true, pageHeader: "first", pageFooter: "number" },
      content,
    });

  test("the signatures section prints the signing tags the signing service reads, exactly as before", async () => {
    const page: RichDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Agreed between " }, { type: "variable", attrs: { name: "tenant.legalName" } }] }, { type: "section", attrs: { key: "signatures", options: { customerLabel: "Client" } } }] };
    const all = text(await renderContractPdf(contract(page))).join(" ");
    expect(all).toContain("Agreed between Kettle Ridge HVAC");
    expect(all).toContain("Client");
    // The tags are drawn in small white type and may wrap: read the text with the spaces squeezed out, as the contract tests do.
    const squeezed = all.replace(/\s+/g, "");
    for (const role of ["Customer", "Contractor"] as const) {
      expect(squeezed.split(signerTags(role).signature).length - 1).toBe(1);
      expect(squeezed.split(signerTags(role).date).length - 1).toBe(1);
    }
  });
});

describe("the page header in the PDF", () => {
  const HEADER: RichDoc = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "variable", attrs: { name: "tenant.legalName" } }, { type: "text", text: " Mechanical Group" }] }, { type: "paragraph", content: [{ type: "text", text: "Licensed and insured" }] }] };
  const withHeader = (header: RichDoc | null | undefined, pageHeader: "first" | "every" = "first") =>
    buildAgreementDocument(SOURCE, SETTINGS, { ...BODY, doc: { ...BODY.doc, pageHeader }, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Body" }] }, { type: "pageBreak" }, { type: "paragraph", content: [{ type: "text", text: "Second" }] }] }, ...(header === undefined ? {} : { header }) });

  test("a designed header is drawn with its fields filled, above the page, on the first page only by default", async () => {
    const pages = text(await renderAgreementPdf(withHeader(HEADER)));
    expect(pages[0]).toContain("Kettle Ridge HVAC Mechanical Group");
    expect(pages[0].indexOf("Licensed and insured")).toBeLessThan(pages[0].indexOf("Body"));
    expect(pages[1]).not.toContain("Licensed and insured");
  });

  test("on every page when the page options say so", async () => {
    const pages = text(await renderAgreementPdf(withHeader(HEADER, "every")));
    expect(pages[1]).toContain("Licensed and insured");
  });

  test("no header (null) draws none, and a body without the key keeps the old letterhead", async () => {
    const none = text(await renderAgreementPdf(withHeader(null))).join(" ");
    expect(none).not.toContain("1 Main St");
    expect(none).toContain("Body");
    const legacy = text(await renderAgreementPdf(withHeader(undefined))).join(" ");
    expect(legacy).toContain("1 Main St");
  });
});
