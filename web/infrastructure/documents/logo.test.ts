import { inflateSync } from "node:zlib";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_ITEM_WORDS } from "@/domain/org-settings";
import type { AgreementDocument } from "@/domain/agreement";
import { logoBox, logoSize } from "./logo";
import { renderWithoutLogoOnFailure } from "./logo-fallback";
import { corruptPngBytes, jpegHeaderBytes, pngBytes } from "./logo.testing";
import { reactPdfContractRenderer, reactPdfDocumentRenderer } from "./index";
import { pdfPages } from "./pdf-text.testing";

afterEach(() => vi.restoreAllMocks());

describe("the logo's draw box", () => {
  test("C3325: it fits inside 160 by 48 pt keeping the aspect ratio, and a smaller image keeps its own size", () => {
    expect(logoBox(400, 100)).toEqual({ width: 160, height: 40 });
    expect(logoBox(100, 400)).toEqual({ width: 12, height: 48 });
    expect(logoBox(50, 50)).toEqual({ width: 48, height: 48 });
    expect(logoBox(80, 20)).toEqual({ width: 80, height: 20 });
    expect(logoBox(320, 96)).toEqual({ width: 160, height: 48 });
  });

  test("a PNG's and a JPEG's pixel size is read from the header; a JPEG with no frame reads null", () => {
    expect(logoSize({ bytes: pngBytes(120, 36), format: "png" })).toEqual({ width: 120, height: 36 });
    expect(logoSize({ bytes: jpegHeaderBytes(640, 200), format: "jpg" })).toEqual({ width: 640, height: 200 });
    expect(logoSize({ bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 2]), format: "jpg" })).toBeNull();
  });
});

const agreement: AgreementDocument = {
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
  terms: [],
  term: "Term: not recorded for this version",
  validity: null,
};

describe("a logo the renderer cannot draw", () => {
  test("C3329: the agreement PDF still renders, without the image, and one line is logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const bytes = await reactPdfDocumentRenderer.renderAgreement({ ...agreement, tenant: { ...agreement.tenant, logo: { bytes: corruptPngBytes(100, 40), format: "png" } } });
    expect(Buffer.from(bytes).toString("latin1")).not.toContain("/Subtype /Image");
    expect(pdfPages(bytes).join("\n")).toContain("Kettle Ridge Mechanical Ltd.");
    expect(error).toHaveBeenCalledTimes(1);
  });

  test("C3329: the contract PDF still renders, without the image, and one line is logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { buildContractDocument } = await import("@/domain/contract");
    void buildContractDocument;
    const contract = {
      number: "AG-1052",
      versionNo: 1,
      contractor: { name: "Kettle Ridge Mechanical Ltd.", address: null, phone: null, accent: "#1f6f8b", logo: { bytes: corruptPngBytes(100, 40), format: "png" as const } },
      customerName: "Fernwood Dental",
      site: { name: "Main", address: "12 Oak Ave" },
      signer: { name: "Pat Lee", email: "pat@example.com" },
      lines: agreement.lines,
      totalCents: agreement.totalCents,
      schedule: [],
      scope: agreement.scope,
      term: agreement.term,
      words: DEFAULT_ITEM_WORDS,
      body: [{ type: "heading", text: "Terms" }, { type: "clause", text: "One clause." }],
    } as unknown as Parameters<typeof reactPdfContractRenderer.renderContract>[0];
    const bytes = await reactPdfContractRenderer.renderContract(contract);
    expect(Buffer.from(bytes).toString("latin1")).not.toContain("/Subtype /Image");
    expect(pdfPages(bytes).join("\n")).toContain("Kettle Ridge Mechanical Ltd.");
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("renderWithoutLogoOnFailure", () => {
  test("C3329: a render that throws with a logo is run again without it and logs one line; without a logo the error stands", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const logo = { bytes: pngBytes(10, 10), format: "png" as const };
    const render = vi.fn(async (doc: { tenant: { logo?: unknown } }) => {
      if (doc.tenant.logo) throw new Error("bad image");
      return new Uint8Array([1]);
    });
    expect(await renderWithoutLogoOnFailure({ tenant: { logo } }, logo, render)).toEqual(new Uint8Array([1]));
    expect(render).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[1][0]).toEqual({ tenant: {} });
    expect(error).toHaveBeenCalledTimes(1);
    await expect(renderWithoutLogoOnFailure({ tenant: {} }, undefined, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
  });
});

/** The drawing operators of every content stream of a PDF, inflated. */
function operators(pdf: Uint8Array): string {
  const raw = Buffer.from(pdf).toString("latin1");
  const out: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      out.push(inflateSync(Buffer.from(match[1], "latin1")).toString("latin1"));
    } catch {
      // not a compressed stream
    }
  }
  return out.join("\n");
}

describe("the logo as drawn", () => {
  test("C3326: a 320 by 96 logo is drawn 160 by 48 pt, and a 100 by 400 one 12 by 48 pt (the box, not the natural size)", async () => {
    const wide = await reactPdfDocumentRenderer.renderAgreement({ ...agreement, tenant: { ...agreement.tenant, logo: { bytes: pngBytes(320, 96), format: "png" } } });
    expect(operators(wide)).toMatch(/\b160 0 0 -48 0 48 cm\n\/I1 Do/);
    const tall = await reactPdfDocumentRenderer.renderAgreement({ ...agreement, tenant: { ...agreement.tenant, logo: { bytes: pngBytes(100, 400), format: "png" } } });
    expect(operators(tall)).toMatch(/\b12 0 0 -48 \S+ \S+ cm\n\/I1 Do/);
  });

  test("C3326: a decodable JPEG logo is drawn too, so the format reaches the renderer (a png-only path would drop it)", async () => {
    const jpeg = new Uint8Array(Buffer.from(TINY_JPEG, "base64"));
    const pdf = await reactPdfDocumentRenderer.renderAgreement({ ...agreement, tenant: { ...agreement.tenant, logo: { bytes: jpeg, format: "jpg" } } });
    expect(Buffer.from(pdf).toString("latin1")).toContain("/Subtype /Image");
    expect(operators(pdf)).toMatch(/\b1 0 0 -1 \S+ \S+ cm\n\/I1 Do/);
  });
});

/** A 1 by 1 pixel JPEG. */
const TINY_JPEG = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
