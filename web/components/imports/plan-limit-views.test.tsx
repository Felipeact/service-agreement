import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { planLimitMessage } from "@/domain/billing/plan-limits";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/imports" }));

const { ExtractPrompt } = await import("./extract-control");

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'");

const NOTICE = planLimitMessage("imports", { plan: "starter", limit: 10, used: 10, resetsOn: "2026-12-01" }, "manager");

describe("a refused extraction", () => {
  test("C5129: the extract control shows the allowance message with the billing link and keeps the button", () => {
    const out = html(createElement(ExtractPrompt, { pending: false, progress: null, state: { status: "plan_limit", ...NOTICE } }));
    expect(out).toContain("Your Starter plan allows 10 AI imports a month and you have used 10. The count resets on December 1.");
    expect(out).toMatch(/<a[^>]*href="\/settings\/billing"/);
    expect(out).toContain("Extract equipment");
  });

  test("C5129: for staff the message says to ask an owner or admin and carries no link", () => {
    const staff = planLimitMessage("imports", { plan: "starter", limit: 10, used: 10, resetsOn: "2026-12-01" }, "staff");
    const out = html(createElement(ExtractPrompt, { pending: false, progress: null, state: { status: "plan_limit", ...staff } }));
    expect(out).toContain("Ask an owner or admin to change the plan.");
    expect(out).not.toContain("/settings/billing");
  });
});
