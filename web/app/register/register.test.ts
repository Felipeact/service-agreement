import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { PlanKey } from "@/domain/billing";
import { readFileSync } from "node:fs";
import path from "node:path";
import { RegisterFields } from "./register-fields";
import type { PricingState } from "./state";

vi.mock("@/composition", () => ({ getBillingContainer: vi.fn() }));

const { default: RegisterPage, metadata } = await import("./page");

/** React escapes apostrophes in text as &#x27;. */
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const IDLE: PricingState = { status: "idle" };
const BLANK = { plan: "team", email: "", company: "", phone: "", seats: "5" };
const REFUSALS = [
  { status: "no_trade", message: "Choose at least one trade." },
  { status: "invalid_choice", message: "Choose a plan and your trades again." },
  { status: "not_configured", message: "Sign-up isn't open yet. Please check back soon." },
  { status: "unavailable", message: "We couldn't start sign-up. Try again in a minute." },
] as const;

const renderFields = (state: PricingState, pending = false, initialPlan?: PlanKey) =>
  renderToStaticMarkup(createElement(RegisterFields, { state, pending, initialPlan }));
const inputs = (html: string, type: string) => [...html.matchAll(/<input([^>]*)\/?>/g)].filter((m) => m[1].includes(`type="${type}"`)).map((m) => m[1]);
/** The plan radios only: the monthly/annual switch is a radio group of its own (name="interval"). */
const planRadios = (html: string) => inputs(html, "radio").filter((attrs) => attrs.includes('name="plan"'));
const value = (attrs: string) => attrs.match(/value="([^"]+)"/)?.[1];

describe("the register page", () => {
  test("the trades are picked here: a page title, a form and the trades question", () => {
    expect(metadata.title).toBe("Register");
    const text = textOf(renderToStaticMarkup(createElement(RegisterPage, { searchParams: Promise.resolve({}) } as never)));
    expect(text).toContain("What does your business do?");
    expect(text).toContain("Create your workspace.");
  });
});

