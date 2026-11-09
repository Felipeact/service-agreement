import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { PlanKey } from "@/domain/billing";
import { RegisterFields } from "./register-fields";
import type { PricingState } from "./state";

vi.mock("@/composition", () => ({ getBillingContainer: vi.fn() }));

const { default: RegisterPage, metadata } = await import("./page");

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

const renderFields = (state: PricingState, pending = false, initialPlan?: PlanKey) =>
  renderToStaticMarkup(createElement(RegisterFields, { state, pending, initialPlan }));
const inputs = (html: string, type: string) => [...html.matchAll(/<input([^>]*)\/?>/g)].filter((m) => m[1].includes(`type="${type}"`)).map((m) => m[1]);
const value = (attrs: string) => attrs.match(/value="([^"]+)"/)?.[1];

describe("the register page", () => {
  test("the trades are picked here: a page title, a form and the trades question", () => {
    expect(metadata.title).toBe("Register");
    const text = textOf(renderToStaticMarkup(createElement(RegisterPage, { searchParams: Promise.resolve({}) } as never)));
    expect(text).toContain("What does your business do?");
    expect(text).toContain("Start your free trial.");
  });
});

describe("the form", () => {
  test("four trade checkboxes named trade, in order, none checked at first", () => {
    const boxes = inputs(renderFields(IDLE), "checkbox");
    expect(boxes.map(value)).toEqual(["hvac", "plumbing", "electrical", "other"]);
    for (const attrs of boxes) {
      expect(attrs).toContain('name="trade"');
      expect(attrs).not.toContain("checked");
    }
    const labels = [...renderFields(IDLE).matchAll(/<label[^>]*>\s*<input[^>]*type="checkbox"[^>]*\/?>([^<]*)<\/label>/g)].map((m) => m[1].trim());
    expect(labels).toEqual(["Heating and cooling", "Plumbing", "Electrical", "Other"]);
  });

  test("three plan radios named plan, in order, with Team chosen by default", () => {
    const radios = inputs(renderFields(IDLE), "radio");
    expect(radios.map(value)).toEqual(["starter", "team", "business"]);
    expect(radios.filter((attrs) => attrs.includes("checked")).map(value)).toEqual(["team"]);
    for (const attrs of radios) expect(attrs).toContain('name="plan"');
  });

  test.each(["starter", "team", "business"] as const)("the plan carried from the pricing page (%s) starts chosen", (plan) => {
    const radios = inputs(renderFields(IDLE, false, plan), "radio");
    expect(radios.filter((attrs) => attrs.includes("checked")).map(value)).toEqual([plan]);
  });

  test("one submit button reads 'Continue to secure checkout'", () => {
    const buttons = [...renderFields(IDLE).matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)];
    expect(buttons).toHaveLength(1);
    expect(buttons[0][1]).toContain('type="submit"');
    expect(buttons[0][2]).toBe("Continue to secure checkout");
  });

  test("while pending the button is disabled and reads Starting…", () => {
    const [button] = [...renderFields(IDLE, true).matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)];
    expect(button[1]).toMatch(/\sdisabled=""/);
    expect(decode(button[2])).toBe("Starting…");
  });

  test("no trade shows its text inside the trades fieldset", () => {
    const html = renderFields({ status: "no_trade", trades: [] });
    const fieldset = html.match(/<fieldset[\s\S]*?<\/fieldset>/)![0];
    expect(textOf(fieldset)).toContain("Choose at least one trade.");
  });

  test.each(REFUSALS)("$status shows exactly its own text, in one role=alert element", ({ status, message }) => {
    const html = renderFields({ status, trades: [] });
    const text = textOf(html);
    expect(text).toContain(message);
    for (const other of REFUSALS.filter((r) => r.status !== status)) expect(text).not.toContain(other.message);
    const alerts = [...html.matchAll(/<[a-z]+[^>]*role="alert"[^>]*>([\s\S]*?)<\/[a-z]+>/g)];
    expect(alerts).toHaveLength(1);
    expect(textOf(alerts[0][1])).toBe(message);
  });

  test.each(REFUSALS)("after $status, ticked hvac and other stay checked and the rest do not", ({ status }) => {
    const checked = inputs(renderFields({ status, trades: ["hvac", "other"] }), "checkbox")
      .filter((attrs) => attrs.includes("checked"))
      .map(value);
    expect(checked).toEqual(["hvac", "other"]);
  });

  test("the idle form has no role=alert element", () => {
    expect(renderFields(IDLE)).not.toContain('role="alert"');
  });
});
