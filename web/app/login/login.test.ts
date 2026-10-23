import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { LoginFields } from "./login-fields";
import type { LoginState } from "./state";

vi.mock("@/composition", () => ({ getContainer: vi.fn() }));

const render = (state: LoginState, pending = false) =>
  renderToStaticMarkup(createElement(LoginFields, { state, pending, linkInvalid: false }));

/** React escapes apostrophes in text as &#x27;. */
const text = (html: string) => html.replace(/&#x27;/g, "'");

describe("login fields", () => {
  test("C2: a sent link names the address and hides the form", () => {
    const html = text(render({ status: "sent", email: "owner@example.com" }));

    expect(html).toContain("Check your email");
    expect(html.replace(/<[^>]+>/g, "")).toContain("We sent a sign-in link to owner@example.com.");
    expect(html).not.toContain('type="email"');
  });

  test("C4: an invalid email shows the field error", () => {
    const html = render({ status: "invalid_email", email: "owner@example" });
    expect(html).toMatch(/id="email-error"[^>]*>Enter a valid email address</);
  });

  test("C5: a rate limit says to wait", () => {
    expect(render({ status: "rate_limited", email: "owner@example.com" })).toContain(
      "Too many sign-in emails. Wait a minute and try again.",
    );
  });

  test("C6: any other failure says to try again", () => {
    expect(text(render({ status: "unavailable", email: "owner@example.com" }))).toContain(
      "We couldn't send the link. Try again.",
    );
  });

  test("C7: while sending, the button is disabled and reads Sending…", () => {
    const button = render({ status: "idle" }, true).match(/<button[^>]*>[^<]*<\/button>/)?.[0] ?? "";
    expect(button).toMatch(/\sdisabled=""/);
    expect(button).toContain(">Sending…</button>");
  });

  test("C7: at rest, the button is enabled and asks for a link", () => {
    const button = render({ status: "idle" }, false).match(/<button[^>]*>[^<]*<\/button>/)?.[0] ?? "";
    expect(button).not.toMatch(/\sdisabled=""/);
    expect(button).toContain(">Email me a sign-in link</button>");
  });
});

describe("login page", () => {
  const LINK_INVALID = "That sign-in link has expired or was already used. Request a new one.";

  async function renderPage(searchParams: Record<string, string>) {
    const { LoginFormForRequest } = await import("./page");
    const element = await LoginFormForRequest({ searchParams: Promise.resolve(searchParams) });
    return renderToStaticMarkup(element);
  }

  test("C10: a failed link explains itself", async () => {
    expect(await renderPage({ error: "link_invalid" })).toContain(LINK_INVALID);
  });

  test("C10: a plain visit does not", async () => {
    expect(await renderPage({})).not.toContain(LINK_INVALID);
  });
});
