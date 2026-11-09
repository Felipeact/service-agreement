import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import PricingPage, { metadata } from "./page";

/** React escapes apostrophes in text as &#x27;. */
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const renderPage = () => renderToStaticMarkup(createElement(PricingPage));

const PLAN_FIGURES = [
  { key: "starter", name: "Starter", price: "$49", live: "15", imports: "10", seats: "2" },
  { key: "team", name: "Team", price: "$99", live: "60", imports: "40", seats: "5" },
  { key: "business", name: "Business", price: "$199", live: "200", imports: "120", seats: "10" },
] as const;

function planBlock(html: string, key: string) {
  const match = html.match(new RegExp(`<article[^>]*data-plan="${key}"[^>]*>([\\s\\S]*?)</article>`));
  expect(match, `a plan block for ${key}`).not.toBeNull();
  return match![1];
}

describe("the plans", () => {
  test("C2404: three plans in the order Starter, Team, Business", () => {
    const html = renderPage();
    const keys = [...html.matchAll(/<article[^>]*data-plan="([a-z]+)"/g)].map((m) => m[1]);
    expect(keys).toEqual(["starter", "team", "business"]);
  });

  test.each(PLAN_FIGURES)("C2404: $name shows $price, $live live agreements, $imports AI imports a month and $seats seats included", ({ key, name, price, live, imports, seats }) => {
    const block = textOf(planBlock(renderPage(), key));
    expect(block).toContain(name);
    expect(block).toContain(price);
    expect(block).toContain(`${live} live agreements`);
    expect(block).toContain(`${imports} AI imports a month`);
    expect(block).toContain(`${seats} seats included`);
  });

  test.each(PLAN_FIGURES)("$name's button is a link to /register with that plan, and the page has no trade checkboxes", ({ key, name }) => {
    const html = renderPage();
    const link = planBlock(html, key).match(/<a\b([^>]*)>([^<]*)<\/a>/)!;
    expect(link[1]).toContain(`href="/register?plan=${key}"`);
    expect(link[1]).toContain(`aria-label="Start 14-day trial, ${name} plan"`);
    expect(link[2]).toBe("Start 14-day trial");
    expect(html).not.toContain('type="checkbox"');
    expect(textOf(html)).not.toContain("Tick every trade");
  });
});

const TRIAL_LINE = "14-day free trial. A card is required to start, and billing is monthly after the trial.";

describe("the page copy", () => {
  test("C2406: the trial line appears once, before the first plan's name", () => {
    const text = textOf(renderPage());
    expect(text.split(TRIAL_LINE)).toHaveLength(2);
    expect(text.indexOf(TRIAL_LINE)).toBeLessThan(text.indexOf("Starter"));
  });

  const BANNED = ["trusted by", "most popular", "best value", "testimonial", "save"] as const;
  const bannedIn = (text: string) => BANNED.filter((word) => text.toLowerCase().includes(word));

  test("C2407: the page text contains none of the banned claim strings", () => {
    expect(bannedIn(textOf(renderPage()))).toEqual([]);
  });

  test.each(BANNED)("C2408: the scan reports %s when it is present, in another case, and not the trial line", (word) => {
    expect(bannedIn(`Before ${word.toUpperCase()} after`)).toEqual([word]);
    expect(bannedIn(TRIAL_LINE)).toEqual([]);
  });

  test("C2409: exactly one link says Sign in and it goes to /login", () => {
    const links = [...renderPage().matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)].filter((m) => m[2].trim() === "Sign in");
    expect(links).toHaveLength(1);
    expect(links[0][1]).toContain('href="/login"');
  });

  test("C2410: the title is Pricing, which the root layout's template reads as 'Pricing · Service Agreement'", () => {
    expect(metadata.title).toBe("Pricing");
    const layout = readFileSync(path.join(__dirname, "..", "layout.tsx"), "utf8");
    expect(layout).toContain('template: "%s · Service Agreement"');
    expect("%s · Service Agreement".replace("%s", String(metadata.title))).toBe("Pricing · Service Agreement");
  });

  test("C2411: the page says no 'equipment'", () => {
    expect(textOf(renderPage()).toLowerCase()).not.toContain("equipment");
  });
});

describe("seats are charged beyond the included ones (register-seats)", () => {
  test("C2616: the pricing page shows 2, 5 and 10 seats included in order and the extra-seat price, and never says unlimited seats", () => {
    const html = renderPage();
    const text = textOf(html);
    const at = ["2 seats included", "5 seats included", "10 seats included"].map((phrase) => text.indexOf(phrase));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text).toContain("Extra seats $15 a month");
    expect(text.toLowerCase()).not.toContain("unlimited seats");
    expect(text.toLowerCase()).not.toContain("seats are never charged");
  });

  test("C2616: the site sources say no unlimited seats and no free seats", () => {
    for (const file of ["components/site/content.ts", "components/site/sections.tsx", "components/site/home-concepts.tsx", "app/pricing/page.tsx"]) {
      const code = readFileSync(path.join(__dirname, "..", "..", file), "utf8").toLowerCase();
      expect(code, file).not.toContain("unlimited seats");
      expect(code, file).not.toContain("seats are never charged");
    }
  });
});
