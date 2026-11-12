import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { NoWorkspace, type NoWorkspaceState } from "./no-workspace";

const render = (state?: NoWorkspaceState) =>
  renderToStaticMarkup(createElement(NoWorkspace, { email: "owner@shop.test", signOut: async () => {}, ...(state ? { state } : {}) })).replace(/&#x27;/g, "'");
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("the no-workspace screen", () => {
  test.each([undefined, "none" as const])("C4219: state %s is exactly today's copy, with Sign out and no extra link", (state) => {
    const html = render(state);
    expect(text(html)).toBe("Service Agreement No workspace yet Your account isn't part of a company workspace. Ask your company's owner to invite you. Signed in as owner@shop.test Sign out");
    expect(html).not.toContain("<a ");
  });

  test("C4219: pending says it is setting up and offers Refresh back to this same page", () => {
    const html = render("pending");
    expect(html).toContain("Setting up your workspace");
    expect(html).not.toContain("No workspace yet");
    expect(html).toMatch(/<a\b[^>]*href=""[^>]*>\s*Refresh\s*<\/a>/);
    expect(html).toContain("Sign out");
    expect(html).not.toContain("/contact");
  });

  test("C4219: refused says the payment was received and links to /contact", () => {
    const html = render("refused");
    expect(text(html)).toContain("Your payment was received");
    expect(text(html)).toContain("couldn't set up your workspace");
    expect(html).not.toContain("No workspace yet");
    expect(html).toMatch(/<a\b[^>]*href="\/contact"[^>]*>\s*Contact us\s*<\/a>/);
    expect(html).toContain("Sign out");
    expect(html).not.toContain("Refresh");
  });
});
