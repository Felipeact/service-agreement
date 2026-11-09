import { existsSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { FAQS, FOOTER_LINKS, NAV } from "./content";
import { HomeA, HomeB, HomeC } from "./home-concepts";

vi.mock("@/composition", () => ({ getBillingContainer: vi.fn() }));

const ROOT = path.join(__dirname, "..", "..", "app");
const pages: [string, ComponentType][] = [
  ["home (concept A)", HomeA],
  ["concept B", HomeB],
  ["concept C", HomeC],
  ["/product", (await import("@/app/product/page")).default],
  ["/demo", (await import("@/app/demo/page")).default],
  ["/trades", (await import("@/app/trades/page")).default],
  ["/pricing", (await import("@/app/pricing/page")).default],
  ["/about", (await import("@/app/about/page")).default],
  ["/faq", (await import("@/app/faq/page")).default],
  ["/contact", (await import("@/app/contact/page")).default],
];

const render = (Page: ComponentType) => renderToStaticMarkup(createElement(Page));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();

describe("the public site", () => {
  test.each(pages)("%s has one h1, one Sign in link to /login and a start-trial link to /register", (_name, Page) => {
    const html = render(Page);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    const signIn = [...html.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)].filter((m) => m[2].trim() === "Sign in");
    expect(signIn).toHaveLength(1);
    expect(signIn[0][1]).toContain('href="/login"');
    expect(html).toContain('href="/register"');
  });

  test.each(pages)("%s invents no customers, testimonials or results", (_name, Page) => {
    const shown = text(render(Page));
    for (const banned of ["trusted by", "testimonial", "case study", "customers love", "% faster", "hours saved"]) expect(shown).not.toContain(banned);
  });

  test("every header and footer link points at a page that exists", () => {
    for (const link of [...NAV, ...FOOTER_LINKS]) {
      const dir = path.join(ROOT, link.href.replace(/^\//, ""));
      expect(existsSync(path.join(dir, "page.tsx")), link.href).toBe(true);
    }
  });

  test("the root route is the public site, not a redirect to the app", async () => {
    expect(existsSync(path.join(ROOT, "page.tsx"))).toBe(true);
    const config = (await import("../../next.config")).default;
    expect(config.redirects).toBeUndefined();
  });

  test("a demo sample is always labelled as sample data", () => {
    expect(render(HomeA)).toContain("Sample data");
    expect(render(HomeB)).toContain("Sample data");
    expect(render(HomeC)).toContain("Sample data");
  });

  test("the FAQ has unique questions and a plain answer for each", () => {
    expect(new Set(FAQS.map((f) => f.q)).size).toBe(FAQS.length);
    for (const faq of FAQS) expect(faq.a.length).toBeGreaterThan(10);
  });
});

describe("the seat answer (register-seats)", () => {
  test("C2616: the FAQ answer to 'Do you charge per seat?' names the included seats and the extra-seat price", () => {
    const answer = FAQS.find((faq) => faq.q === "Do you charge per seat?")?.a ?? "";
    expect(answer).toContain("$15 a month");
    expect(answer).toContain("Starter 2");
    expect(answer).toContain("Team 5");
    expect(answer).toContain("Business 10");
    expect(answer.toLowerCase()).not.toContain("unlimited");
  });
});