describe("the form", () => {
  test("four trade checkboxes named trade, in order, with the mockup's Heating and cooling ticked at first", () => {
    const boxes = inputs(renderFields(IDLE), "checkbox");
    expect(boxes.map(value)).toEqual(["hvac", "plumbing", "electrical", "other"]);
    for (const attrs of boxes) expect(attrs).toContain('name="trade"');
    expect(boxes.filter((attrs) => attrs.includes("checked")).map(value)).toEqual(["hvac"]);
    const labels = [...renderFields(IDLE).matchAll(/<label[^>]*>(?:(?!<\/label>)[\s\S])*?type="checkbox"[\s\S]*?<\/label>/g)].map((m) => textOf(m[0]));
    expect(labels).toEqual(["hvac Heating and cooling Popular", "plumbing Plumbing & Hydronics", "bolt Electrical Systems", "handyman Refrigeration / Other"]);
  });

  test("three plan radios named plan, in order, with Team chosen by default", () => {
    const radios = planRadios(renderFields(IDLE));
    expect(radios.map(value)).toEqual(["starter", "team", "business"]);
    expect(radios.filter((attrs) => attrs.includes("checked")).map(value)).toEqual(["team"]);
    for (const attrs of radios) expect(attrs).toContain('name="plan"');
  });

  test.each(["starter", "team", "business"] as const)("the plan carried from the pricing page (%s) starts chosen", (plan) => {
    const radios = planRadios(renderFields(IDLE, false, plan));
    expect(radios.filter((attrs) => attrs.includes("checked")).map(value)).toEqual([plan]);
  });

  test("one submit button reads 'Continue to secure checkout'", () => {
    const buttons = [...renderFields(IDLE).matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    expect(buttons).toHaveLength(1);
    expect(buttons[0][1]).toContain('type="submit"');
    expect(textOf(buttons[0][2])).toBe("Continue to secure checkout arrow_forward");
  });

  test("while pending the button is disabled and reads Starting…", () => {
    const [button] = [...renderFields(IDLE, true).matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    expect(button[1]).toMatch(/\sdisabled=""/);
    expect(textOf(button[2])).toContain("Starting…");
  });

  test("no trade shows its text in a role=alert element", () => {
    const html = renderFields({ status: "no_trade", trades: [], values: BLANK, fields: {} });
    expect(textOf(html)).toContain("Choose at least one trade.");
    expect(html).toContain('role="alert"');
  });

  test.each(REFUSALS)("$status shows exactly its own text, in one role=alert element", ({ status, message }) => {
    const html = renderFields({ status, trades: [], values: BLANK, fields: {} });
    const text = textOf(html);
    expect(text).toContain(message);
    for (const other of REFUSALS.filter((r) => r.status !== status)) expect(text).not.toContain(other.message);
    const alerts = [...html.matchAll(/<[a-z]+[^>]*role="alert"[^>]*>([\s\S]*?)<\/[a-z]+>/g)];
    expect(alerts).toHaveLength(1);
    expect(textOf(alerts[0][1])).toBe(message);
  });

  test.each(REFUSALS)("after $status, ticked hvac and other stay checked and the rest do not", ({ status }) => {
    const checked = inputs(renderFields({ status, trades: ["hvac", "other"], values: BLANK, fields: {} }), "checkbox")
      .filter((attrs) => attrs.includes("checked"))
      .map(value);
    expect(checked).toEqual(["hvac", "other"]);
  });

  test("the idle form has no role=alert element", () => {
    expect(renderFields(IDLE)).not.toContain('role="alert"');
  });
});

const TYPED = { plan: "team", email: "owner@shop.ca", company: "Shop Ltd", phone: "604-555-0199", seats: "8" };
const attrsOf = (html: string, name: string) => html.match(new RegExp(`<input([^>]*name="${name}"[^>]*)/?>`))?.[1] ?? "";

describe("the contact fields (register-seats)", () => {
  test("C2600: email, company, phone, trades, plan, seats and the button come in that order, with the right names, types and autocomplete", () => {
    const html = renderFields(IDLE);
    const order = ["email", "company", "phone", "trade", "plan", "seats"].map((name) => html.indexOf(`name="${name}"`));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.indexOf("<button")).toBeGreaterThan(order[5]);
    expect(attrsOf(html, "email")).toContain('type="email"');
    expect(attrsOf(html, "email")).toContain('autoComplete="email"');
    expect(attrsOf(html, "company")).toContain('autoComplete="organization"');
    expect(attrsOf(html, "phone")).toContain('type="tel"');
    expect(attrsOf(html, "phone")).toContain('autoComplete="tel"');
    expect(attrsOf(html, "seats")).toContain('type="number"');
    const labels = ["Work email", "Company name", "Phone", "Team members"];
    for (const label of labels) expect(textOf(html)).toContain(label);
  });

  test.each([
    { field: "email", message: "Enter a work email we can reach you on.", fields: { email: true } },
    { field: "company", message: "Enter your company name.", fields: { company: true } },
    { field: "phone", message: "Enter a phone number with area code.", fields: { phone: true } },
    { field: "seats", message: "Choose between 5 and 50 team members.", fields: { seats: true } },
  ] as const)("C2606: a bad $field shows its own message in a role=alert element and marks only that field invalid", ({ field, message, fields }) => {
    const html = renderFields({ status: "invalid_details", trades: ["hvac"], values: TYPED, fields });
    const alerts = [...html.matchAll(/<p[^>]*role="alert"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1]));
    expect(alerts).toEqual([message]);
    for (const name of ["email", "company", "phone", "seats"]) {
      expect(attrsOf(html, name).includes("aria-invalid"), name).toBe(name === field);
    }
    expect(html.indexOf(message)).toBeGreaterThan(html.indexOf(`name="${field}"`));
  });

  test("C2606: after a refusal every typed value, the ticked trades and the chosen plan are kept", () => {
    const html = renderFields({ status: "invalid_details", trades: ["plumbing"], values: { ...TYPED, plan: "business", seats: "12" }, fields: { phone: true } });
    expect(attrsOf(html, "email")).toContain('value="owner@shop.ca"');
    expect(attrsOf(html, "company")).toContain('value="Shop Ltd"');
    expect(attrsOf(html, "phone")).toContain('value="604-555-0199"');
    expect(attrsOf(html, "seats")).toContain('value="12"');
    expect(inputs(html, "checkbox").filter((attrs) => attrs.includes("checked")).map(value)).toEqual(["plumbing"]);
    expect(planRadios(html).filter((attrs) => attrs.includes("checked")).map(value)).toEqual(["business"]);
  });

  test.each([
    { plan: "starter", included: 2 },
    { plan: "team", included: 5 },
    { plan: "business", included: 10 },
  ] as const)("C2610: with $plan the seats start at $included, min $included, max 50, and no total shows", ({ plan, included }) => {
    const html = renderFields(IDLE, false, plan);
    const attrs = attrsOf(html, "seats");
    expect(attrs).toContain(`value="${included}"`);
    expect(attrs).toContain(`min="${included}"`);
    expect(attrs).toContain('max="50"');
    expect(textOf(html)).not.toMatch(/extra seats? x/);
  });

  test.each([
    { plan: "team", seats: "8", total: "$149 + 3 extra seats x $19 = $206" },
    { plan: "starter", seats: "3", total: "$79 + 1 extra seat x $19 = $98" },
    { plan: "business", seats: "50", total: "$299 + 40 extra seats x $19 = $1,059" },
  ])("C2611: $plan with $seats seats shows $total", ({ plan, seats, total }) => {
    const html = renderFields({ status: "invalid_details", trades: ["hvac"], values: { ...TYPED, plan, seats }, fields: { phone: true } });
    expect(textOf(html)).toContain(total);
  });

  test.each(["unavailable", "not_configured"] as const)("C2617: after %s every typed value and choice is kept", (status) => {
    const html = renderFields({ status, trades: ["hvac", "other"], values: { ...TYPED, plan: "starter", seats: "4" }, fields: {} });
    expect(attrsOf(html, "email")).toContain('value="owner@shop.ca"');
    expect(attrsOf(html, "company")).toContain('value="Shop Ltd"');
    expect(attrsOf(html, "phone")).toContain('value="604-555-0199"');
    expect(attrsOf(html, "seats")).toContain('value="4"');
    expect(planRadios(html).filter((attrs) => attrs.includes("checked")).map(value)).toEqual(["starter"]);
    expect(inputs(html, "checkbox").filter((attrs) => attrs.includes("checked")).map(value)).toEqual(["hvac", "other"]);
  });

  test("C2618: while a submit is pending the button is disabled and reads Starting…", () => {
    const [button] = [...renderFields(IDLE, true).matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    expect(button[1]).toMatch(/\sdisabled=""/);
    expect(textOf(button[2])).toContain("Starting…");
  });

  test("C2620: the text fields are 44 px tall below lg, and no fixed pixel width is set", () => {
    const html = renderFields(IDLE);
    for (const name of ["email", "company", "phone", "seats"]) expect(attrsOf(html, name), name).toContain("max-lg:min-h-11");
    const code = readFileSync(path.join(__dirname, "register-fields.tsx"), "utf8");
    expect(code).not.toMatch(/\bw-\[\d+px\]|\bwidth:\s*\d+px/);
  });

  test("C4308: email_in_use says the email has a workspace, links Sign in, marks the email field and keeps every value", () => {
    const html = renderFields({ status: "email_in_use", trades: ["hvac", "other"], values: { ...TYPED, plan: "starter", seats: "4" }, fields: { email: true } });
    expect(textOf(html)).toContain("This email already has a workspace.");
    expect(html).toMatch(/<a [^>]*href="\/login"[^>]*>Sign in<\/a>/);
    expect(attrsOf(html, "email")).toContain('aria-invalid="true"');
    const describedBy = attrsOf(html, "email").match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeTruthy();
    expect(html).toContain(`id="${describedBy}"`);
    expect(attrsOf(html, "email")).toContain('value="owner@shop.ca"');
    expect(attrsOf(html, "company")).toContain('value="Shop Ltd"');
    expect(attrsOf(html, "phone")).toContain('value="604-555-0199"');
    expect(attrsOf(html, "seats")).toContain('value="4"');
    expect(planRadios(html).filter((attrs) => attrs.includes("checked")).map(value)).toEqual(["starter"]);
    expect(inputs(html, "checkbox").filter((attrs) => attrs.includes("checked")).map(value)).toEqual(["hvac", "other"]);
    expect(attrsOf(html, "company")).not.toContain("aria-invalid");
  });

  test("C4309: the rendered email_in_use message names no role, org, invitation or count", () => {
    const html = renderFields({ status: "email_in_use", trades: ["hvac"], values: { ...TYPED, plan: "team", seats: "8" }, fields: { email: true } });
    const message = textOf(html.match(/<p id="register-email-message"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "");
    expect(message).toBe("This email already has a workspace. Sign in");
    expect(message).not.toMatch(/owner|admin|member|invit|org|\d/i);
  });
});

describe("the billing interval (monthly or annual)", () => {
  const render = (initialInterval?: "month" | "year") => renderToStaticMarkup(createElement(RegisterFields, { state: IDLE, pending: false, initialInterval }));
  const intervalRadios = (html: string) => inputs(html, "radio").filter((attrs) => attrs.includes('name="interval"'));

  test("the form offers monthly and annual, monthly chosen by default, and quotes monthly prices", () => {
    const html = render();
    const radios = intervalRadios(html);
    expect(radios.map(value)).toEqual(["month", "year"]);
    expect(radios.filter((attrs) => attrs.includes("checked")).map(value)).toEqual(["month"]);
    expect(textOf(html)).toContain("$149 CAD");
    expect(textOf(html)).toContain("billed monthly");
  });

  test("arriving from the annual pricing page chooses annual and quotes the yearly price per month", () => {
    const html = render("year");
    expect(intervalRadios(html).filter((attrs) => attrs.includes("checked")).map(value)).toEqual(["year"]);
    // Team: $149 x 12 less 20% = $1,430.40 a year, $119 a month.
    expect(textOf(html)).toContain("$119 CAD");
    expect(textOf(html)).toContain("billed $1,430 yearly");
    expect(textOf(html)).toContain("Card charged yearly");
  });
});
