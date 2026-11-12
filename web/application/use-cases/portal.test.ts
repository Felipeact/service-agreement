import { describe, expect, test, vi } from "vitest";
import type { PortalDecider, PortalReader, PortalViewRecorder } from "@/application/ports";
import { portalView, TOKEN, testTokens } from "@/application/portal-view.testing";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { makeDecidePortal, makeRecordPortalView, makeViewPortal, portalDocument, portalScope, portalTemplate, portalTemplateText, portalViewState } from "./portal";

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

describe("the link's template", () => {
  const BODY = {
    schema: 1,
    name: "Welcome",
    description: "",
    intro: [{ type: "paragraph", text: "Welcome {{customer.name}}, payment within {{terms.paymentDays}}." }],
    footer: [{ type: "paragraph", text: "Thank you, {{tenant.legalName}}." }],
    sections: { schedule: false, scope: true },
    preset: { termMonths: null, lines: [] },
  };

  test("C5330: the document is built from the frozen version's body", () => {
    const document = portalDocument(portalView({ template: BODY }));
    expect(document?.intro).toEqual([{ type: "paragraph", text: "Welcome Fernwood Dental, payment within 30 days." }]);
    expect(document?.footer).toEqual([{ type: "paragraph", text: "Thank you, Kettle Ridge Mechanical Ltd.." }]);
    expect(document?.sections).toEqual({ schedule: false, scope: true });
    expect(document?.schedule).toEqual([]);
  });

  test("C5330: the review page text is the PDF's: the same blocks and flags for the same view", () => {
    const view = portalView({ template: BODY });
    const document = portalDocument(view);
    expect(portalTemplateText(view)).toEqual({ intro: document?.intro, footer: document?.footer, sections: document?.sections });
  });

  test("C5330: a view with no template key is an older document and uses the system body", () => {
    expect(portalTemplate(portalView())).toEqual(SYSTEM_AGREEMENT_BODY);
    expect(portalDocument(portalView())?.intro).toEqual([]);
  });

  test.each<[string, unknown]>([
    ["missing (the database found none)", null],
    ["not an object", "x"],
    ["schema 2", { ...BODY, schema: 2 }],
    ["an unknown variable", { ...BODY, intro: [{ type: "paragraph", text: "{{nope}}" }] }],
  ])("C5330: a template that is %s fails and draws nothing", (_label, template) => {
    expect(() => portalDocument(portalView({ template }))).toThrow();
    expect(() => portalTemplateText(portalView({ template }))).toThrow();
  });
});
