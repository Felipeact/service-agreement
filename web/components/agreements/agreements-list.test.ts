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
  { id: SITE, name: "Tower A", customer: "Harbourview", liveAgreement: null },
  { id: "s2", name: "Tower B", customer: "Harbourview", liveAgreement: { id: "ag-9", number: "AG-1009" } },
  { id: "s3", name: "Plant 1", customer: "Northside", liveAgreement: null },
];

const list = (rows: AgreementListRow[], filter: AgreementFilter = {}, role: MemberRole = "estimator") =>
  renderToStaticMarkup(createElement(AgreementsListView, { rows, sites, filter, role })).replace(/&#x27;/g, "'");

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

  test("C1355: the filters are labelled and show the current values", () => {
    const html = list([row()], { status: "sent", siteId: SITE, expiring: true });
    expect(html).toMatch(/<label[^>]*for="status"[^>]*>Status</);
    expect(html).toMatch(/<label[^>]*for="site"[^>]*>Site</);
    expect(html).toMatch(/<option value="sent" selected/);
    expect(html).toMatch(new RegExp(`<option value="${SITE}" selected`));
    expect(html).toMatch(/<input(?=[^>]*name="expiring")(?=[^>]*value="1")(?=[^>]*checked)[^>]*>/);
    expect(html).toContain("Expiring soon");
  });

  test("C1355: with no filter nothing is selected or checked", () => {
    const html = list([row()]);
    expect([...html.matchAll(/<option value="([^"]*)" selected/g)].map((m) => m[1])).toEqual(["", ""]);
    expect(html).not.toMatch(/<input(?=[^>]*name="expiring")(?=[^>]*checked)[^>]*>/);
  });

  test("C1360: a viewer sees no New agreement, a writer does", () => {
    expect(list([row()], {}, "viewer")).not.toContain("New agreement");
    for (const role of ["owner", "admin", "estimator"] as const) {
      expect(list([row()], {}, role)).toMatch(/<a[^>]*href="\/agreements\/new"[^>]*>New agreement</);
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
