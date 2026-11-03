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
    ["Settings", "/settings"],
  ])("C156: %s links to %s", (label, href) => {
    expect(hrefOf(label)).toBe(href);
  });

  test.each(["Sites & equipment", "Imports", "Task library"])("C156: %s has no page yet", (label) => {
    expect([...MAIN_NAV, ...FOOTER_NAV].some((item) => item.label === label)).toBe(true);
    expect(hrefOf(label)).toBeUndefined();
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
});
