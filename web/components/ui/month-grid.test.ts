import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LineForm } from "@/components/agreements/line-form";
import { MonthGrid } from "./month-grid";

const boxes = (html: string, name: string) => [...html.matchAll(new RegExp(`<input[^>]*name="${name}"[^>]*>`, "g"))].map((m) => m[0]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function expectGrid(html: string, name: string, checked: number[]) {
  const inputs = boxes(html, name);
  expect(inputs).toHaveLength(12);
  inputs.forEach((input, index) => {
    expect(input).toContain(`value="${index + 1}"`);
    expect(input.includes("checked")).toBe(checked.includes(index + 1));
  });
  for (const label of MONTHS) expect(html).toContain(`${label}</label>`);
  for (const preset of ["Quarterly", "Semi-annual", "Monthly"]) expect(html).toContain(`>${preset}</button>`);
}

describe("MonthGrid", () => {
  test("C1419: twelve boxes named as given, labelled Jan to Dec, checked as given, with three presets", () => {
    const html = renderToStaticMarkup(createElement(MonthGrid, { name: "defaultVisitMonths", legend: "Default visit months", checked: [3, 6, 9, 12] }));
    expectGrid(html, "defaultVisitMonths", [3, 6, 9, 12]);
  });

  test("C1419: the service line form still renders its twelve visitMonths boxes and three presets through it", () => {
    const html = renderToStaticMarkup(
      createElement(LineForm, {
        idPrefix: "new",
        initial: { description: "", visitMonths: [], costPerVisit: "", assetTypeIds: [] },
        state: { status: "idle" },
        pending: false,
        submitLabel: "Add line",
        checked: [4, 10],
      }),
    );
    expectGrid(html, "visitMonths", [4, 10]);
    expect(html).toContain("Visit months");
  });
});
