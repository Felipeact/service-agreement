import { existsSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

const { default: NotFound, metadata } = await import("./not-found");

const html = renderToStaticMarkup(createElement(NotFound)).replace(/&#x27;/g, "'");
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("the public 404 is the owner's mockup: a tab title, one h1, and the mockup's own words", () => {
  expect(metadata.title).toBe("Page not found");
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(text).toContain("This agreement or route doesn't exist.");
  expect(text).toContain("Back to Home");
});

test("every internal link on the 404 goes to a page that exists", () => {
  // Anchors only, without in-page fragments: the logo is an inline SVG and `/trades#hvac` is the trades page.
  const hrefs = [...new Set([...html.matchAll(/<a\b[^>]*\bhref="(\/[^"#?]*)[^"]*"/g)].map((match) => match[1]))];
  expect(hrefs.length).toBeGreaterThan(8);
  for (const href of hrefs) {
    const page = href === "/" ? path.join(__dirname, "page.tsx") : path.join(__dirname, href.slice(1), "page.tsx");
    expect(existsSync(page), href).toBe(true);
  }
});

test("it offers the way home, the demo and sign-in", () => {
  for (const href of ['href="/"', 'href="/demo"', 'href="/login"']) expect(html).toContain(href);
});
