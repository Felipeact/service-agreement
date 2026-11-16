import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const redirect = vi.fn();
const ok = <T,>(value: T) => ({ ok: true as const, value });
const failed = { ok: false as const, code: "unavailable" as const };

const money = {
  headline: ok({ recurringCents: 119999, pipelineCents: 239998, accepted: 1, refused: 1, expired: 0, signed: 1, avgDaysToSign: 4 }),
  funnel: ok([
    { stage: "created", n: 4, valueCents: 479996 },
    { stage: "sent", n: 2, valueCents: 239998 },
    { stage: "accepted", n: 0, valueCents: 0 },
    { stage: "signed", n: 0, valueCents: 0 },
  ]),
  aging: ok({ medians: [{ stage: "Created to sent", days: 28.5 }], stuck: [{ agreementId: "a1", number: "AG-1", customer: "Acme", site: "Plant", status: "sent", ageDays: 9 }] }),
  losses: ok([{ agreementId: "a2", number: "AG-2", customer: "Acme", site: "Plant", outcome: "refused", reason: "Price", occurred: "2027-03-11", valueCents: 119999 }]),
  renewals: ok([{ agreementId: "a3", number: "AG-3", customer: "Acme", site: "Plant", termEnd: "2027-07-01", daysLeft: 16, bucket: 30, kind: "auto", valueCents: 119999 }]),
  customers: ok([{ customerId: "c1", customer: "Acme", agreements: 1, valueCents: 119999 }]),
  types: ok([{ type: "Aaa Type", valueCents: 10000 }]),
};
const noMoney = {
  funnel: ok(money.funnel.value.map((r) => ({ ...r, valueCents: null }))),
  aging: money.aging,
  losses: ok(money.losses.value.map((r) => ({ ...r, valueCents: null }))),
  renewals: ok(money.renewals.value.map((r) => ({ ...r, valueCents: null }))),
};

const reports = { headline: vi.fn(), funnel: vi.fn(), aging: vi.fn(), losses: vi.fn(), renewals: vi.fn(), revenueByCustomer: vi.fn(), revenueByType: vi.fn() };
const listAgreements = vi.fn(async () => [{ id: "a1" }]);

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, reports, listAgreements, clock: { now: () => new Date("2027-06-15T20:00:00Z") } }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _prefetch, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => createElement("a", { href, ...rest }, children) }));

const { ReportsForRequest } = await import("./page");

const as = (role: "owner" | "admin" | "estimator" | "viewer", extra: Partial<Extract<CurrentMember, { status: "member" }>> = {}) =>
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@example.com", orgId: "org-1", orgName: "Org", role, ...extra });
const render = async (params: Record<string, string> = {}) => renderToStaticMarkup(await ReportsForRequest({ params }));

beforeEach(() => {
  vi.clearAllMocks();
  as("owner");
  reports.headline.mockResolvedValue(money.headline);
  reports.funnel.mockResolvedValue(money.funnel);
  reports.aging.mockResolvedValue(money.aging);
  reports.losses.mockResolvedValue(money.losses);
  reports.renewals.mockResolvedValue(money.renewals);
  reports.revenueByCustomer.mockResolvedValue(money.customers);
  reports.revenueByType.mockResolvedValue(money.types);
  listAgreements.mockResolvedValue([{ id: "a1" }]);
});

