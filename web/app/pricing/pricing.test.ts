import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { EXTRA_SEAT_CENTS, PLANS, formatPlanPrice } from "@/domain/billing";
import { Content as PricingContent } from "./_components/content";
import { metadata } from "./page";

/** React escapes apostrophes in text as &#x27;. */
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const renderPage = () => renderToStaticMarkup(createElement(PricingContent));

/**
 * The plan cards and the comparison table are drawn from PLANS (components/site/plan-cards.tsx), the catalog the checkout, the
 * plan limits and the in-app Billing page read. The mockup's own plan names (Pro, Max) and limits were retired 2026-11-23.
 */

describe("the plans in the mockup match the billing catalog", () => {
  test.each(PLANS)("$key: the page names the plan, quotes its monthly price and links to /register with that plan", (plan) => {
    const html = renderPage();
    const text = textOf(html);
    expect(text).toContain(plan.name);
    expect(text).toContain(formatPlanPrice(plan.monthlyCents));
    expect(html).toContain(`href="/register?plan=${plan.key}"`);
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

describe("the monthly/annual switch", () => {
  const annual = () => renderToStaticMarkup(createElement(PricingContent, { interval: "year" }));

  test("the switch is two links; monthly is current by default and the buttons say Get started", () => {
    const html = renderPage();
    expect(html).toContain('href="/pricing?billing=annual"');
    expect(html).toContain('href="/pricing"');
    expect(textOf(html)).toContain("Get started");
    expect(textOf(html)).not.toMatch(/free trial|start free/i);
  });

  test("annual quotes a twelfth of the yearly price, the yearly total and the saving, and carries the interval into /register", () => {
    const html = annual();
    const text = textOf(html);
    for (const [plan, perMonth, yearly] of [["starter", "$63", "$758"], ["team", "$119", "$1,430"]] as const) {
      expect(text).toContain(perMonth);
      expect(text).toContain(`Billed ${yearly} CAD yearly, save 20%`);
      expect(html).toContain(`href="/register?plan=${plan}&amp;billing=annual"`);
    }
    expect(html).toMatch(/aria-current="true"[^>]*><span>Annual/);
  });
});

describe("the landing page pricing section", () => {
  const home = async (interval?: "year") => {
    const { Content } = await import("../_components/home-content");
    return renderToStaticMarkup(createElement(Content, { interval }));
  };

  test("monthly quotes the catalog prices and Get started goes to /register with the plan", async () => {
    const html = await home();
    for (const plan of PLANS) expect(textOf(html)).toContain(formatPlanPrice(plan.monthlyCents));
    expect(html).toContain('href="/register?plan=starter"');
    expect(html).toContain('href="/register?plan=team"');
  });

  test("annual quotes the yearly price per month and carries the interval to /register", async () => {
    const html = await home("year");
    expect(textOf(html)).toContain("$63");
    expect(textOf(html)).toContain("$119");
    expect(textOf(html)).toContain("Billed $1,430 CAD yearly, save 20%");
    expect(html).toContain('href="/register?plan=team&amp;billing=annual"');
  });

  test("the product page no longer shows the engine version badges", () => {
    const source = readFileSync(path.join(__dirname, "..", "product", "_components", "content.tsx"), "utf8");
    expect(source).not.toMatch(/Engine Core v3|ENGINE ARCHITECTURE/);
  });
});
