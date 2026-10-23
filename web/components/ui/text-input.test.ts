import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { TextInput } from "./text-input";

const render = (error?: string) => renderToStaticMarkup(createElement(TextInput, { id: "email", label: "Work email", error }));

describe("TextInput", () => {
  test("C26: an error marks the input invalid and links the message under it", () => {
    const html = render("Enter a valid email address");
    const input = html.match(/<input[^>]*>/)?.[0] ?? "";

    expect(input).toContain('aria-invalid="true"');
    expect(input).toContain('aria-describedby="email-error"');
    const message = html.indexOf('id="email-error"');
    expect(message).toBeGreaterThan(html.indexOf("<input"));
    expect(html.slice(message)).toMatch(/^id="email-error"[^>]*>Enter a valid email address</);
  });

  test("C26: without an error there is no invalid state and no message", () => {
    const html = render();

    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("email-error");
  });
});