describe("the reports page (reporting S1 to S4)", () => {
  test("C5742: a viewer goes to /pipeline and nothing is read", async () => {
    as("viewer");
    await expect(ReportsForRequest({ params: {} })).rejects.toThrow("NEXT_REDIRECT /pipeline");
    expect(reports.funnel).not.toHaveBeenCalled();
  });

  test("C5742: a signed-out visitor goes to /login", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(ReportsForRequest({ params: {} })).rejects.toThrow("NEXT_REDIRECT /login");
  });

  test("C5742: an owner sees every section, the headline figures and a CSV link for each table", async () => {
    const html = await render();
    for (const heading of ["Headline", "Funnel", "Speed and stuck deals", "Lost deals", "Renewals due", "Revenue by customer", "Revenue by type"]) expect(html).toContain(heading);
    expect(html).toContain("$1,199.99");
    expect(html).toContain("50%");
    expect(html).toContain("4.0 days");
    for (const key of ["funnel", "aging", "losses", "renewals", "revenue_customer", "revenue_type"]) expect(html).toContain(`/reports/export?report=${key}&amp;from=2026-06-16&amp;to=2027-06-15`);
    expect(reports.headline).toHaveBeenCalledWith({ from: "2026-06-16", to: "2027-06-15" });
  });

  test("C5742: an estimator sees the operational sections, reads no money report and the page holds no dollar sign", async () => {
    as("estimator");
    reports.funnel.mockResolvedValue(noMoney.funnel);
    reports.losses.mockResolvedValue(noMoney.losses);
    reports.renewals.mockResolvedValue(noMoney.renewals);
    const html = await render();
    expect(html).toContain("Funnel");
    expect(html).toContain("Lost deals");
    expect(html).not.toContain("$");
    expect(html).not.toContain("Revenue by");
    expect(html).not.toContain("Headline");
    expect(reports.headline).not.toHaveBeenCalled();
    expect(reports.revenueByCustomer).not.toHaveBeenCalled();
    expect(reports.revenueByType).not.toHaveBeenCalled();
  });

  test("C5742: an org with no agreements gets one empty state with a New agreement link and no section", async () => {
    listAgreements.mockResolvedValue([]);
    const html = await render();
    expect(html).toContain("Nothing to report yet");
    expect(html).toMatch(/<a [^>]*href="\/agreements"[^>]*>New agreement/);
    expect(html).not.toContain("Funnel");
    expect(html).not.toContain("Download CSV");
  });

  test("C5742: a section that fails shows its own error line and the others still render", async () => {
    reports.losses.mockResolvedValue(failed);
    const html = await render();
    expect(html).toContain("Lost deals could not be read right now");
    expect(html).toContain("Funnel");
    expect(html).toContain("$1,199.99");
    expect(html).toContain("Renewals due");
  });

  test("C5742: a failed headline does not hide the funnel", async () => {
    reports.headline.mockResolvedValue(failed);
    const html = await render();
    expect(html).toContain("The headline could not be read right now");
    expect(html).toContain("Created");
  });

  test("C5742: stage rows with no data say so instead of 0% dropped", async () => {
    const html = await render();
    expect(html).toContain("No agreements at this stage");
  });

  test("C5742: a bad range shows the notice and the default range", async () => {
    const html = await render({ from: "banana" });
    expect(html).toContain("That date range was not valid");
    expect(reports.funnel).toHaveBeenCalledWith({ from: "2026-06-16", to: "2027-06-15" });
  });

  test("C5742: a frozen workspace whose owner works as a viewer still reads the reports", async () => {
    as("viewer", { billingRole: "owner", frozen: true });
    const html = await render();
    expect(html).toContain("Headline");
  });

  test("C5742: the 90-day renewals are grouped under 0 to 30, 31 to 60 and 61 to 90 days", async () => {
    const html = await render();
    expect(html).toContain("0 to 30 days");
    expect(html).toContain("31 to 60 days");
    expect(html).toContain("61 to 90 days");
    expect(html).toContain("Auto-renews");
  });

  test("C5761: lost deals are grouped by outcome, each row with its link, reason and date, and empty groups are left out", async () => {
    reports.losses.mockResolvedValue(ok([
      { agreementId: "a2", number: "AG-2", customer: "Acme", site: "Plant", outcome: "refused", reason: "Price", occurred: "2027-03-11", valueCents: 119999 },
      { agreementId: "a4", number: "AG-4", customer: "Beta", site: "Yard", outcome: "withdrawn", reason: null, occurred: "2027-03-13", valueCents: 119999 },
    ]));
    const html = await render();
    expect(html).toContain("Refused · 1");
    expect(html).toContain("Withdrawn · 1");
    expect(html).not.toContain("Expired · ");
    expect(html.indexOf("Refused · 1")).toBeLessThan(html.indexOf("Withdrawn · 1"));
    expect(html).toMatch(/<a href="\/agreements\/a2"[^>]*>AG-2/);
    expect(html).toContain("Reason: Price");
    expect(html).toContain("2027-03-13");
  });

  test("C5762: the screen links the stuck and renewal agreements, orders the sections and lists revenue largest first", async () => {
    reports.revenueByCustomer.mockResolvedValue(ok([
      { customerId: "c1", customer: "Acme", agreements: 2, valueCents: 239998 },
      { customerId: "c2", customer: "Beta", agreements: 1, valueCents: 119999 },
    ]));
    const html = await render();
    expect(html).toMatch(/<a href="\/agreements\/a1"[^>]*>AG-1/);
    expect(html).toMatch(/<a href="\/agreements\/a3"[^>]*>AG-3/);
    const order = ["Headline", "Funnel", "Speed and stuck deals", "Lost deals", "Renewals due", "Revenue by customer", "Revenue by type"].map((h) => html.indexOf(`>${h}<`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(order.every((n) => n > 0)).toBe(true);
    expect(html.indexOf("Acme")).toBeLessThan(html.indexOf("Beta"));
    expect(html).toContain("$2,399.98 a year");
    expect(html).toMatch(/name="from"[^>]*value="2026-06-16"/);
    expect(html).toMatch(/name="to"[^>]*value="2027-06-15"/);
    expect(html).toContain("50% dropped off");
    expect(html).toContain('<h1 class="font-display leading-tight font-semibold tracking-tight text-[26px]">Reports</h1>');
  });

  test("C5765: the type revenue rows, the range controls, the pipeline stat and an expired group render", async () => {
    reports.losses.mockResolvedValue(ok([{ agreementId: "a5", number: "AG-5", customer: "Acme", site: "Plant", outcome: "expired", reason: null, occurred: "2027-03-12", valueCents: 119999 }]));
    const html = await render();
    expect(html).toContain("Aaa Type");
    expect(html).toContain("$100.00 a year");
    expect(html).toContain("Apply range");
    expect(html).toMatch(/<a href="\/reports"[^>]*>Last 12 months/);
    expect(html).toMatch(/Pipeline value<\/dt><dd[^>]*>\$2,399\.98</);
    expect(html).toMatch(/Recurring revenue<\/dt><dd[^>]*>\$1,199\.99</);
    expect(html).toContain("Expired · 1");
    expect(html).not.toContain("Reason:");
  });
});
