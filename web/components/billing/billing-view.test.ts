import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { BillingOverview } from "@/domain/billing/overview";
import { BillingView, CancelPrompt, CardFormShell, CardUpdateButton, type BillingPageState } from "./billing-view";

// The client islands read the router; a bare static render has none mounted.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'");
const noon = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day, 20) / 1000;

const overview = (over: Partial<BillingOverview> = {}): BillingOverview => ({
  status: "trialing",
  trialEnd: noon(2026, 11, 24),
  periodEnd: noon(2026, 11, 24),
  endsAt: null,
  plan: "team",
  extraSeats: 0,
  card: { brand: "visa", last4: "4242", expMonth: 4, expYear: 2030 },
  invoices: [{ id: "in_1", number: "INV-0007", created: noon(2026, 11, 10), total: 9900, currency: "cad", status: "paid", hostedUrl: "https://invoice.stripe.com/i/x" }],
  ...over,
});
const ready = (over: Partial<BillingOverview> = {}): BillingPageState => ({ kind: "ready", plan: "Team", overview: overview(over) });
const view = (state: BillingPageState, publishableKey: string | null = "pk_test_x") => html(createElement(BillingView, { state, publishableKey }));

describe("the billing page", () => {
  test("C3107: it shows plan, status, date line, card and the invoice row with a safe View link", () => {
    const out = view(ready());
    expect(out).toContain("Team");
    expect(out).toContain("Trial");
    expect(out).toContain("Trial ends Nov 24, 2026");
    expect(out).toContain("Visa ending 4242, expires 04/2030");
    expect(out).toContain("INV-0007");
    expect(out).toContain("$99.00");
    expect(out).toContain("Nov 10, 2026");
    expect(out).toMatch(/<a[^>]*href="https:\/\/invoice\.stripe\.com\/i\/x"[^>]*>/);
    const link = out.match(/<a[^>]*href="https:\/\/invoice\.stripe\.com\/i\/x"[^>]*>/)?.[0] ?? "";
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
  });

  test("C3107: a canceled subscription shows the page with no Update card, Cancel or Resume", () => {
    const out = view(ready({ status: "canceled", endsAt: noon(2026, 11, 24) }));
    expect(out).toContain("Canceled");
    expect(out).not.toContain("Update card");
    expect(out).not.toContain("Cancel subscription");
    expect(out).not.toContain("Resume");
  });

  test("C3108: no card, no invoices", () => {
    const out = view(ready({ card: null, invoices: [] }));
    expect(out).toContain("No payment method");
    expect(out).toContain("No invoices yet");
  });

  test("C3108: invoices that failed to load say so and the rest of the page still shows", () => {
    const out = view(ready({ invoices: "unavailable" }));
    expect(out).toContain("We couldn't load your invoices");
    expect(out).toContain("Visa ending 4242");
    expect(out).toContain("Trial ends Nov 24, 2026");
  });

  test("C3110: no subscription says so and offers no actions", () => {
    const out = view({ kind: "no_subscription" });
    expect(out).toContain("This workspace has no subscription");
    expect(out).not.toContain("Update card");
    expect(out).not.toContain("Cancel subscription");
  });

  test("C3110: not configured says Billing isn't available yet", () => {
    const out = view({ kind: "not_configured" });
    expect(out).toContain("Billing isn't available yet");
    expect(out).not.toContain("Update card");
  });

  test("C3110: an error says it could not load and offers a retry link back to the page", () => {
    const out = view({ kind: "error" });
    expect(out).toContain("We couldn't load billing. Try again.");
    expect(out).toMatch(/<a[^>]*href="\/settings\/billing"[^>]*>\s*Try again/);
  });

  test.each([ready(), { kind: "error" } as const, { kind: "no_subscription" } as const, { kind: "not_configured" } as const])(
    "C3128: every state offers a link back to /settings",
    (state) => {
      expect(view(state)).toMatch(/<a[^>]*href="\/settings"[^>]*>[^<]*Settings/);
    },
  );
});

