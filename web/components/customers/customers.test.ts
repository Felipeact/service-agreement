import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { CustomerDetail, CustomerSummary } from "@/application/ports";
import { CustomerDetailView } from "./customer-detail-view";
import { filterCustomers } from "./filter";
import { CustomersView } from "./customers-view";

const summary = (id: string, name: string, patch: Partial<CustomerSummary> = {}): CustomerSummary => ({
  id,
  name,
  primaryContact: "Dana Whitfield",
  siteCount: 1,
  assetCount: 5,
  ...patch,
});

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
const list = (customers: CustomerSummary[], initialQuery?: string) => html(createElement(CustomersView, { customers, initialQuery }));

describe("CustomersView", () => {
  test("C121: each name links to its customer page", () => {
    const out = list([summary("11111111-1111-4111-8111-111111111111", "Alpha"), summary("22222222-2222-4222-8222-222222222222", "bravo")]);
    expect(out).toContain('href="/customers/11111111-1111-4111-8111-111111111111"');
    expect(out.indexOf("Alpha")).toBeLessThan(out.indexOf("bravo"));
  });

  test("C122: a row shows the site and asset counts", () => {
    const out = list([summary("1", "Alpha", { siteCount: 2, assetCount: 7 })]);
    expect(out).toMatch(/Sites <\/span>2</);
    expect(out).toMatch(/Assets <\/span>7</);
  });

  test("C124: no contact shows a dash", () => {
    expect(list([summary("1", "Alpha", { primaryContact: null })])).toMatch(/<span[^>]*>-<\/span>/);
  });

  test.each([
    [12, "12 customers"],
    [1, "1 customer"],
  ])("C125: %s customers badge reads %s", (count, label) => {
    const customers = Array.from({ length: count }, (_, index) => summary(String(index), `Customer ${index}`));
    expect(list(customers)).toContain(`>${label}<`);
  });

  test("C127: a search with no match shows the message and Clear search", () => {
    const out = list([summary("1", "Alpha")], "zzz");
    expect(out).toContain('No customers match "zzz"');
    expect(out).toMatch(/<button[^>]*>Clear search</);
  });

  test("C128: with no customers it shows the empty panel and no button", () => {
    const out = list([]);
    expect(out).toContain("No customers yet");
    expect(out).toContain("Customers appear here once they are added or imported.");
    expect(out).not.toContain("<button");
  });
});

describe("filterCustomers", () => {
  const customers = [
    summary("1", "Harbourview Towers Strata", { primaryContact: "Dana Whitfield" }),
    summary("2", "Pinecrest Office Park", { primaryContact: "Marcus Ilunga" }),
  ];
  const names = (query: string) => filterCustomers(customers, query).map((customer) => customer.name);

  test("C126: matches name or primary contact, ignoring case and outer spaces", () => {
    expect(names("harbour")).toEqual(["Harbourview Towers Strata"]);
    expect(names("  DANA ")).toEqual(["Harbourview Towers Strata"]);
    expect(names("HARBOURVIEW TOWERS STRATA")).toEqual(["Harbourview Towers Strata"]);
    expect(names("marcus")).toEqual(["Pinecrest Office Park"]);
    expect(names("")).toHaveLength(2);
    expect(names("   ")).toHaveLength(2);
    expect(names("zzz")).toEqual([]);
  });
});

const detail = (patch: Partial<CustomerDetail> = {}): CustomerDetail => ({
  id: "c1",
  name: "Harbourview Towers Strata",
  contacts: [],
  sites: [],
  agreements: [],
  ...patch,
});
const detailHtml = (customer: CustomerDetail) => html(createElement(CustomerDetailView, { customer }));

describe("CustomerDetailView", () => {
  test("C129: title, back link and the three sections", () => {
    const out = detailHtml(detail());
    expect(out).toContain("Harbourview Towers Strata");
    expect(out).toMatch(/<a[^>]*href="\/customers"[^>]*>Customers</);
    for (const heading of ["Contacts", "Sites", "Agreements"]) expect(out).toMatch(new RegExp(`<h2[^>]*>${heading}</h2>`));
  });

  test("C130: email and phone are mailto and tel links; missing values are dashes", () => {
    const out = detailHtml(
      detail({
        contacts: [
          { id: "1", name: "Dana", email: "dana.whitfield@example.com", phone: "604-555-0101" },
          { id: "2", name: "Bare", email: null, phone: null },
        ],
      }),
    );
    expect(out).toContain('href="mailto:dana.whitfield@example.com"');
    expect(out).toContain('href="tel:604-555-0101"');
    expect(out.match(/<span[^>]*>-<\/span>/g)).toHaveLength(2);
  });

  test("C131: a site row links to the site and shows address, contact and asset count", () => {
    const out = detailHtml(
      detail({
        sites: [{ id: "s1", name: "Harbourview Towers", address: "2150 Harbour Lane, North Vancouver, BC", contactName: "Dana Whitfield", assetCount: 5 }],
      }),
    );
    expect(out).toMatch(/<a[^>]*href="\/sites\/s1"[^>]*>Harbourview Towers</);
    expect(out).toContain("2150 Harbour Lane, North Vancouver, BC");
    expect(out).toContain("Dana Whitfield");
    expect(out).toContain("5 assets");
  });

  test("C132: an agreement row shows site, number, stage and annual amount", () => {
    const out = detailHtml(
      detail({
        agreements: [{ id: "a1", siteName: "Harbourview Towers", number: "AG-1048", versionNo: 1, stage: "sent", annualCents: 1600000 }],
      }),
    );
    expect(out).toContain("Harbourview Towers");
    expect(out).toContain("AG-1048 · v1");
    expect(out).toContain("Sent to customer");
    expect(out).toContain("$16,000/yr");
  });

  test("C133: empty sections say so", () => {
    const out = detailHtml(detail());
    for (const text of ["No contacts yet", "No sites yet", "No agreements yet"]) expect(out).toContain(text);
  });
});
