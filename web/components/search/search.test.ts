import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { SearchGroup, SearchResults, SearchSite } from "@/application/ports";
import { SearchView } from "./search-view";

const none = { hits: [], more: false };
const group = <T>(hits: T[], more = false): SearchGroup<T> => ({ hits, more });

const customer = { id: "c1", name: "Harbourview Strata" };
const site = (patch: Partial<SearchSite> = {}): SearchSite => ({ id: "s1", name: "North Tower", customerName: "Harbourview Strata", address: "12 Main St", ...patch });
const unit = { id: "a1", siteId: "s9", unitNo: "RTU-3", typeName: "Rooftop unit", siteName: "South Annex", customerName: "Pacific Mall" };

const results = (patch: Partial<SearchResults> = {}): SearchResults => ({ customers: none, sites: none, equipment: none, ...patch });
const render = (query: string, r: SearchResults | null) => renderToStaticMarkup(createElement(SearchView, { query, results: r }));

const anchor = (html: string, href: string) => html.match(new RegExp(`<a [^>]*href="${href}"[^>]*>(.*?)</a>`))?.[1] ?? "";
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const headings = (html: string) => [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => text(m[1]).trim());

describe("search results", () => {
  test("C1581: groups come in the order Customers, Sites, Equipment, each with its count, and an empty group is left out", () => {
    const full = render("x", results({ customers: group([customer, { id: "c2", name: "Two" }]), sites: group([site()]), equipment: group([unit]) }));
    expect(headings(full)).toEqual(["Customers 2", "Sites 1", "Equipment 1"]);

    const partial = render("x", results({ sites: group([site()]) }));
    expect(headings(partial)).toEqual(["Sites 1"]);
  });

  test("C1582: a customer row links to /customers/<id> and shows the name", () => {
    const html = render("harb", results({ customers: group([customer]) }));
    expect(text(anchor(html, "/customers/c1")).trim()).toBe("Harbourview Strata");
  });

  test("C1583: a site row links to /sites/<id> and shows the site, its customer and its address; no address leaves no address text", () => {
    const withAddress = render("tower", results({ sites: group([site()]) }));
    expect(text(anchor(withAddress, "/sites/s1")).trim()).toBe("North Tower Harbourview Strata 12 Main St");

    const without = render("tower", results({ sites: group([site({ address: null })]) }));
    expect(text(anchor(without, "/sites/s1")).trim()).toBe("North Tower Harbourview Strata");
  });

  test("C1584: an equipment row links to its site's page and shows the unit, the type, the site and the customer", () => {
    const html = render("rtu", results({ equipment: group([unit]) }));
    expect(text(anchor(html, "/sites/s9")).trim()).toBe("RTU-3 Rooftop unit South Annex Pacific Mall");
  });

  test("C1585: the Refine note shows under a group whose more is true and under no other", () => {
    const html = render("x", results({ customers: group([customer], true), sites: group([site()], false), equipment: group([unit], false) }));
    expect(html.match(/Showing the first 25\. Refine your search\./g)).toHaveLength(1);
    const sections = html.split("<section").slice(1);
    expect(sections[0]).toContain("Refine your search");
    expect(sections[1]).not.toContain("Refine your search");
    expect(sections[2]).not.toContain("Refine your search");
  });

  test("C1586: three empty groups show the no-match message with the text, and the deactivated-records line", () => {
    const html = render("zzzz", results());
    expect(text(html)).toContain("No customers, sites or equipment match “zzzz”.");
    expect(text(html)).toContain("Deactivated records are not searched.");
    expect(html).not.toContain("<h2");
  });

  test("C1587: typed markup is escaped in the field, the empty message and a row title, and no element is created from it", () => {
    const evil = "<img src=x onerror=alert(1)>";
    const empty = render(evil, results());
    expect(empty).not.toContain("<img");
    expect(empty).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(empty).toMatch(/value="&lt;img src=x onerror=alert\(1\)&gt;"/);

    const row = render("x", results({ customers: group([{ id: "c1", name: evil }]) }));
    expect(row).not.toContain("<img");
    expect(row).toContain("&lt;img src=x onerror=alert(1)&gt;");

    const siteRow = render("x", results({ sites: group([site({ name: evil, customerName: evil, address: evil })]) }));
    expect(siteRow).not.toContain("<img");
    expect(siteRow.match(/&lt;img src=x onerror=alert\(1\)&gt;/g)).toHaveLength(3);

    const unitRow = render("x", results({ equipment: group([{ ...unit, unitNo: evil, typeName: evil, siteName: evil, customerName: evil }]) }));
    expect(unitRow).not.toContain("<img");
    expect(unitRow.match(/&lt;img src=x onerror=alert\(1\)&gt;/g)).toHaveLength(4);
  });

  test("C1588: the form is a GET to /search with a search input named q, prefilled with the text, labelled Search, and a Search button", () => {
    const html = render("tower", results({ sites: group([site()]) }));
    const form = html.match(/<form[^>]*>/)?.[0] ?? "";
    expect(form).toContain('method="get"');
    expect(form).toContain('action="/search"');
    const input = html.match(/<input[^>]*>/)?.[0] ?? "";
    expect(input).toContain('type="search"');
    expect(input).toContain('name="q"');
    expect(input).toContain('value="tower"');
    expect(input).toContain('aria-label="Search"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Search<\/button>/);
  });

  test("C1591: the page field and button are 44 px tall below 1024 px and 34 px from there up", () => {
    const html = render("", null);
    const input = html.match(/<input[^>]*>/)?.[0] ?? "";
    const button = html.match(/<button[^>]*>/)?.[0] ?? "";
    for (const element of [input, button]) {
      expect(element, element).toMatch(/class="(?:[^"]*\s)?h-11(?:\s[^"]*)?"/);
      expect(element, element).toMatch(/class="(?:[^"]*\s)?lg:h-\[34px\](?:\s[^"]*)?"/);
    }
  });
});
