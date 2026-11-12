import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
let pathname = "/pipeline";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { itemWords } = await import("@/domain/org-settings");
const { SidebarNav } = await import("./sidebar-nav");
const { FOOTER_NAV, MAIN_NAV } = await import("./nav-items");

const hrefOf = (label: string) => [...MAIN_NAV, ...FOOTER_NAV].find((item) => item.label === label)?.href;

describe("navigation", () => {
  test.each([
    ["Pipeline", "/pipeline"],
    ["Agreements", "/agreements"],
    ["Customers", "/customers"],
    ["Sites & equipment", "/sites"],
    ["Settings", "/settings"],
  ])("C156: %s links to %s", (label, href) => {
    expect(hrefOf(label)).toBe(href);
  });

  test("C5348: Templates links to /templates directly after Agreements, with every other link in its place", () => {
    expect(hrefOf("Templates")).toBe("/templates");
    expect(MAIN_NAV.map((item) => item.label)).toEqual(["Pipeline", "Agreements", "Templates", "Customers", "Sites & equipment", "Imports"]);
  });

  test.each([
    ["/templates", true],
    ["/templates/new", true],
    ["/templates/t-1", true],
    ["/agreements", false],
    ["/pipeline", false],
  ])("C5348: on %s the Templates item is current: %s", (path, current) => {
    pathname = path;
    const html = renderToStaticMarkup(createElement(SidebarNav, {}));
    const link = /<a\b[^>]*href="\/templates"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Templates<\/a>/.exec(html)?.[0] ?? "";
    expect(link).not.toBe("");
    expect(link.includes('aria-current="page"')).toBe(current);
  });

  test("C1393: Imports links to /imports", () => {
    expect(hrefOf("Imports")).toBe("/imports");
  });

  test("the Task library is gone from the navigation", () => {
    expect([...MAIN_NAV, ...FOOTER_NAV].map((item) => item.label)).not.toContain("Task library");
  });

  test.each([
    ["/agreements", true],
    ["/agreements/ag-1", true],
    ["/pipeline", false],
  ])("C1358: on %s the Agreements item is current: %s", (path, current) => {
    pathname = path;
    const html = renderToStaticMarkup(createElement(SidebarNav, {}));
    const link = /<a\b[^>]*href="\/agreements"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Agreements<\/a>/.exec(html)?.[0] ?? "";
    expect(link).not.toBe("");
    expect(link.includes('aria-current="page"')).toBe(current);
  });

  test.each([
    ["/sites", true],
    ["/sites/s-1", true],
    ["/pipeline", false],
    ["/customers", false],
  ])("C1376: on %s the Sites & equipment item is current: %s", (path, current) => {
    pathname = path;
    const html = renderToStaticMarkup(createElement(SidebarNav, {}));
    const link = /<a\b[^>]*href="\/sites"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Sites &amp; equipment<\/a>/.exec(html)?.[0] ?? "";
    expect(link).not.toBe("");
    expect(link.includes('aria-current="page"')).toBe(current);
  });

  test.each([
    ["/imports", true],
    ["/imports/j-1", true],
    ["/pipeline", false],
    ["/sites", false],
  ])("C1394: on %s the Imports item is current: %s", (path, current) => {
    pathname = path;
    const html = renderToStaticMarkup(createElement(SidebarNav, {}));
    const link = /<a\b[^>]*href="\/imports"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Imports<\/a>/.exec(html)?.[0] ?? "";
    expect(link).not.toBe("");
    expect(link.includes('aria-current="page"')).toBe(current);
  });

  test("C1504: Members links to /members and comes after Settings in the footer navigation", () => {
    expect(hrefOf("Members")).toBe("/members");
    expect(FOOTER_NAV.map((item) => item.label)).toEqual(["Settings", "Members"]);
  });

  test.each([
    ["/members", true],
    ["/settings", false],
    ["/pipeline", false],
  ])("C1504: on %s the Members item is current: %s", (path, current) => {
    pathname = path;
    const html = renderToStaticMarkup(createElement(SidebarNav, {}));
    const link = /<a\b[^>]*href="\/members"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Members<\/a>/.exec(html)?.[0] ?? "";
    expect(link).not.toBe("");
    expect(link.includes('aria-current="page"')).toBe(current);
  });
});

describe("navigation, item words", () => {
  test("C2011: the Sites link is named after the org's plural, and still goes to /sites", () => {
    pathname = "/sites";
    const html = renderToStaticMarkup(createElement(SidebarNav, { words: itemWords("station", "stations") }));
    expect(html).toMatch(/<a\b[^>]*href="\/sites"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Sites &amp; stations<\/a>/);
    expect(html).not.toMatch(/equipment/i);
  });
});