describe("the card area", () => {
  test("C3118: with no publishable key it says card updates are not set up and offers no button", () => {
    const out = view(ready(), null);
    expect(out).toContain("Card updates aren't set up yet");
    expect(out).not.toContain("Update card");
  });

  test("C3118: with the key it offers Update card", () => {
    expect(view(ready(), "pk_test_x")).toContain("Update card");
  });

  test("C3119: while the Update card button is pending it is disabled with a pending label", () => {
    const pending = html(createElement(CardUpdateButton, { pending: true }));
    expect(pending).toMatch(/<button[^>]*disabled=""/);
    expect(pending).not.toContain("Update card");
    const idle = html(createElement(CardUpdateButton, { pending: false }));
    expect(idle).not.toMatch(/<button[^>]*disabled=""/);
    expect(idle).toContain("Update card");
  });

  test("C3119: the card form has exactly one submit control, disabled while saving", () => {
    const idle0 = html(createElement(CardFormShell, { pending: false, error: null, onCancel: () => {}, onSubmit: () => {} }, "field"));
    const saving = html(createElement(CardFormShell, { pending: true, error: null, onCancel: () => {}, onSubmit: () => {} }, "field"));
    expect(saving.match(/type="submit"/g)).toHaveLength(1);
    expect(saving).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(idle0).not.toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    const idle = html(createElement(CardFormShell, { pending: false, error: "Your card was declined.", onCancel: () => {}, onSubmit: () => {} }, "field"));
    expect(idle).toContain("Your card was declined.");
    expect(idle.match(/type="submit"/g)).toHaveLength(1);
  });
});

describe("cancel and resume", () => {
  test("C3122: before confirming there is only the start button, no form and no submit control", () => {
    const out = html(createElement(CancelPrompt, { confirming: false, pending: false, endDate: "Nov 24, 2026" }));
    expect(out).toContain("Cancel subscription");
    expect(out).not.toContain("<form");
    expect(out).not.toContain('type="submit"');
  });

  test("C3122: the confirming prompt names the end date, says access continues, and has one confirm and one dismiss", () => {
    const out = html(createElement(CancelPrompt, { confirming: true, pending: false, endDate: "Nov 24, 2026" }));
    expect(out).toContain("Nov 24, 2026");
    expect(out).toMatch(/keep access until then/i);
    expect(out.match(/type="submit"/g)).toHaveLength(1);
    expect(out).toContain("Keep subscription");
  });

  test("C3122: while the cancel is pending the confirm control is disabled", () => {
    const out = html(createElement(CancelPrompt, { confirming: true, pending: true, endDate: "Nov 24, 2026" }));
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });

  test("C3122: a subscription not set to end offers Cancel and no Resume", () => {
    const out = view(ready({ endsAt: null }));
    expect(out).toContain("Cancel subscription");
    expect(out).not.toContain("Resume");
  });

  test("C3122: a subscription set to end says when, offers Resume and no Cancel", () => {
    const out = view(ready({ status: "active", endsAt: noon(2026, 12, 10), trialEnd: null, periodEnd: noon(2026, 12, 10) }));
    expect(out).toContain("Ends Dec 10, 2026");
    expect(out).toContain("Resume");
    expect(out).not.toContain("Cancel subscription");
  });
});

describe("the plan list on the page", () => {
  test("C3202: it lists the three plans in price order, marks the current one with no switch control, and offers the other two", () => {
    const out = view(ready({ plan: "team" }));
    expect(out.indexOf("$79/month")).toBeLessThan(out.indexOf("$149/month"));
    expect(out.indexOf("$149/month")).toBeLessThan(out.indexOf("$299/month"));
    expect(out).toContain("2 seats included");
    expect(out).toContain("5 seats included");
    expect(out).toContain("10 seats included");
    expect(out.match(/Current plan/g)).toHaveLength(1);
    expect(out).toContain("Switch to Starter");
    expect(out).toContain("Switch to Business");
    expect(out).not.toContain("Switch to Team");
  });

  test("C3203: a subscription set to end lists the plans with no switch control and says to resume first", () => {
    const out = view(ready({ status: "active", endsAt: noon(2026, 12, 10), trialEnd: null, periodEnd: noon(2026, 12, 10) }));
    expect(out).toContain("Resume your subscription to change plan");
    expect(out).toContain("$149/month");
    expect(out).not.toContain("Switch to");
  });

  test("C3203: a canceled subscription has no plan list", () => {
    const out = view(ready({ status: "canceled" }));
    expect(out).not.toContain("$79/month");
    expect(out).not.toContain("Current plan");
    expect(out).not.toContain("Switch to");
  });

  test("C3203: an unknown plan lists the plans with no switch control and says it can't be changed here", () => {
    const out = view(ready({ plan: null }));
    expect(out).toContain("This plan can&#x27;t be changed here".replace("&#x27;", "'"));
    expect(out).toContain("$149/month");
    expect(out).not.toContain("Current plan");
    expect(out).not.toContain("Switch to");
  });

  test.each([{ kind: "no_subscription" } as const, { kind: "not_configured" } as const, { kind: "error" } as const])("C3202: the %j state shows no plan list", (state) => {
    expect(view(state)).not.toContain("$79/month");
  });
});
