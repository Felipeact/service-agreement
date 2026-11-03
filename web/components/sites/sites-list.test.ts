import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { CustomerSummary, SiteListRow } from "@/application/ports";
import type { SiteFilter } from "@/domain/records";
import { SitesListView } from "./sites-list";

const CUSTOMER = "00000000-0000-4000-8000-0000000000c1";

const row = (patch: Partial<SiteListRow> = {}): SiteListRow => ({
  id: "s1",
  name: "Harbourview Towers",
  address: "2150 Harbour Lane",
  customerId: "c1",
  customer: "Harbourview Strata",
  active: true,
  assetCount: 3,
  equipment: [{ code: "RTU", count: 3 }],
  liveAgreement: null,
  ...patch,
});

const customer = (id: string, name: string, active = true): CustomerSummary => ({
  id,
  name,
  primaryContact: null,
  active,
  siteCount: 1,
  assetCount: 0,
});

const customers = [customer(CUSTOMER, "Harbourview Strata"), customer("c2", "Bayside Bakery")];

const html = (rows: SiteListRow[], filter: SiteFilter = {}) => renderToStaticMarkup(createElement(SitesListView, { rows, customers, filter }));

describe("sites list view", () => {
  test("C1372: a row links the site, the customer and shows the asset count", () => {
    const out = html([row()]);
    expect(out).toMatch(/<a[^>]*href="\/sites\/s1"[^>]*>Harbourview Towers<\/a>/);
    expect(out).toMatch(/<a[^>]*href="\/customers\/c1"[^>]*>Harbourview Strata<\/a>/);
    expect(out).toContain("2150 Harbour Lane");
    expect(out).toContain("3 assets");
    expect(out).toContain("No live agreement");
  });

  test("C1372: asset counts of 1 and 0 are singular and zero", () => {
    expect(html([row({ assetCount: 1 })])).toContain("1 asset<");
    expect(html([row({ assetCount: 0, equipment: [] })])).toContain("0 assets");
  });

  test("C1372: a null address renders no placeholder text", () => {
    expect(html([row({ address: null })])).not.toContain("null");
  });

  test("C1372: a live agreement links its number and shows its status label", () => {
    const out = html([row({ liveAgreement: { id: "ag1", number: "AG-1001", status: "sent" } })]);
    expect(out).toMatch(/<a[^>]*href="\/agreements\/ag1"[^>]*>AG-1001<\/a>/);
    expect(out).toContain("Sent to customer");
    expect(out).not.toContain("No live agreement");
  });

  test("C1372: the header badge counts the sites", () => {
    expect(html([row()])).toContain("1 site<");
    expect(html([row(), row({ id: "s2" })])).toContain("2 sites<");
  });

  const types = (n: number) => Array.from({ length: n }, (_, i) => ({ code: `T${i + 1}`, count: n - i }));

  test("C1373: up to 3 types show as code and count, a fourth collapses to +1 more", () => {
    const four = html([row({ equipment: types(4) })]);
    expect(four).toContain("T1 ×4");
    expect(four).toContain("T2 ×3");
    expect(four).toContain("T3 ×2");
    expect(four).not.toContain("T4");
    expect(four).toContain("+1 more");
  });

  test("C1373: three types show no more, none shows No equipment", () => {
    const three = html([row({ equipment: types(3) })]);
    expect(three).toContain("T3 ×1");
    expect(three).not.toContain("more");
    expect(html([row({ assetCount: 0, equipment: [] })])).toContain("No equipment");
  });

  test("C1382: the filter bar is a labelled GET form to /sites", () => {
    const out = html([row()], { q: "tower", customerId: CUSTOMER });
    const form = /<form\b[^>]*>/.exec(out)?.[0] ?? "";
    expect(form).toContain('method="get"');
    expect(form).toContain('action="/sites"');
    expect(out).toMatch(/<label[^>]*for="q"[^>]*>[^<]*Search/);
    expect(out).toMatch(/<input[^>]*name="q"[^>]*value="tower"/);
    expect(out).toMatch(/<label[^>]*for="customer"[^>]*>Customer<\/label>/);
    expect(out).toContain("All customers");
    expect(out).toMatch(new RegExp(`<option value="${CUSTOMER}" selected="">Harbourview Strata</option>`));
    expect(out).toContain("Bayside Bakery");
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*>Apply filters<\/button>/);
  });

  test("C1383: the default link shows inactive and keeps q and customer", () => {
    expect(html([row()])).toMatch(/<a[^>]*href="\/sites\?show=inactive"[^>]*>Show inactive<\/a>/);
    const out = html([row()], { q: "tower", customerId: CUSTOMER });
    expect(out).toMatch(new RegExp(`<a[^>]*href="/sites\\?q=tower&amp;customer=${CUSTOMER}&amp;show=inactive"[^>]*>Show inactive<\\/a>`));
  });

  test("C1383: while showing inactive the link hides it, keeps q and customer, and an inactive row has the pill", () => {
    const filter: SiteFilter = { q: "tower", customerId: CUSTOMER, showInactive: true };
    const out = html([row(), row({ id: "s2", name: "Old Annex", active: false })], filter);
    expect(out).toMatch(new RegExp(`<a[^>]*href="/sites\\?q=tower&amp;customer=${CUSTOMER}"[^>]*>Hide inactive<\\/a>`));
    expect(out.match(/>Inactive</g)?.length).toBe(1);
    expect(out).toMatch(/Old Annex[\s\S]*>Inactive</);
    expect(html([row()])).not.toContain(">Inactive<");
  });

  test("C1383: with only show=inactive the hide link goes to /sites", () => {
    expect(html([row()], { showInactive: true })).toMatch(/<a[^>]*href="\/sites"[^>]*>Hide inactive<\/a>/);
  });

  test("C1384: no rows and no filter says No sites yet and links to Customers", () => {
    const out = html([]);
    expect(out).toContain("No sites yet");
    expect(out).toMatch(/<a[^>]*href="\/customers"/);
    expect(out).not.toContain("Clear filters");
    expect(out).not.toContain("No sites match");
  });

  test("C1384: no rows with a filter says No sites match and offers Clear filters to /sites", () => {
    const out = html([], { q: "zzz" });
    expect(out).toContain("No sites match");
    expect(out).toMatch(/<a[^>]*href="\/sites"[^>]*>Clear filters<\/a>/);
    expect(out).not.toContain("No sites yet");
  });
});
