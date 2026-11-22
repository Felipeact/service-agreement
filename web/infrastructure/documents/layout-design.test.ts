import { describe, expect, test } from "vitest";
import type { AgreementDocument, LayoutItem } from "@/domain/agreement";
import { DEFAULT_ITEM_WORDS } from "@/domain/org-settings";
import { reactPdfDocumentRenderer } from "./index";
import { pdfColours, pdfPages } from "./pdf-text.testing";

/** Design of a template (rich-template-editor slice 1): the theme's colour and font, text style and free-text tables, as the PDF draws them. */

const DOC = { title: "Maintenance schedule", showMeta: true, pageHeader: "first", pageFooter: "number" } as const;

const base: AgreementDocument = {
  tenant: { name: "Service Pacts", address: null, phone: null, accent: "#1f6f8b" },
  words: DEFAULT_ITEM_WORDS,
  number: "AG-1052",
  versionNo: 1,
  customerName: "Fernwood Dental",
  siteName: "Fernwood Dental, Main",
  mark: null,
  lines: [{ description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 }],
  totalCents: 180000,
  schedule: [],
  scope: { kind: "listed", recordedOn: null, types: [] },
  terms: [],
  term: "Term: not recorded for this version",
  validity: null,
};

const TABLE: LayoutItem = { kind: "table", header: true, rows: [["Visit", "What we do"], ["Spring", "Start up the cooling units"], ["Fall", "Shut down and drain"]] };
const PRICE: LayoutItem = { kind: "section", key: "price" };

const draw = async (layout: LayoutItem[], doc: AgreementDocument["doc"] = DOC) => reactPdfDocumentRenderer.renderAgreement({ ...base, doc, layout });

describe("a template's design, drawn in the agreement PDF", () => {
  test("a table prints its heading row and every cell, in order, before the price lines it sits above", async () => {
    const bytes = await draw([TABLE, PRICE]);
    const text = pdfPages(bytes).join("\n");
    for (const cell of ["Visit", "What we do", "Spring", "Start up the cooling units", "Fall", "Shut down and drain"]) expect(text).toContain(cell);
    expect(text.indexOf("Start up the cooling units")).toBeLessThan(text.indexOf("Service and price"));
  });

  test("a theme accent replaces the company's colour on the page; without one the company's colour stands", async () => {
    const themed = pdfColours(await draw([TABLE, PRICE], { ...DOC, theme: { accent: "violet" } }));
    expect(themed.has("#6d28d9")).toBe(true);
    expect(themed.has("#1f6f8b")).toBe(false);
    const plain = pdfColours(await draw([TABLE, PRICE]));
    expect(plain.has("#1f6f8b")).toBe(true);
    expect(plain.has("#6d28d9")).toBe(false);
  });

  test("a serif theme sets the body in Times and a plain document stays in Helvetica", async () => {
    const serif = Buffer.from(await draw([PRICE], { ...DOC, theme: { font: "serif" } })).toString("latin1");
    expect(serif).toContain("Times-Roman");
    const sans = Buffer.from(await draw([PRICE])).toString("latin1");
    expect(sans).not.toContain("Times-Roman");
  });

  test("a bold, italic, centred paragraph draws in its own face", async () => {
    const styled: LayoutItem = { kind: "block", type: "paragraph", text: "Thank you for your business.", style: { align: "center", bold: true, italic: true } };
    const raw = Buffer.from(await draw([PRICE, styled])).toString("latin1");
    expect(raw).toContain("Helvetica-BoldOblique");
    expect(pdfPages(await draw([PRICE, styled])).join("\n")).toContain("Thank you for your business.");
  });
});
