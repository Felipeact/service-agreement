import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import type { CustomerSummary, SiteListRow } from "@/application/ports";
import type { SiteFilter } from "@/domain/records";
const { SitesListView } = await import("./sites-list");

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
    // the segmented control also names "No live agreement", so look at the rows only
    expect(out.slice(out.search(/<ul class="[^"]*divide-y/))).not.toContain("No live agreement");
  });

  test("C1372: the summary cards count the sites, their assets, the live agreements and the sites ready to quote", () => {
    const card = (out: string, label: string) => new RegExp(`${label}</span>[\\s\\S]*?text-\\[30px\\][^>]*>([^<]*)<`).exec(out)?.[1];
    const out = html([row(), row({ id: "s2", assetCount: 5, liveAgreement: { id: "ag1", number: "AG-1", status: "sent" } }), row({ id: "s3", assetCount: 0 })]);
    expect(card(out, "Sites")).toBe("3");
    expect(card(out, "Assets")).toBe("8");
    expect(card(out, "Live agreements")).toBe("1");
    expect(card(out, "Ready to quote")).toBe("1");
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

  test("C1382: the filter bar is a segmented control, a labelled customer picker following the filter, and a search that starts from q", () => {
    const out = html([row()], { q: "tower", customerId: CUSTOMER });
    const segments = [...out.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)<\/button>/g)].map((m) => [m[2], m[1]]);
    expect(segments).toEqual([["All", "true"], ["With a live agreement", "false"], ["No live agreement", "false"]]);
    expect(out).toMatch(/<label[^>]*for="customer"[^>]*>Customer<\/label>/);
    expect(out).toContain("All customers");
    expect(out).toMatch(new RegExp(`<option value="${CUSTOMER}" selected="">Harbourview Strata</option>`));
    expect(out).toContain("Bayside Bakery");
    expect(out).toMatch(/<input[^>]*type="search"[^>]*value="tower"/);
    expect(out).not.toContain("Apply filters");
  });

  test("C1383: the default link shows inactive and keeps q and customer", () => {
    expect(html([row()])).toMatch(/<a[^>]*href="\/sites\?show=inactive"[^>]*>Show inactive<\/a>/);
    const out = html([row()], { q: "tower", customerId: CUSTOMER });
    expect(out).toMatch(new RegExp(`<a[^>]*href="/sites\\?q=tower&amp;customer=${CUSTOMER}&amp;show=inactive"[^>]*>Show inactive<\\/a>`));
  });

  test("C1383: while showing inactive the link hides it, keeps q and customer, and an inactive row has the pill", () => {
    // the search starts from q and narrows the rows on the page, so it must match both rows to keep the inactive one in view
    const filter: SiteFilter = { q: "harbour", customerId: CUSTOMER, showInactive: true };
    const out = html([row(), row({ id: "s2", name: "Old Annex", active: false })], filter);
    expect(out).toMatch(new RegExp(`<a[^>]*href="/sites\\?q=harbour&amp;customer=${CUSTOMER}"[^>]*>Hide inactive<\\/a>`));
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

  test("C1372: a null address leaves out the address line, so only the asset count is secondary text", () => {
    const secondary = (out: string) => out.match(/text-\[12px\] text-ink-2/g)?.length ?? 0;
    const rowOnly = (out: string) => out.slice(out.search(/<ul class="[^"]*divide-y/));
    expect(secondary(rowOnly(html([row()])))).toBe(2);
    expect(secondary(rowOnly(html([row({ address: null })])))).toBe(1);
  });

  test("C1372: the status label is the text of its own pill", () => {
    const out = html([row({ liveAgreement: { id: "ag1", number: "AG-1001", status: "draft" } })]);
    expect(out).toMatch(/<span[^>]*title="In progress"[^>]*>(<span[^>]*><\/span>)?In progress<\/span>/);
  });

  test("C1384: Clear filters keeps show=inactive while inactive sites are shown", () => {
    expect(html([], { q: "zzz", showInactive: true })).toMatch(/<a[^>]*href="\/sites\?show=inactive"[^>]*>Clear filters<\/a>/);
  });
});
