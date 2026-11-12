import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
// The page now mounts the client status panel, whose Server Action reaches the composition root; that is not under test here.
vi.mock("./actions", () => ({ checkWorkspaceAction: vi.fn() }));

const { default: Page, metadata } = await import("./page");

const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const html = () => renderToStaticMarkup(createElement(Page));
const source = () => readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("the success page", () => {
  test("C2532: it says the trial is registered and a sign-in link will be emailed, links to /login, and claims nothing it cannot back", () => {
    const text = textOf(html());
    expect(text).toContain("Your trial is registered.");
    expect(text).toContain("We will email a sign-in link to the address you gave at checkout.");
    expect(html()).toMatch(/<a\b[^>]*href="\/login"[^>]*>\s*Sign in\s*<\/a>/);
    expect(metadata.title).toBe("Thanks");
    // The suffix comes from the root layout's title template, so the rendered title is "Thanks · Service Agreement".
    const layout = readFileSync(path.join(__dirname, "..", "..", "layout.tsx"), "utf8");
    expect(layout).toContain('template: "%s · Service Agreement"');
    for (const banned of ["equipment", "trusted by", "most popular", "best value", "testimonial", "save"]) {
      expect(text.toLowerCase(), banned).not.toContain(banned);
    }
  });

  test("C2533: it reads no cookie, no search params and no Supabase client", () => {
    const code = source();
    for (const forbidden of ["cookies", "searchParams", "supabase", "headers(", "await "]) expect(code, forbidden).not.toContain(forbidden);
  });

  test("C2534: its own links are LinkButtons (44 px below lg) and it sets no fixed pixel width", () => {
    const code = source();
    expect((code.match(/<LinkButton\b/g) ?? []).length).toBeGreaterThan(0);
    expect(code).not.toMatch(/<a\b|<Link\b/);
    expect(code).not.toMatch(/\bw-\[\d+px\]|\bwidth:\s*\d+px/);
    const buttons = readFileSync(path.join(__dirname, "..", "..", "..", "components", "ui", "button.tsx"), "utf8");
    expect(buttons).toMatch(/\bh-11\b/);
  });
});
