import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/pipeline" }));

const { AppShell } = await import("./app-shell");

const html = renderToStaticMarkup(
  createElement(AppShell, { orgName: "Org", email: "u@x.test", signOut: async () => {}, children: createElement("p", null, "body") }),
);

const tag = (source: string, pattern: RegExp) => source.match(pattern)?.[0] ?? "";
const aside = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));

describe("shell search entries", () => {
  test("C1589: the sidebar holds a GET form to /search with a search input named q, named Search", () => {
    const form = tag(aside, /<form[^>]*>/);
    expect(form).toContain('method="get"');
    expect(form).toContain('action="/search"');
    const input = tag(aside, /<input[^>]*>/);
    expect(input).toContain('type="search"');
    expect(input).toContain('name="q"');
    expect(input).toContain('aria-label="Search"');
  });

  test("C1590: the top bar links to /search as Search with a 44 px square, and the sidebar is hidden below 1024 px", () => {
    const link = tag(html, /<a [^>]*href="\/search"[^>]*>/);
    expect(link).toContain('aria-label="Search"');
    expect(link).toMatch(/class="(?:[^"]*\s)?size-11(?:\s[^"]*)?"/);
    expect(html.indexOf(link)).toBeGreaterThan(html.indexOf("</aside>"));
    expect(tag(html, /<aside[^>]*>/)).toMatch(/class="[^"]*\bhidden\b[^"]*\blg:flex\b/);
  });

  test("C1591: the sidebar field is 44 px tall below 1024 px and 34 px from there up", () => {
    const input = tag(aside, /<input[^>]*>/);
    expect(input).toMatch(/class="(?:[^"]*\s)?h-11(?:\s[^"]*)?"/);
    expect(input).toMatch(/class="(?:[^"]*\s)?lg:h-\[34px\](?:\s[^"]*)?"/);
  });
});
