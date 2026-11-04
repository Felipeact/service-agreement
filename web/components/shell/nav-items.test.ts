import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
let pathname = "/pipeline";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

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

  test("C1393: Imports links to /imports", () => {
    expect(hrefOf("Imports")).toBe("/imports");
  });

  test("C1415: Task library links to /task-library", () => {
    expect(hrefOf("Task library")).toBe("/task-library");
  });

  test.each([
    ["/agreements", true],
    ["/agreements/ag-1", true],
    ["/pipeline", false],
  ])("C1358: on %s the Agreements item is current: %s", (path, current) => {
    pathname = path;
    const html = renderToStaticMarkup(createElement(SidebarNav, {}));
    const link = /<a\b[^>]*href="\/agreements"[^>]*>Agreements<\/a>/.exec(html)?.[0] ?? "";
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
    const link = /<a\b[^>]*href="\/sites"[^>]*>Sites &amp; equipment<\/a>/.exec(html)?.[0] ?? "";
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
    const link = /<a\b[^>]*href="\/imports"[^>]*>Imports<\/a>/.exec(html)?.[0] ?? "";
    expect(link).not.toBe("");
    expect(link.includes('aria-current="page"')).toBe(current);
  });

  test.each([
    ["/task-library", true],
    ["/task-library?type=RTU", true],
    ["/pipeline", false],
    ["/sites", false],
    ["/imports", false],
  ])("C1416: on %s the Task library item is current: %s", (path, current) => {
    pathname = path;
    const html = renderToStaticMarkup(createElement(SidebarNav, {}));
    const link = /<a\b[^>]*href="\/task-library"[^>]*>Task library<\/a>/.exec(html)?.[0] ?? "";
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
    ["/task-library", false],
  ])("C1504: on %s the Members item is current: %s", (path, current) => {
    pathname = path;
    const html = renderToStaticMarkup(createElement(SidebarNav, {}));
    const link = /<a\b[^>]*href="\/members"[^>]*>Members<\/a>/.exec(html)?.[0] ?? "";
    expect(link).not.toBe("");
    expect(link.includes('aria-current="page"')).toBe(current);
  });
});
