import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { CustomerDetail, CustomerSummary, MemberRole } from "@/application/ports";
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

const populated = detail({
  contacts: [{ id: "ct1", name: "Dana", email: "dana@example.com", phone: null }],
  sites: [{ id: "s1", name: "Tower A", address: "1 Main St", contactName: "Dana", assetCount: 3 }],
  agreements: [{ id: "ag1", siteName: "Tower A", number: "AG-1", versionNo: 1, stage: "sent", annualCents: 120000 }],
});
const listAs = (role: MemberRole, customers: CustomerSummary[]) => html(createElement(CustomersView, { customers, role }));
const detailAs = (role: MemberRole, customer: CustomerDetail = populated) => html(createElement(CustomerDetailView, { customer, role }));

describe("record write controls on the customer screens", () => {
  test("C301: a writer sees New customer in the header and in the empty state", () => {
    expect(listAs("estimator", [summary("1", "Alpha")])).toMatch(/<a[^>]*href="\/customers\/new"[^>]*>New customer<\/a>/);
    const empty = listAs("estimator", []);
    expect(empty.match(/<a[^>]*href="\/customers\/new"[^>]*>New customer<\/a>/g)).toHaveLength(2);
    expect(empty).toMatch(/No customers yet[\s\S]*<a[^>]*href="\/customers\/new"/);
  });

  test("C306: a writer sees Edit linking to the customer's edit page", () => {
    expect(detailAs("estimator")).toMatch(/<a[^>]*href="\/customers\/c1\/edit"[^>]*>Edit<\/a>/);
  });

  test("C308: a writer sees Add contact, and Edit on each contact row", () => {
    const out = detailAs("estimator");
    expect(out).toMatch(/<a[^>]*href="\/customers\/c1\/contacts\/new"[^>]*>Add contact<\/a>/);
    expect(out).toMatch(/<a[^>]*href="\/contacts\/ct1\/edit"[^>]*>Edit<\/a>/);
  });

  test("C316: a writer sees Add site on the customer page", () => {
    expect(detailAs("estimator")).toMatch(/<a[^>]*href="\/customers\/c1\/sites\/new"[^>]*>Add site<\/a>/);
  });

  test.each([
    ["list with customers", () => listAs("viewer", [summary("1", "Alpha")])],
    ["empty list", () => listAs("viewer", [])],
    ["customer with records", () => detailAs("viewer")],
    ["empty customer", () => detailAs("viewer", detail())],
  ])("C329: a viewer's %s has no write controls", (_name, render) => {
    const out = render();
    expect(out).not.toMatch(/href="[^"]*\/(new|edit)"/);
    for (const text of ["New customer", "Add contact", "Add site", "Add asset", ">Edit<", "Delete"]) expect(out).not.toContain(text);
  });

  test("C348: a writer still sees every contact, site and agreement row", () => {
    const out = detailAs("estimator");
    expect(out).toContain("dana@example.com");
    expect(out).toMatch(/<a[^>]*href="\/sites\/s1"[^>]*>Tower A</);
    expect(out).toContain("1 Main St");
    expect(out).toContain("AG-1 · v1");
    expect(out).toContain("$1,200/yr");
  });
});
