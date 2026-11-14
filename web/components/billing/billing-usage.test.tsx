import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { BillingOverview } from "@/domain/billing/overview";
import type { OrgUsage } from "@/domain/billing/plan-limits";
import { BillingView, type BillingPageState } from "./billing-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'");

const OVERVIEW: BillingOverview = { status: "active", trialEnd: null, periodEnd: 1795547955, endsAt: null, plan: "starter", extraSeats: 0, card: null, invoices: [] };
const usage = (live: number, imports: number): OrgUsage => ({ plan: "starter", liveAgreements: { used: live, limit: 15 }, aiImports: { used: imports, limit: 10 }, resetsOn: "2026-12-01" });
const READY: BillingPageState = { kind: "ready", plan: "Starter", overview: OVERVIEW };
const view = (props: { usage?: OrgUsage | null }) => html(createElement(BillingView, { state: READY, publishableKey: null, ...props }));

describe("usage on the billing page", () => {
  test("it says how many imports are left and how many tokens the AI used, when the tokens are known", () => {
    const out = view({ usage: { ...usage(7, 3), aiTokens: { input: 21000, output: 30200 } } });
    expect(out).toMatch(/AI imports this month[\s\S]*?3 of 10[\s\S]*?7 left/);
    expect(out).toMatch(/AI reading used this month[\s\S]*?51,200 tokens/);
  });

  test("a full allowance says Full and not '0 left', and with no token figure there is no token row", () => {
    const out = view({ usage: usage(7, 10) });
    expect(out).toContain("Full");
    expect(out).not.toContain("0 left");
    expect(out).not.toContain("AI reading used");
  });

  test("C5143: it shows both figures against the plan and the reset date", () => {
    const out = view({ usage: usage(7, 3) });
    expect(out).toMatch(/Live agreements[\s\S]*?7 of 15/);
    expect(out).toMatch(/AI imports this month[\s\S]*?3 of 10/);
    expect(out).toContain("resets on December 1");
  });

  test.each([
    [14, 9, 0],
    [15, 10, 2],
    [16, 12, 2],
  ])("C5144: at %i live agreements and %i imports the page says Full %i times", (live, imports, times) => {
    const out = view({ usage: usage(live, imports) });
    expect(out.split(">Full<").length - 1).toBe(times);
  });

  test("C5144: only the row that is at its limit says Full", () => {
    const out = view({ usage: usage(15, 3) });
    expect(out).toMatch(/Live agreements[\s\S]*?15 of 15[\s\S]*?Full/);
    expect(out.split(">Full<").length - 1).toBe(1);
  });

  test("C5145: with no usage the section says Usage unavailable and the rest of the page is still there", () => {
    const out = view({ usage: null });
    expect(out).toContain("Usage unavailable");
    expect(out).toContain("Payment method");
    expect(out).toContain("Invoices");
  });

  test("C5145: a page loaded without a usage reader shows no usage section at all", () => {
    const out = view({});
    expect(out).not.toContain("Usage unavailable");
    expect(out).not.toContain("Live agreements");
  });
});
