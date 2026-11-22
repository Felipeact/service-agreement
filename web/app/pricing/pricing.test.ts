import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { EXTRA_SEAT_CENTS, PLANS, formatPlanPrice } from "@/domain/billing";
import PricingPage, { metadata } from "./page";

/** React escapes apostrophes in text as &#x27;. */
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const renderPage = () => renderToStaticMarkup(createElement(PricingPage));

/**
 * The page is the owner's pricing mockup (docs/service_pacts_pricing), whose copy is shown verbatim. It names the plans
 * Starter, Pro and Max and quotes the prices as text, so these tests keep the mockup's figures and links honest against
 * the billing catalog the checkout and the plan limits read.
 */
const MOCKUP_PLAN_NAMES = { starter: "Starter", team: "Pro", business: "Max" } as const;

describe("the plans in the mockup match the billing catalog", () => {
  test.each(PLANS)("$key: the page quotes its monthly price and, for Starter and Pro, links to /register with that plan", (plan) => {
    const html = renderPage();
    const text = textOf(html);
    expect(text).toContain(MOCKUP_PLAN_NAMES[plan.key]);
    expect(text).toContain(formatPlanPrice(plan.monthlyCents));
    // The mockup's Max card says "Schedule call" and has no sign-up link; Starter and Pro (Team) do.
    if (plan.key !== "business") expect(html).toContain(`href="/register?plan=${plan.key}"`);
  });

  test("the plans are quoted in order, cheapest first", () => {
    const text = textOf(renderPage());
    const at = PLANS.map((plan) => text.indexOf(formatPlanPrice(plan.monthlyCents)));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  test("the page has no trade checkboxes: trades are picked at registration", () => {
    expect(renderPage()).not.toContain('type="checkbox"');
  });

  test("the extra-seat price is the catalog's", () => {
    expect(textOf(renderPage())).toContain(formatPlanPrice(EXTRA_SEAT_CENTS));
  });
});

describe("the page frame", () => {
  test("C2409: exactly one link says Sign in and it goes to /login", () => {
    const links = [...renderPage().matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)].filter((m) => m[2].trim() === "Sign in");
    expect(links).toHaveLength(1);
    expect(links[0][1]).toContain('href="/login"');
  });

  test("C2410: the title is Pricing, which the root layout's template reads as 'Pricing · Service Pacts'", () => {
    expect(metadata.title).toBe("Pricing");
    const layout = readFileSync(path.join(__dirname, "..", "layout.tsx"), "utf8");
    expect(layout).toContain('template: "%s · Service Pacts"');
    expect("%s · Service Pacts".replace("%s", String(metadata.title))).toBe("Pricing · Service Pacts");
  });
});

describe("seats are charged beyond the included ones (register-seats)", () => {
  test("C2616: the site sources say no unlimited seats and no free seats", () => {
    for (const file of ["components/site/content.ts", "components/site/sections.tsx", "app/pricing/_components/content.tsx"]) {
      const code = readFileSync(path.join(__dirname, "..", "..", file), "utf8").toLowerCase();
      expect(code, file).not.toContain("unlimited seats");
      expect(code, file).not.toContain("seats are never charged");
    }
  });
});
