import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementListRow, MemberRole, SiteOption } from "@/application/ports";
import type { AgreementFilter } from "@/domain/agreement";
import { AgreementsListView } from "./agreements-list";
import { NewAgreementFormView, submitSite } from "./new-agreement-form";
import type { CreateAgreementState } from "./state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));

const SITE = "00000000-0000-4000-8000-0000000000aa";
const row = (patch: Partial<AgreementListRow> = {}): AgreementListRow => ({
  id: "a1",
  number: "AG-1048",
  status: "sent",
  site: "Harbourview Tower A",
  customer: "Harbourview Towers Strata",
  versionNo: 3,
  annualCents: 400000,
  updatedAt: "2026-10-20T00:00:00Z",
  termEnd: null,
  ...patch,
});
const sites: SiteOption[] = [
  { id: SITE, name: "Tower A", customerId: "c1", customer: "Harbourview", liveAgreement: null },
  { id: "s2", name: "Tower B", customerId: "c1", customer: "Harbourview", liveAgreement: { id: "ag-9", number: "AG-1009" } },
  { id: "s3", name: "Plant 1", customerId: "c2", customer: "Northside", liveAgreement: null },
];

const list = (rows: AgreementListRow[], filter: AgreementFilter = {}, role: MemberRole = "estimator") =>
  renderToStaticMarkup(createElement(AgreementsListView, { rows, filter, role })).replace(/&#x27;/g, "'");

describe("agreements list", () => {
  test("C1353: a row links to its agreement and shows number, site, customer, status, version and total", () => {
    const html = list([row()]);
    expect(html).toMatch(/<a[^>]*href="\/agreements\/a1"/);
    for (const text of ["AG-1048", "Harbourview Tower A", "Harbourview Towers Strata", "Sent to customer", "v3", "$4,000/yr"]) {
      expect(html).toContain(text);
    }
  });

  test("C1353: a term end renders as its date; without one no placeholder renders", () => {
    expect(list([row({ termEnd: "2027-06-30" })])).toContain("2027-06-30");
    const html = list([row({ termEnd: null })]);
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(html).not.toContain("Term ends");
  });

  test("C1353: a withdrawn agreement is listed with its own label", () => {
    const html = list([row({ status: "withdrawn" })]);
    expect(html).toMatch(/data-tone="neutral"[^>]*>Withdrawn</);
    expect(html).not.toContain("data-stage-dot");
  });

  test("C1354: with no agreements and no filter it says No agreements yet", () => {
    const html = list([]);
    expect(html).toContain("No agreements yet");
    expect(html).not.toContain("No agreements match");
  });

  test("C1354: a filter that matches nothing offers Clear filters back to /agreements", () => {
    const html = list([], { status: "sent" });
    expect(html).toContain("No agreements match");
    expect(html).toMatch(/<a[^>]*href="\/agreements"[^>]*>Clear filters</);
    expect(html).not.toContain("No agreements yet");
  });

  test("C1355: the status is a row of links, the current one marked, and the site and expiring filters keep their place", () => {
    const html = list([row()], { status: "sent", siteId: SITE, expiring: true });
    const links = [...html.matchAll(/<a[^>]*href="(\/agreements[^"]*)"[^>]*>([^<]*(?:<svg[\s\S]*?<\/svg>)?[^<]*)<\/a>/g)];
    const current = links.filter((m) => /aria-current="true"/.test(m[0])).map((m) => m[2].replace(/<svg[\s\S]*?<\/svg>/, ""));
    expect(current.sort()).toEqual(["Expiring soon", "Sent"]);
    // choosing another status keeps the site and the expiring filter
    expect(html).toContain(`href="/agreements?status=accepted&amp;site=${SITE}&amp;expiring=1"`);
    // the filter that is on can be switched off
    expect(html).toContain(`href="/agreements?status=sent&amp;site=${SITE}"`);
    expect(html).toContain("Show every site");
  });

  test("C1355: with no filter only All is current and no site notice shows", () => {
    const html = list([row()]);
    const current = [...html.matchAll(/<a[^>]*aria-current="true"[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
    expect(current).toEqual(["All"]);
    expect(html).not.toContain("Show every site");
  });

  test("the four cards count the rows: all, with the customer, needing follow-up and the open value", () => {
    const now = new Date("2026-10-31T00:00:00Z");
    const rows = [
      row({ id: "a", status: "sent", annualCents: 100000, updatedAt: "2026-10-01T00:00:00Z" }),
      row({ id: "b", status: "sent", annualCents: 200000, updatedAt: "2026-10-30T00:00:00Z" }),
      row({ id: "c", status: "changes_requested", annualCents: 50000, updatedAt: "2026-10-30T00:00:00Z" }),
      row({ id: "d", status: "accepted", annualCents: 400000, updatedAt: "2026-10-30T00:00:00Z" }),
    ];
    const html = renderToStaticMarkup(createElement(AgreementsListView, { rows, filter: {}, role: "estimator", now }));
    const card = (label: string) => new RegExp(`${label}</span>[\\s\\S]*?text-\\[30px\\][^>]*>([^<]*)<`).exec(html)?.[1];
    expect(card("Agreements")).toBe("4");
    expect(card("With customer")).toBe("2");
    expect(card("Need follow-up")).toBe("2"); // the sent one that sat 30 days, and the changes request
    expect(card("Open value")).toBe("$7,500"); // every open stage: 1,000 + 2,000 + 500 + 4,000
    expect(html).toContain("$4,000/yr accepted");
  });

  test("a row's age turns red once the agreement has sat past its stage's limit", () => {
    const now = new Date("2026-10-31T00:00:00Z");
    const stale = renderToStaticMarkup(createElement(AgreementsListView, { rows: [row({ status: "sent", updatedAt: "2026-10-01T00:00:00Z" })], filter: {}, role: "estimator", now }));
    const fresh = renderToStaticMarkup(createElement(AgreementsListView, { rows: [row({ status: "sent", updatedAt: "2026-10-30T00:00:00Z" })], filter: {}, role: "estimator", now }));
    expect(stale).toMatch(/font-semibold text-danger[^>]*>(?:<svg[\s\S]*?<\/svg>)30 days</);
    expect(fresh).not.toMatch(/text-danger/);
    expect(fresh).toContain("1 day<");
  });

  test("C1360: a viewer sees no New agreement, a writer does", () => {
    expect(list([row()], {}, "viewer")).not.toContain("New agreement");
    for (const role of ["owner", "admin", "estimator"] as const) {
      expect(list([row()], {}, role)).toMatch(/<a[^>]*href="\/agreements\/new"[^>]*>(?:<svg[\s\S]*?<\/svg>)?New agreement</);
    }
  });
});

const form = (siteOptions: SiteOption[], state: CreateAgreementState = { status: "idle" }) =>
  renderToStaticMarkup(createElement(NewAgreementFormView, { sites: siteOptions, state, pending: false }));

describe("new agreement form", () => {
  test("C1362: only sites without a live agreement are options, grouped by customer; busy sites are links", () => {
    const html = form(sites);
    expect(html).toMatch(/<label[^>]*for="siteId"[^>]*>Site</);
    expect(html).toMatch(/<optgroup label="Harbourview">\s*<option value="[^"]*">Tower A</);
    expect(html).toMatch(/<optgroup label="Northside">\s*<option value="s3">Plant 1</);
    expect(html).not.toMatch(/<option[^>]*value="s2"/);
    expect(html).toMatch(/<a[^>]*href="\/agreements\/ag-9"[^>]*>AG-1009</);
    expect(html).toContain("Tower B");
  });

  test("C1363: submitting calls the create action once with the chosen site", async () => {
    const create = vi.fn(async (): Promise<CreateAgreementState> => ({ status: "idle" }));
    const data = new FormData();
    data.set("siteId", SITE);
    await submitSite(create, data);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(SITE);
  });

  test("C1364: open_exists names the live agreement; a failure shows its message", () => {
    const open = form(sites, { status: "open_exists", agreementId: "ag-7", number: "AG-1007" });
    expect(open).toMatch(/<a[^>]*href="\/agreements\/ag-7"[^>]*>Open AG-1007</);
    expect(form(sites, { status: "forbidden" })).toContain("You don&#x27;t have permission to change agreements.");
    expect(form(sites, { status: "not_found" })).toContain("This agreement no longer exists.");
    expect(form(sites, { status: "unavailable" })).toContain("We couldn&#x27;t save this. Try again.");
    expect(form(sites)).not.toContain('role="alert"');
  });

  test("C1365: with no eligible site it shows an empty panel linking to Customers and no select", () => {
    for (const none of [[], [sites[1]]]) {
      const html = form(none);
      expect(html).not.toContain("<select");
      expect(html).toMatch(/<a[^>]*href="\/customers"/);
    }
  });
});
