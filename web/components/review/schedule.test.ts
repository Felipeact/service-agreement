import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { portalView } from "@/application/portal-view.testing";
import type { PortalView } from "@/application/ports";
import { ReviewView } from "./review-view";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

const LINES: PortalView["lines"] = [
  {
    description: "HVAC",
    visitsPerYear: 4,
    costPerVisitCents: 25000,
    annualCents: 100000,
    visitMonths: [3, 6, 9, 12],
    equipment: [
      { code: "AHU", name: "AHU" },
      { code: "RTU", name: "RTU" },
    ],
  },
  { description: "Boiler", visitsPerYear: 1, costPerVisitCents: 30000, annualCents: 30000, visitMonths: [10], equipment: [{ code: "BOILER", name: "Boiler" }] },
];

const render = (view: PortalView) =>
  text(
    renderToStaticMarkup(
      createElement(ReviewView, { token: "t", view, state: "open", actions: { decide: async () => ({ status: "idle" as const }), record: async () => undefined } }),
    ),
  );

describe("the review page's visit schedule", () => {
  test("C1083: Visit schedule sits after the service lines and before Service included, with March and October rows", () => {
    const out = render(portalView({ lines: LINES, annualCents: 130000 }));
    const at = (needle: string) => out.indexOf(needle);
    expect(at("Visit schedule")).toBeGreaterThan(at("Total per year"));
    expect(at("Visit schedule")).toBeLessThan(at("Service included"));
    const section = out.slice(at("Visit schedule"), at("Service included"));
    expect(section).toContain("March AHU, RTU");
    expect(section).toContain("October Boiler");
  });

  test("C1085: with no lines it says No visits scheduled yet", () => {
    const out = render(portalView({ lines: [], annualCents: 0 }));
    expect(out.slice(out.indexOf("Visit schedule"), out.indexOf("Service included"))).toContain("No visits scheduled yet");
  });
});
