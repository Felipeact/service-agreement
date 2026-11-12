import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { planLimitMessage } from "@/domain/billing/plan-limits";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { NewAgreementPrompt } = await import("@/components/sites/new-agreement");
const { startNotice } = await import("./new-agreement-state");

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'");

const DETAIL = { plan: "starter", limit: 15, used: 15 };
const MESSAGE = "Your Starter plan allows 15 live agreements and you have 15.";

const stateFor = (audience: "manager" | "staff") => ({ status: "plan_limit" as const, ...planLimitMessage("agreements", DETAIL, audience) });

describe("a refused New agreement", () => {
  test("C5112: the site page's control shows the limit and, for a manager only, the billing link", () => {
    const manager = html(createElement(NewAgreementPrompt, { state: stateFor("manager"), pending: false }));
    expect(manager).toContain(MESSAGE);
    expect(manager).toMatch(/<a[^>]*href="\/settings\/billing"/);
    expect(manager).not.toContain("/agreements/");

    const staff = html(createElement(NewAgreementPrompt, { state: stateFor("staff"), pending: false }));
    expect(staff).toContain("Ask an owner or admin to change the plan.");
    expect(staff).not.toContain("/settings/billing");
  });

  test("C5112: the start dialog turns the same state into its notice, with the link for a manager only", () => {
    expect(startNotice(stateFor("manager"))).toEqual({ text: MESSAGE, href: "/settings/billing", linkText: "Change plan" });
    expect(startNotice(stateFor("staff"))).toEqual({ text: `${MESSAGE} Ask an owner or admin to change the plan.` });
  });
});
