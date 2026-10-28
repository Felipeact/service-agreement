import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PortalReader, PortalView } from "@/application/ports";
import { makeViewPortal } from "@/application/use-cases";
import { portalView, TOKEN, testTokens } from "@/application/portal-view.testing";

const { rpc, currentMember, notFound } = vi.hoisted(() => ({
  rpc: vi.fn(),
  currentMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// The container is built from the real portal use case and the real reader over a recording client, so what the page
// calls is what reaches the database (C925). An unknown link is a reader answering null.
vi.mock("@/composition", async () => {
  const { supabasePortalReader } = (await vi.importActual("@/infrastructure/supabase/portal")) as {
    supabasePortalReader: (client: unknown) => PortalReader;
  };
  const { testTokens: tokens } = (await vi.importActual("@/application/portal-view.testing")) as { testTokens: typeof testTokens };
  const reader = supabasePortalReader({ rpc });
  return { getContainer: async () => ({ currentMember, viewPortal: makeViewPortal(reader, tokens) }) };
});

const { ReviewForRequest } = await import("./page");
const { default: ReviewNotFound } = await import("./not-found");

/** `portal_view`'s document for a view, as the database returns it. */
function document(view: PortalView) {
  return {
    link: { ...view.link, revokedAt: view.link.revokedAt?.toISOString() ?? null, firstViewedAt: view.link.firstViewedAt?.toISOString() ?? null },
    agreement: view.agreement,
    tenant: view.tenant,
    customer: view.customer,
    site: view.site,
    lines: view.lines,
    annualCents: view.annualCents,
    scope: view.scope,
    terms: view.terms,
    decision: view.decision && { ...view.decision, decidedAt: view.decision.decidedAt.toISOString() },
  };
}

const answer = (view: PortalView | null) => rpc.mockResolvedValue({ data: view && document(view), error: null });
const render = async (token = TOKEN) => renderToStaticMarkup(await ReviewForRequest({ token }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the open page", () => {
  test("C909: it shows the tenant, the agreement, every line, the total and the terms", async () => {
    answer(portalView());
    const page = text(await render());
    for (const expected of [
      "Kettle Ridge Mechanical Ltd.",
      "100 Sample Street, Burnaby, BC",
      "604-555-0100",
      "AG-1052",
      "Version 1",
      "Fernwood Dental",
      "Fernwood Dental, Main",
      "Preventive maintenance visit",
      "4 visits per year",
      "$892.50 per visit",
      "$3,570.00",
      "Filter changes",
      "2 visits per year",
      "$150.00 per visit",
      "$300.00",
      "Total per year $3,870.00",
      "before tax",
      "Service included",
      "Equipment",
      "Repair discount 10%",
      "CPI cap 5%",
      "Cancellation notice 30 days",
      "Payment terms 30 days",
      "Governing province BC",
      "Tax note GST extra",
    ]) {
      expect(page, expected).toContain(expected);
    }
  });

  test("C909: with address and phone null the page holds no null or undefined text", async () => {
    answer(portalView({ tenant: { name: "Kettle Ridge Mechanical Ltd.", address: null, phone: null, accent: null } }));
    const html = await render();
    expect(html).not.toMatch(/null|undefined/);
  });

  test("C909: a term that is not set is not printed", async () => {
    answer(portalView({ terms: { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: null, paymentDays: null, governingProvince: null, taxNote: null } }));
    const page = text(await render());
    expect(page).toContain("Repair discount 10%");
    expect(page).not.toContain("Payment terms");
    expect(page).not.toContain("Tax note");
  });

  test("C911: the page prints the repair discount the version carries", async () => {
    answer(portalView({ terms: { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: 30, paymentDays: 30, governingProvince: "BC", taxNote: null } }));
    const page = text(await render());
    expect(page).toContain("Repair discount 10%");
    expect(page).not.toContain("15%");
  });
});

describe("a link that works for nobody", () => {
  test.each([
    ["empty", ""],
    ["42 characters", "A".repeat(42)],
    ["44 characters", "A".repeat(44)],
    ["a plus sign", "A".repeat(42) + "+"],
    ["a space", "A".repeat(42) + " "],
  ])("C910: %s is not found and asks the database nothing", async (_name, token) => {
    await expect(render(token)).rejects.toThrow("404");
    expect(notFound).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  test("C910: a well-formed token with no link is not found", async () => {
    answer(null);
    await expect(render()).rejects.toThrow("404");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  test("C910: the not-found page says what to do and names no tenant and no agreement", () => {
    const html = renderToStaticMarkup(createElement(ReviewNotFound));
    expect(text(html)).toContain("This link doesn't work. Ask the company that sent it for a new one.");
    expect(html).not.toContain("AG-");
    expect(html).not.toContain("Kettle Ridge");
  });
});

describe("the brand", () => {
  test("C912: the legal name heads the page and the accent colours the rule and the primary button", async () => {
    answer(portalView());
    const html = await render();
    expect(html).toMatch(/<header[^>]*>[\s\S]*Kettle Ridge Mechanical Ltd\.[\s\S]*<\/header>/);
    expect(html).toMatch(/data-accent-rule="" style="background-color:#1f6f8b"/);
    expect(html).toMatch(/<button[^>]*style="background-color:#1f6f8b;color:#ffffff"[^>]*>Accept<\/button>/);
  });

  test("C912: the page names no product", async () => {
    answer(portalView());
    expect(await render()).not.toMatch(/Service Agreement/i);
  });

  test("C912: with accent null the neutral accent is used", async () => {
    answer(portalView({ tenant: { name: "Acme", address: null, phone: null, accent: null } }));
    expect(await render()).toContain("background-color:#374151;color:#ffffff");
  });

  test("C912: an accent that is not #rrggbb never reaches a style", async () => {
    answer(portalView({ tenant: { name: "Acme", address: null, phone: null, accent: "red;background:url(x)" } }));
    const html = await render();
    expect(html).not.toContain("url(x)");
    expect(html).toContain("#374151");
  });

  test("C912: a pale accent gets near-black button text", async () => {
    answer(portalView({ tenant: { name: "Acme", address: null, phone: null, accent: "#ffeb3b" } }));
    expect(await render()).toContain("background-color:#ffeb3b;color:#050505");
  });
});

const DECISIONS = ["Accept", "Refuse", "Request changes"] as const;
const controls = (html: string) => DECISIONS.filter((label) => new RegExp(`<button[^>]*>${label}</button>`).test(html));

const decidedView = (status: "accepted" | "refused" | "changes_requested", reason: string | null) =>
  portalView({ agreement: { number: "AG-1052", status }, decision: { status, decidedAt: new Date("2026-10-22T17:00:00Z"), reason } });
const revokedLink = { versionNo: 1, current: true, revoked: true, revokedAt: new Date("2026-10-22T10:00:00Z"), firstViewedAt: null };
const olderLink = { versionNo: 1, current: false, revoked: false, revokedAt: null, firstViewedAt: null };

describe("the states", () => {
  test("C914: replaced shows the message and the phone, no content, no download, no decision", async () => {
    answer(portalView({ link: revokedLink }));
    const html = await render();
    const page = text(html);
    expect(page).toContain("This link has been replaced. Ask Kettle Ridge Mechanical Ltd. for the new one.");
    expect(page).toContain("604-555-0100");
    expect(page).not.toContain("Preventive maintenance visit");
    expect(page).not.toContain("Download PDF");
    expect(controls(html)).toEqual([]);
    expect(html).not.toContain("data-view-recorder");
  });

  test("C914: without a phone the message stands alone", async () => {
    answer(portalView({ link: revokedLink, tenant: { name: "Acme", address: null, phone: null, accent: null } }));
    const page = text(await render());
    expect(page).toContain("This link has been replaced. Ask Acme for the new one.");
    expect(page).not.toContain("Phone");
  });

  test("C915: superseded shows the notice above the content, with the download and no decision", async () => {
    answer(portalView({ link: olderLink }));
    const html = await render();
    const page = text(html);
    const notice = "A newer version of this agreement was sent. Ask Kettle Ridge Mechanical Ltd. for its link.";
    expect(page).toContain(notice);
    expect(page.indexOf(notice)).toBeLessThan(page.indexOf("Preventive maintenance visit"));
    expect(page).toContain("Download PDF");
    expect(controls(html)).toEqual([]);
    expect(html).toContain("data-view-recorder");
  });

  test.each([
    ["withdrawn", "Kettle Ridge Mechanical Ltd. withdrawn this agreement."],
    ["expired", "This agreement has expired."],
  ] as const)("C916: %s shows its message and the phone, and nothing else", async (status, message) => {
    answer(portalView({ agreement: { number: "AG-1052", status } }));
    const html = await render();
    const page = text(html);
    expect(page).toContain(message);
    expect(page).toContain("604-555-0100");
    expect(page).not.toContain("Preventive maintenance visit");
    expect(page).not.toContain("Download PDF");
    expect(controls(html)).toEqual([]);
    expect(html).not.toContain("data-view-recorder");
  });

  test.each([
    ["accepted", null, "You accepted this agreement on Oct 22, 2026."],
    ["refused", "Too dear", "You refused this agreement on Oct 22, 2026."],
    ["changes_requested", "Add a visit", "You asked for changes on Oct 22, 2026."],
  ] as const)("C917: %s shows the date, the reason, the content and the download", async (status, reason, message) => {
    answer(decidedView(status, reason));
    const html = await render();
    const page = text(html);
    expect(page).toContain(message);
    if (reason) expect(page).toContain(`Your reason: ${reason}`);
    else expect(page).not.toContain("Your reason");
    expect(page).toContain("Preventive maintenance visit");
    expect(page).toContain("Download PDF");
    expect(controls(html)).toEqual([]);
    expect(html).toContain("data-view-recorder");
  });

  test("C918: open shows Accept, Refuse and Request changes as the shared Button and no other decision control", async () => {
    answer(portalView());
    const html = await render();
    expect(controls(html)).toEqual(["Accept", "Refuse", "Request changes"]);
    expect(html.match(/<button[^>]*data-variant/g)).toHaveLength(3);
    expect(html.match(/<button[^>]*class="[^"]*\bh-11\b[^"]*"/g)).toHaveLength(3);
    expect(html).not.toContain("<textarea");
    expect(text(html)).toContain("Download PDF");
  });
});

describe("the view recorder is mounted by state", () => {
  test.each([
    ["open", portalView(), true],
    ["decided", decidedView("accepted", null), true],
    ["superseded", portalView({ link: olderLink }), true],
    ["replaced", portalView({ link: revokedLink }), false],
    ["withdrawn", portalView({ agreement: { number: "AG-1052", status: "withdrawn" } }), false],
    ["expired", portalView({ agreement: { number: "AG-1052", status: "expired" } }), false],
  ])("C929: the %s page mounts it: %s", async (_state, view, mounts) => {
    answer(view);
    expect((await render()).includes("data-view-recorder")).toBe(mounts);
  });

  test("C929: an unknown link is not found, so nothing mounts", async () => {
    answer(null);
    await expect(render()).rejects.toThrow("404");
  });
});

describe("a page render writes nothing", () => {
  test("C925: the recorded database calls are exactly portal_view, whatever the state", async () => {
    for (const view of [portalView(), decidedView("accepted", null), portalView({ link: revokedLink })]) {
      answer(view);
      await render();
    }
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["portal_view", "portal_view", "portal_view"]);
    expect(rpc).toHaveBeenCalledWith("portal_view", { p_token_hash: testTokens.hash(TOKEN) });
  });
});

describe("a signed-in member sees what anyone sees", () => {
  test("C939: the page never asks who the visitor is", async () => {
    answer(portalView());
    await render();
    expect(currentMember).not.toHaveBeenCalled();
  });
});

describe("a failing read", () => {
  test("C932: a portal_view rejection is not caught by the page", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(render()).rejects.toThrow("XX000");
  });
});
