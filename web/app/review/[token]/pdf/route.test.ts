import { beforeEach, describe, expect, test, vi } from "vitest";
import type { DocumentRenderer, PortalReader, PortalView } from "@/application/ports";
import { makeViewPortal } from "@/application/use-cases";
import { portalView, TOKEN, testTokens } from "@/application/portal-view.testing";

const { rpc, currentMember, renderAgreement } = vi.hoisted(() => ({
  rpc: vi.fn(),
  currentMember: vi.fn(),
  renderAgreement: vi.fn<DocumentRenderer["renderAgreement"]>(),
}));

// Real use case and reader over a recording client: what the route calls is what reaches the database (C925).
vi.mock("@/composition", async () => {
  const { supabasePortalReader } = (await vi.importActual("@/infrastructure/supabase/portal")) as {
    supabasePortalReader: (client: unknown) => PortalReader;
  };
  const { testTokens: tokens } = (await vi.importActual("@/application/portal-view.testing")) as { testTokens: typeof testTokens };
  return {
    getContainer: async () => ({
      currentMember,
      viewPortal: makeViewPortal(supabasePortalReader({ rpc }), tokens),
      documentRenderer: { renderAgreement },
    }),
  };
});

const { GET, maxDuration } = await import("./route");

const call = (token = TOKEN) => GET(new Request(`http://localhost:3000/review/${token}/pdf`), { params: Promise.resolve({ token }) });

function answer(view: PortalView | null) {
  rpc.mockResolvedValue({
    data: view && {
      ...view,
      link: { ...view.link, revokedAt: view.link.revokedAt?.toISOString() ?? null, firstViewedAt: null },
      decision: view.decision && { ...view.decision, decidedAt: view.decision.decidedAt.toISOString() },
    },
    error: null,
  });
}

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
const decided = portalView({
  agreement: { number: "AG-1052", status: "accepted" },
  decision: { status: "accepted", decidedAt: new Date("2026-10-22T17:00:00Z"), reason: null },
});
const revoked = { versionNo: 1, current: true, revoked: true, revokedAt: new Date("2026-10-22T10:00:00Z"), firstViewedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  renderAgreement.mockResolvedValue(bytes);
});

describe("the portal PDF route", () => {
  test("C930: an open link answers 200 with the PDF, its filename and no-store", async () => {
    answer(portalView());
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="AG-1052-v1.pdf"');
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  test("C930: the renderer is given the tenant's paper and the frozen terms", async () => {
    answer(portalView());
    await call();
    expect(renderAgreement).toHaveBeenCalledTimes(1);
    const document = renderAgreement.mock.calls[0][0];
    expect(document.tenant).toEqual({ name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100", accent: "#1f6f8b" });
    expect(document.terms[0]).toEqual({ label: "Repair discount", value: "10%" });
    expect(document.mark).toBeNull();
    expect(document.totalCents).toBe(387000);
  });

  test.each([
    ["decided", decided],
    ["superseded", portalView({ link: { versionNo: 1, current: false, revoked: false, revokedAt: null, firstViewedAt: null } })],
  ])("C930: a %s link answers 200 too", async (_state, view) => {
    answer(view);
    expect((await call()).status).toBe(200);
  });

  test("C930: the filename carries the link's version", async () => {
    answer(portalView({ link: { versionNo: 3, current: true, revoked: false, revokedAt: null, firstViewedAt: null } }));
    expect((await call()).headers.get("Content-Disposition")).toBe('attachment; filename="AG-1052-v3.pdf"');
  });

  test.each([
    ["a malformed token", "short", null],
    ["a 44 character token", "A".repeat(44), null],
    ["an unknown token", TOKEN, null],
    ["replaced", TOKEN, portalView({ link: revoked })],
    ["withdrawn", TOKEN, portalView({ agreement: { number: "AG-1052", status: "withdrawn" } })],
    ["expired", TOKEN, portalView({ agreement: { number: "AG-1052", status: "expired" } })],
  ])("C931: %s answers an empty 404 and never renders", async (_name, token, view) => {
    answer(view);
    const response = await call(token);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(renderAgreement).not.toHaveBeenCalled();
  });

  test("C931: a link revoked after it was open answers 404 on the next call", async () => {
    answer(portalView());
    expect((await call()).status).toBe(200);
    answer(portalView({ link: revoked }));
    expect((await call()).status).toBe(404);
  });

  test("C932: a renderer that rejects answers an empty 503 and logs the cause", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    answer(portalView());
    renderAgreement.mockRejectedValue(new Error("layout exploded"));
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][1]).toEqual(new Error("layout exploded"));
    error.mockRestore();
  });

  test("C932: a portal_view that rejects answers an empty 503 and logs the cause", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(error).toHaveBeenCalledTimes(1);
    expect(renderAgreement).not.toHaveBeenCalled();
    error.mockRestore();
  });

  test("C932: a tenant with no settings row answers an empty 503 and logs the cause", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    answer(portalView({ tenant: null }));
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(String(error.mock.calls[0][1])).toContain("no settings row");
    expect(renderAgreement).not.toHaveBeenCalled();
    error.mockRestore();
  });

  test("C925: the recorded database calls are exactly portal_view", async () => {
    answer(portalView());
    await call();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["portal_view"]);
    expect(rpc).toHaveBeenCalledWith("portal_view", { p_token_hash: testTokens.hash(TOKEN) });
  });

  test("C939: the route never asks who the visitor is", async () => {
    answer(portalView());
    await call();
    expect(currentMember).not.toHaveBeenCalled();
  });

  test("C930: the route may run for 60 seconds", () => {
    expect(maxDuration).toBe(60);
  });
});
