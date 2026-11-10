import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BillingPanel } from "./billing-section";

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'");
const action = async () => {};

describe("the Billing section", () => {
  test("C2901: ready shows the plan name and a Manage billing submit button", () => {
    const out = html(createElement(BillingPanel, { view: { kind: "ready", planName: "Team" }, state: { status: "idle" }, pending: false, action }));
    expect(out).toContain("Team");
    expect(out).toContain("Manage billing");
    expect(out).toMatch(/<button[^>]*type="submit"/);
  });

  test("C2901: unavailable says Billing isn't available yet and has no button", () => {
    const out = html(createElement(BillingPanel, { view: { kind: "unavailable", planName: "Team" }, state: { status: "idle" }, pending: false, action }));
    expect(out).toContain("Billing isn't available yet");
    expect(out).not.toContain("<button");
    expect(out).not.toContain("Manage billing");
  });

  test("C2901: hidden renders nothing", () => {
    expect(html(createElement(BillingPanel, { view: { kind: "hidden" }, state: { status: "idle" }, pending: false, action }))).toBe("");
  });

  test("C2911: unavailable result shows the try-again notice", () => {
    const out = html(createElement(BillingPanel, { view: { kind: "ready", planName: "Team" }, state: { status: "unavailable" }, pending: false, action }));
    expect(out).toContain("We couldn't open billing. Try again in a moment.");
  });

  test("C2911: forbidden result shows the permission text", () => {
    const out = html(createElement(BillingPanel, { view: { kind: "ready", planName: "Team" }, state: { status: "forbidden" }, pending: false, action }));
    expect(out).toContain("You don't have permission to change this");
  });

  test("C2913: while pending the button is disabled with a pending label, and there is one submit button", () => {
    const out = html(createElement(BillingPanel, { view: { kind: "ready", planName: "Team" }, state: { status: "idle" }, pending: true, action }));
    expect(out).toMatch(/<button[^>]*disabled/);
    expect(out).toContain("Opening");
    expect(out).not.toContain("Manage billing");
    expect(out.match(/<button/g)).toHaveLength(1);
    expect(out.match(/type="submit"/g)).toHaveLength(1);
  });
});
