import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { portalView } from "@/application/portal-view.testing";
import type { PortalView } from "@/application/ports";
import { ReviewView } from "./review-view";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

const render = (view: PortalView) =>
  text(
    renderToStaticMarkup(
      createElement(ReviewView, { token: "t", view, state: "open", actions: { decide: async () => ({ status: "idle" as const }), record: async () => undefined } }),
    ),
  );

const TEMPLATE = {
  schema: 1,
  name: "Welcome",
  description: "",
  intro: [
    { type: "heading", text: "About this agreement" },
    { type: "paragraph", text: "Welcome {{customer.name}}." },
  ],
  footer: [{ type: "paragraph", text: "Thank you, {{tenant.legalName}}." }],
  sections: { schedule: true, scope: true },
  preset: { termMonths: null, lines: [] },
};

describe("the review page's template text", () => {
  test("C5331: the intro comes before the price table and the closing text after the terms", () => {
    const out = render(portalView({ template: TEMPLATE }));
    const at = (needle: string) => out.indexOf(needle);
    const positions = [at("About this agreement"), at("Welcome Fernwood Dental."), at("Total per year"), at("Terms"), at("Thank you, Kettle Ridge Mechanical Ltd.."), at("Download PDF")];
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  test.each<[string, boolean, boolean]>([
    ["both shown", true, true],
    ["schedule hidden", false, true],
    ["scope hidden", true, false],
    ["both hidden", false, false],
  ])("C5331: %s leaves out only the hidden sections, as the PDF does", (_label, schedule, scope) => {
    const out = render(portalView({ template: { ...TEMPLATE, sections: { schedule, scope } } }));
    expect(out.includes("Visit schedule")).toBe(schedule);
    expect(out.includes("Service included")).toBe(scope);
    for (const always of ["Service lines", "Total per year", "Terms", "Your answer"]) expect(out).toContain(always);
  });

  test("C5331: a view with no template shows what it showed before, and an unreadable one shows nothing", () => {
    const before = render(portalView());
    expect(before).toContain("Visit schedule");
    expect(before).toContain("Service included");
    expect(before).not.toContain("Introduction");
    expect(() => render(portalView({ template: null }))).toThrow();
  });
});
