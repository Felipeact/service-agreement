import { describe, expect, test, vi } from "vitest";
import type { PortalView } from "@/application/ports";
import { portalView } from "@/application/portal-view.testing";
import { reactPdfDocumentRenderer } from "@/infrastructure/documents";
import { pdfPages } from "@/infrastructure/documents/pdf-text.testing";

// The composition root is where the route and the real PDF adapter meet, so this is the one place a test may hold both.
let view: PortalView = portalView();
const container = { viewPortal: async () => view, documentRenderer: reactPdfDocumentRenderer, logo: { load: async () => null } };

vi.mock("@/composition", () => ({ getContainer: async () => container }));

const { GET } = await import("../app/review/[token]/pdf/route");

const render = async (over: Partial<PortalView>) => {
  view = portalView(over);
  const response = await GET(new Request("http://localhost:3000/review/t/pdf"), { params: Promise.resolve({ token: "t" }) });
  expect(response.status).toBe(200);
  return pdfPages(Buffer.from(await response.arrayBuffer())).join(" ");
};

describe("the review PDF prints the validity date from the real renderer", () => {
  test("C1238: a view with a date prints Valid until; one with none prints no validity line", async () => {
    expect(await render({ validUntil: "2026-12-02" })).toContain("Valid until Dec 2, 2026");
    expect(await render({ validUntil: null })).not.toContain("Valid until");
  });
});
