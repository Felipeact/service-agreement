import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { PlanKey } from "@/domain/billing";
import { PricingFields } from "./pricing-fields";
import type { PricingState } from "./state";

vi.mock("@/composition", () => ({ getBillingContainer: vi.fn() }));

const { default: PricingPage, metadata } = await import("./page");

/** React escapes apostrophes in text as &#x27;. */
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const IDLE: PricingState = { status: "idle" };
const REFUSALS = [
  { status: "no_trade", message: "Choose at least one trade." },
  { status: "invalid_choice", message: "Choose a plan and your trades again." },
  { status: "not_configured", message: "Sign-up isn't open yet. Please check back soon." },
  { status: "unavailable", message: "We couldn't start sign-up. Try again in a minute." },
] as const;

const renderFields = (state: PricingState, pending = false, pressedPlan: PlanKey | null = null) =>
  renderToStaticMarkup(createElement(PricingFields, { state, pending, pressedPlan }));
const renderPage = () => renderToStaticMarkup(createElement(PricingPage));

const PLAN_FIGURES = [
  { key: "starter", name: "Starter", price: "$49", live: "15", imports: "10" },
  { key: "team", name: "Team", price: "$99", live: "60", imports: "40" },
  { key: "business", name: "Business", price: "$199", live: "200", imports: "120" },
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
    const names = PLAN_FIGURES.map((plan) => textOf(html).indexOf(plan.name));
    expect(names).toEqual([...names].sort((a, b) => a - b));
  });

  test.each(PLAN_FIGURES)("C2404: $name shows $price, $live live agreements, $imports AI imports a month and unlimited seats", ({ key, name, price, live, imports }) => {
    const block = textOf(planBlock(renderPage(), key));
    expect(block).toContain(name);
    expect(block).toContain(price);
    expect(block).toContain(`${live} live agreements`);
    expect(block).toContain(`${imports} AI imports a month`);
    expect(block).toContain("Unlimited seats");
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

  test.each([{ status: "idle" } as PricingState, ...REFUSALS.map((r) => ({ status: r.status, trades: ["hvac"] }) as PricingState)])(
    "C2411: the page and its form say no 'equipment' in the $status state",
    (state) => {
      expect(textOf(renderPage()).toLowerCase()).not.toContain("equipment");
      expect(textOf(renderFields(state)).toLowerCase()).not.toContain("equipment");
    },
  );
});

describe("the form", () => {
  test("C2412: four trade checkboxes named trade, in order, with their labels, none checked at first", () => {
    const labels = [...renderFields(IDLE).matchAll(/<label[^>]*>\s*<input([^>]*)\/?>([^<]*)<\/label>/g)];
    expect(labels.map((m) => m[2].trim())).toEqual(["Heating and cooling", "Plumbing", "Electrical", "Other"]);
    expect(labels.map((m) => m[1].match(/value="([^"]+)"/)?.[1])).toEqual(["hvac", "plumbing", "electrical", "other"]);
    for (const m of labels) {
      expect(m[1]).toContain('type="checkbox"');
      expect(m[1]).toContain('name="trade"');
      expect(m[1]).not.toContain("checked");
    }
  });

  test.each(PLAN_FIGURES)("C2413: the $name button is named plan with value $key and reads Start 14-day trial", ({ key, name }) => {
    const buttons = [...renderFields(IDLE).matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)];
    expect(buttons.map((m) => m[1].match(/value="([^"]+)"/)?.[1])).toEqual(["starter", "team", "business"]);
    const mine = buttons.find((m) => m[1].includes(`value="${key}"`))!;
    expect(mine[1]).toContain('name="plan"');
    expect(mine[1]).toContain('type="submit"');
    expect(mine[1]).toContain(`aria-label="Start 14-day trial, ${name} plan"`);
    expect(mine[2]).toBe("Start 14-day trial");
  });

  test("C2416: no trade shows its text inside the trades fieldset", () => {
    const html = renderFields({ status: "no_trade", trades: [] });
    const fieldset = html.match(/<fieldset[\s\S]*?<\/fieldset>/)![0];
    expect(textOf(fieldset)).toContain("Choose at least one trade.");
  });

  test.each(REFUSALS)("C2416: $status shows exactly its own text", ({ status, message }) => {
    // The text checks for C2417, C2418 and C2419 are the same table: each refusal shows its own message and no other.
    const text = textOf(renderFields({ status, trades: [] }));
    expect(text).toContain(message);
    for (const other of REFUSALS.filter((r) => r.status !== status)) expect(text).not.toContain(other.message);
  });

  test("C2417: invalid_choice shows 'Choose a plan and your trades again.'", () => {
    expect(textOf(renderFields({ status: "invalid_choice", trades: [] }))).toContain("Choose a plan and your trades again.");
  });

  test("C2418: not_configured shows 'Sign-up isn't open yet. Please check back soon.'", () => {
    expect(textOf(renderFields({ status: "not_configured", trades: ["hvac"] }))).toContain("Sign-up isn't open yet. Please check back soon.");
  });

  test("C2419: unavailable shows 'We couldn't start sign-up. Try again in a minute.'", () => {
    expect(textOf(renderFields({ status: "unavailable", trades: ["hvac"] }))).toContain("We couldn't start sign-up. Try again in a minute.");
  });

  test.each(REFUSALS)("C2420: after $status, ticked hvac and other stay checked and plumbing and electrical do not", ({ status }) => {
    const html = renderFields({ status, trades: ["hvac", "other"] });
    const checked = [...html.matchAll(/<input([^>]*)\/?>/g)].filter((m) => m[1].includes("checked")).map((m) => m[1].match(/value="([^"]+)"/)![1]);
    expect(checked).toEqual(["hvac", "other"]);
  });

  test("C2421: at rest no plan button is disabled", () => {
    const buttons = [...renderFields(IDLE, false).matchAll(/<button\b([^>]*)>/g)];
    expect(buttons).toHaveLength(3);
    for (const m of buttons) expect(m[1]).not.toMatch(/\sdisabled=""/);
  });

  test.each(PLAN_FIGURES)("C2421: while pending with $name pressed, all three are disabled and only $name reads Starting…", ({ key }) => {
    const buttons = [...renderFields(IDLE, true, key).matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)];
    expect(buttons).toHaveLength(3);
    for (const m of buttons) expect(m[1]).toMatch(/\sdisabled=""/);
    for (const m of buttons) {
      const plan = m[1].match(/value="([^"]+)"/)![1];
      expect(decode(m[2])).toBe(plan === key ? "Starting…" : "Start 14-day trial");
    }
  });

  test.each(REFUSALS)("C2423: the $status text sits in one element with role=alert", ({ status, message }) => {
    const alerts = [...renderFields({ status, trades: [] }).matchAll(/<[a-z]+[^>]*role="alert"[^>]*>([\s\S]*?)<\/[a-z]+>/g)];
    expect(alerts).toHaveLength(1);
    expect(textOf(alerts[0][1])).toBe(message);
  });

  test("C2423: the idle form has no role=alert element", () => {
    expect(renderFields(IDLE)).not.toContain('role="alert"');
  });
});
