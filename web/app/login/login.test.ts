import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { LoginFields } from "./login-fields";
import type { LoginState } from "./state";

vi.mock("@/composition", () => ({ getContainer: vi.fn() }));

const render = (state: LoginState, pending = false, linkInvalid = false) =>
  renderToStaticMarkup(createElement(LoginFields, { state, pending, linkInvalid }));

/** The text a visitor reads: React escapes apostrophes as &#x27;. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const alerts = (html: string) => [...html.matchAll(/<div[^>]*role="alert"[^>]*>([\s\S]*?)<\/button><\/div>/g)].map((m) => text(m[1]));
const submitButton = (html: string) => html.match(/<button[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";

describe("login fields (the owner's sign-in mockup, with the live states)", () => {
  test("C2: a sent link shows the confirmation, keeps the form and offers to resend", () => {
    const html = render({ status: "sent", email: "owner@example.com" });

    expect(text(html)).toContain("Sign-in link sent! Check your inbox to finish signing in.");
    expect(html).toContain('type="email"');
    expect(html).toContain('value="owner@example.com"');
    expect(text(submitButton(html))).toContain("Resend link");
  });

  test("C4: an invalid email shows the alert and marks the field", () => {
    const html = render({ status: "invalid_email", email: "owner@example" });
    expect(alerts(html).join(" ")).toContain("Enter a valid email address.");
    expect(html).toMatch(/<input[^>]*aria-invalid="true"/);
  });

  test("C5: a rate limit says to wait", () => {
    const shown = alerts(render({ status: "rate_limited", email: "owner@example.com" })).join(" ");
    expect(shown).toContain("Too many sign-in emails.");
    expect(shown).toContain("Wait a minute and try again.");
  });

  test("C6: any other failure says to try again", () => {
    const shown = alerts(render({ status: "unavailable", email: "owner@example.com" })).join(" ");
    expect(shown).toContain("We couldn't send the link.");
    expect(shown).toContain("Try again.");
  });

  test("C7: while sending, the button is disabled and reads Sending secure link...", () => {
    const button = submitButton(render({ status: "idle" }, true));
    expect(button).toMatch(/\sdisabled=""/);
    expect(text(button)).toContain("Sending secure link...");
  });

  test("C7: at rest, the button is enabled and asks for a link", () => {
    const button = submitButton(render({ status: "idle" }, false));
    expect(button).not.toMatch(/\sdisabled=""/);
    expect(text(button)).toContain("Email me a sign-in link");
  });

  test("a plain first visit shows no alert and no confirmation", () => {
    const html = render({ status: "idle" });
    expect(html).not.toContain('role="alert"');
    expect(text(html)).not.toContain("Sign-in link sent!");
  });
});

describe("login page", () => {
  async function renderPage(searchParams: Record<string, string>) {
    const { LoginFormForRequest } = await import("./page");
    const element = await LoginFormForRequest({ searchParams: Promise.resolve(searchParams) });
    return text(renderToStaticMarkup(element));
  }

  test("C10: a failed link explains itself, in the mockup's words", async () => {
    const shown = await renderPage({ error: "link_invalid" });
    expect(shown).toContain("Sign-in link expired or consumed.");
    expect(shown).toContain("Please enter your email below to receive a new one.");
  });

  test("C10: a plain visit does not", async () => {
    expect(await renderPage({})).not.toContain("Sign-in link expired or consumed.");
  });
});
