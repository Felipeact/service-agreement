import { describe, expect, test, vi } from "vitest";
import type { PortalReader, PortalView } from "@/application/ports";
import { makeViewPortal } from "@/application/use-cases";
import { portalView, TOKEN, testTokens } from "@/application/portal-view.testing";
import { reactPdfDocumentRenderer } from "@/infrastructure/documents";
import { pdfPages } from "@/infrastructure/documents/pdf-text.testing";

// The composition root is where the route and the real PDF adapter meet, so this is the one place a test may hold both.
let current: PortalView | null = portalView();
const reader: PortalReader = { view: async () => current };
const container = { viewPortal: makeViewPortal(reader, testTokens), documentRenderer: reactPdfDocumentRenderer };

vi.mock("@/composition", () => ({ getContainer: async () => container }));

const { GET } = await import("../app/review/[token]/pdf/route");

const call = () => GET(new Request(`http://localhost:3000/review/${TOKEN}/pdf`), { params: Promise.resolve({ token: TOKEN }) });
const textOf = async (response: Response) => pdfPages(Buffer.from(await response.arrayBuffer())).join("\n");

describe("the portal PDF route with the real renderer", () => {
  test("C930: an open link answers a PDF with the legal name, the number and the frozen repair discount", async () => {
    current = portalView();
    const response = await call();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="AG-1052-v1.pdf"');
    const body = Buffer.from(await response.clone().arrayBuffer());
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(body.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    const text = await textOf(response);
    expect(text).toContain("Kettle Ridge Mechanical Ltd.");
    expect(text).toContain("AG-1052");
    expect(text).toContain("10%");
  });

  test("C930: the PDF holds the frozen value, whatever the settings say now", async () => {
    // The route reads no settings at all: the view's terms are the version's. 15 is what Company settings might say now.
    current = portalView({ terms: { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: 30, paymentDays: 30, governingProvince: "BC", taxNote: null } });
    const text = await textOf(await call());
    expect(text).toContain("10%");
    expect(text).not.toContain("15%");
  });

  test("C930: a frozen version with no terms prints none, and no DRAFT mark", async () => {
    current = portalView({ terms: null });
    const text = await textOf(await call());
    expect(text).not.toContain("Repair discount");
    expect(text).not.toContain("DRAFT");
  });

  test("C930: a decided and a superseded link answer a PDF too", async () => {
    current = portalView({ agreement: { number: "AG-1052", status: "accepted" }, decision: { status: "accepted", decidedAt: new Date(), reason: null } });
    expect((await call()).status).toBe(200);
    current = portalView({ link: { versionNo: 1, current: false, revoked: false, revokedAt: null, firstViewedAt: null } });
    expect((await call()).status).toBe(200);
  });
});
