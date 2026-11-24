import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PublicHeader, PUBLIC_NAV } from "./public-header";

describe("the public header", () => {
  const html = renderToStaticMarkup(<PublicHeader active="/pricing" />);

  test("links every public page, in the desktop bar and in the phone menu", () => {
    for (const { href, label } of PUBLIC_NAV) expect(html.match(new RegExp(`href="${href}"[^>]*>(?:<[^>]*>)*${label}`, "g"))?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/register"');
  });

  test("wears the product mark, no country or currency badge", () => {
    expect(html).toContain("/brand/mark-blue.svg");
    expect(html).not.toMatch(/🍁|CAD|Canada/);
  });

  test("marks the page you are on", () => {
    expect(html.match(/aria-current="page"/g)?.length).toBe(2);
  });
});
