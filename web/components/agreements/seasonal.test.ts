import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, ServiceLineView } from "@/application/ports";
import type { ScheduleRow, ScopeType } from "@/domain/agreement";
import { AgreementView, type AgreementActions } from "./agreement-view";
import { VisitScheduleSection } from "./visit-schedule";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));

const HEAT_TASK = "Inspect heat exchanger during heating season";
const COOL_TASK = "Check compressor operation during cooling operation";
const RTU: ScopeType = {
  code: "RTU",
  name: "Rooftop unit",
  tasks: [
    { description: "Replace filters", visitMonths: null },
    { description: "Check belts", visitMonths: [4, 5, 6, 7, 8, 9] },
    { description: HEAT_TASK, visitMonths: [1, 2, 3, 10, 11, 12] },
    { description: COOL_TASK, visitMonths: [4, 5, 6, 7, 8, 9] },
  ],
  assets: [{ unitNo: "RTU-1", typeModel: null, location: null }],
};

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const between = (out: string, from: string, to: string) => out.slice(out.indexOf(from), out.indexOf(to, out.indexOf(from) + from.length));

const rtuLine = (visitMonths: number[]): ServiceLineView => ({
  id: "l1",
  position: 0,
  description: "HVAC",
  visitsPerYear: visitMonths.length,
  costPerVisitCents: 25000,
  annualCents: 25000 * visitMonths.length,
  visitMonths,
  equipment: [{ id: "t-rtu", code: "RTU", name: "Rooftop unit" }],
});

function agreement(lines: ServiceLineView[]): AgreementDetail {
  return {
    id: "g1",
    number: "AG-1046",
    status: "draft",
    stage: "in_progress",
    site: { id: "s1", name: "Harbourview Towers" },
    customer: { id: "c1", name: "Harbourview Strata" },
    versions: [{ versionNo: 1, createdAt: new Date(Date.UTC(2026, 9, 20, 18)) }],
    shown: { versionNo: 1, current: true, lines, annualCents: lines.reduce((t, l) => t + l.annualCents, 0) },
    editable: true,
    equipmentChoices: [],
    serviceScope: { source: "live", takenAt: null, types: [RTU] },
    terms: null,
    portalLink: null,
    linkEmail: null,
  };
}

const actions: AgreementActions = {
  add: async () => ({ status: "saved" }),
  update: () => async () => ({ status: "saved" }),
  remove: () => async () => ({ status: "removed" }),
  revise: async () => ({ status: "idle" }),
  withdraw: async () => ({ status: "withdrawn" }),
  send: async () => ({ status: "idle" }),
  reissue: async () => ({ status: "idle" }),
};
const view = (a: AgreementDetail) => text(renderToStaticMarkup(createElement(AgreementView, { agreement: a, role: "estimator", actions })));
const included = (out: string) => between(out, "Service included", "Equipment");

describe("the agreement view's checklist", () => {
  test("C1113: a seasonal task shows its months; a task for every visit shows its description alone", () => {
    const list = included(view(agreement([rtuLine([3, 6, 9, 12])])));
    expect(list).toContain("Check belts (Apr–Sep visits)");
    expect(list).toMatch(/Replace filters (?!\()/);
  });

  test("C1117: a seasonal task no line visits is flagged after its label; a reached one is not", () => {
    const list = included(view(agreement([rtuLine([6])])));
    expect(list).toContain(`${HEAT_TASK} (Oct–Mar visits) No visit in these months`);
    expect(list).toContain(`${COOL_TASK} (Apr–Sep visits)`);
    expect(list).not.toContain(`${COOL_TASK} (Apr–Sep visits) No visit in these months`);
    expect(list.match(/No visit in these months/g)).toHaveLength(1);
  });
});

describe("the visit schedule's seasonal tasks", () => {
  const rows: ScheduleRow[] = [
    { month: 3, equipment: ["Air handling unit", "Rooftop unit"], tasks: [{ type: "Rooftop unit", description: HEAT_TASK }] },
    { month: 4, equipment: ["Rooftop unit"], tasks: [] },
  ];

  test("C1120: a month row lists its equipment, then each task as type: description", () => {
    const html = renderToStaticMarkup(createElement(VisitScheduleSection, { schedule: rows }));
    const march = /<li[^>]*data-month="3"[^>]*>.*?<\/li>/.exec(html)?.[0] ?? "";
    expect(text(march)).toContain(`Air handling unit, Rooftop unit Rooftop unit: ${HEAT_TASK}`);
    const april = /<li[^>]*data-month="4"[^>]*>.*?<\/li>/.exec(html)?.[0] ?? "";
    expect(text(april)).not.toContain(":");
  });

  test("C1121: the agreement view's March row lists the heating task", () => {
    const html = renderToStaticMarkup(createElement(AgreementView, { agreement: agreement([rtuLine([3, 6, 9, 12])]), role: "estimator", actions }));
    const march = /<li[^>]*data-month="3"[^>]*>.*?<\/li>/.exec(html)?.[0] ?? "";
    expect(text(march)).toContain(`Rooftop unit: ${HEAT_TASK}`);
  });
});
