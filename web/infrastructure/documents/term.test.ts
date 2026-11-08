import { DEFAULT_ITEM_WORDS } from "@/domain/org-settings";
import { describe, expect, test } from "vitest";
import type { AgreementDocument } from "@/domain/agreement";
import { reactPdfDocumentRenderer } from "./index";
import { pdfPages, winAnsi } from "./pdf-text.testing";

const RENEWAL =
  "Renews automatically for another 12 months with the CPI increase, capped at 3%. If CPI is 5% or more, the renewal is renegotiated. Notice is given 30 days before the end date.";

const base: AgreementDocument = {
  tenant: { name: "Kettle Ridge Mechanical Ltd.", address: null, phone: null, accent: "#1f6f8b" },
  words: DEFAULT_ITEM_WORDS,
  number: "AG-1052",
  versionNo: 1,
  customerName: "Fernwood Dental",
  siteName: "Main",
  mark: null,
  lines: [{ description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 }],
  totalCents: 180000,
  schedule: [],
  scope: { kind: "listed", recordedOn: null, types: [] },
  term: "Term: Jan 1, 2027 – Dec 31, 2027 (12 months)",
  validity: null,
  terms: [
    { label: "Repair discount", value: "10%" },
    { label: "CPI cap", value: "3%" },
    { label: "Renewal", value: RENEWAL },
  ],
};

const flat = (pages: string[]) => pages.join("\n").replace(/\s+/g, " ");

describe("the PDF's term", () => {
  test("C1155: the term line and the Renewal row print", async () => {
    const text = flat(pdfPages(await reactPdfDocumentRenderer.renderAgreement(base)));
    expect(text).toContain(winAnsi("Term: Jan 1, 2027 – Dec 31, 2027 (12 months)"));
    expect(text).toContain("Renewal");
    expect(text).toContain("If CPI is 5% or more, the renewal is renegotiated.");
  });

  test("C1155: a frozen version without renewal values prints no Renewal", async () => {
    const old = { ...base, term: "Term: not recorded for this version", terms: base.terms.slice(0, 2) };
    const text = flat(pdfPages(await reactPdfDocumentRenderer.renderAgreement(old)));
    expect(text).toContain("Term: not recorded for this version");
    expect(text).not.toContain("Renewal");
  });
});
