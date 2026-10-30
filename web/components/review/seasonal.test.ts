import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { portalView } from "@/application/portal-view.testing";
import type { PortalView } from "@/application/ports";
import { ReviewView } from "./review-view";

const HEAT_TASK = "Inspect heat exchanger during heating season";
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

const scope = {
  schema: 2,
  takenAt: "2026-10-20T15:00:00Z",
  types: [
    {
      code: "RTU",
      name: "Rooftop unit",
      tasks: [
        { description: "Replace filters", visitMonths: null },
        { description: "Check belts", visitMonths: [4, 5, 6, 7, 8, 9] },
        { description: HEAT_TASK, visitMonths: [1, 2, 3, 10, 11, 12] },
      ],
      assets: [{ unitNo: "RTU-1", typeModel: null, location: null }],
    },
  ],
};
const line = (visitMonths: number[]): PortalView["lines"][number] => ({
  description: "HVAC",
  visitsPerYear: visitMonths.length,
  costPerVisitCents: 25000,
  annualCents: 25000 * visitMonths.length,
  visitMonths,
  equipment: [{ code: "RTU", name: "Rooftop unit" }],
});

const html = (visitMonths: number[]) =>
  renderToStaticMarkup(
    createElement(ReviewView, {
      token: "t",
      view: portalView({ lines: [line(visitMonths)], scope }),
      state: "open",
      actions: { decide: async () => ({ status: "idle" as const }), record: async () => undefined },
    }),
  );

describe("the review page's seasonal tasks", () => {
  test("C1114: the checklist marks a seasonal task with its months", () => {
    const out = text(html([3, 6, 9, 12]));
    const included = out.slice(out.indexOf("Service included"), out.indexOf("Equipment", out.indexOf("Service included")));
    expect(included).toContain("Check belts (Apr–Sep visits)");
  });

  test("C1117: the customer never sees No visit in these months", () => {
    expect(text(html([6]))).not.toContain("No visit in these months");
  });

  test("C1121: the March row of the schedule lists the heating task", () => {
    const march = /<li[^>]*data-month="3"[^>]*>.*?<\/li>/.exec(html([3, 6, 9, 12]))?.[0] ?? "";
    expect(text(march)).toContain(`Rooftop unit: ${HEAT_TASK}`);
  });
});
