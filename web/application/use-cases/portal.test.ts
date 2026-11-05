import { describe, expect, test, vi } from "vitest";
import type { PortalDecider, PortalReader, PortalViewRecorder } from "@/application/ports";
import { portalView, TOKEN, testTokens } from "@/application/portal-view.testing";
import { makeDecidePortal, makeRecordPortalView, makeViewPortal, portalDocument, portalScope, portalViewState } from "./portal";

const HASH = testTokens.hash(TOKEN);

describe("viewPortal", () => {
  test("C925: it reads the hash of the token, never the token", async () => {
    const view = vi.fn<PortalReader["view"]>(async () => portalView());
    await makeViewPortal({ view }, testTokens)(TOKEN);
    expect(view).toHaveBeenCalledWith(HASH);
  });

  test.each(["", "A".repeat(42), "A".repeat(44), `${"A".repeat(42)}+`, `${"A".repeat(42)} `])("C910: %j is null with no read", async (token) => {
    const view = vi.fn<PortalReader["view"]>();
    expect(await makeViewPortal({ view }, testTokens)(token)).toBeNull();
    expect(view).not.toHaveBeenCalled();
  });
});

describe("recordPortalView", () => {
  test("C929: it records the hash once per call and ignores a malformed token", async () => {
    const record = vi.fn<PortalViewRecorder["record"]>();
    const run = makeRecordPortalView({ record }, testTokens);
    await run(TOKEN);
    await run("short");
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(HASH);
  });
});

describe("decidePortal", () => {
  test("C924: a not-open decision that is on record, on a revoked link, is not a success", async () => {
    const decide = vi.fn<PortalDecider["decide"]>(async () => ({ ok: false, code: "not_open" }));
    const view = vi.fn<PortalReader["view"]>(async () =>
      portalView({
        link: { versionNo: 1, current: true, revoked: true, revokedAt: new Date(), firstViewedAt: null },
        agreement: { number: "AG-1052", status: "accepted" },
        decision: { status: "accepted", decidedAt: new Date(), reason: null },
      }),
    );
    const result = await makeDecidePortal({ view }, { decide }, testTokens)(TOKEN, "accept", "");
    expect(result).toMatchObject({ ok: false, code: "not_open" });
  });

  test("C919: a database failure is thrown, not turned into a refusal", async () => {
    const decide = vi.fn<PortalDecider["decide"]>(async () => {
      throw new Error("boom");
    });
    await expect(makeDecidePortal({ view: vi.fn() }, { decide }, testTokens)(TOKEN, "accept", "")).rejects.toThrow("boom");
  });
});

describe("the link's content", () => {
  test("C909: a scope document becomes a frozen scope, and anything else is not recorded", () => {
    expect(portalScope(portalView())).toMatchObject({ source: "frozen", types: [{ code: "RTU" }] });
    expect(portalScope(portalView({ scope: null }))).toEqual({ source: "not_recorded" });
    expect(portalScope(portalView({ scope: { schema: 2 } }))).toEqual({ source: "not_recorded" });
  });

  test("C930: the document is the tenant's paper with the version's frozen terms and no draft mark", () => {
    const document = portalDocument(portalView());
    expect(document?.tenant.accent).toBe("#1f6f8b");
    expect(document?.mark).toBeNull();
    expect(document?.terms.map((term) => term.label)).toEqual([
      "Repair discount",
      "CPI cap",
      "Cancellation notice",
      "Payment terms",
      "Governing province",
      "Tax note",
    ]);
  });

  test("C935: a version without terms prints none", () => {
    expect(portalDocument(portalView({ terms: null }))?.terms).toEqual([]);
  });

  test("C932: no settings row, no document", () => {
    expect(portalDocument(portalView({ tenant: null }))).toBeNull();
  });

  test("C908: a missing view is the unknown state", () => {
    expect(portalViewState(null)).toBe("unknown");
    expect(portalViewState(portalView())).toBe("open");
  });
});
