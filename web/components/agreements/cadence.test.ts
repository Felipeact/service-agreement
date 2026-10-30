import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, ServiceLineView } from "@/application/ports";
import type { EquipmentChoice, ServiceLineInput } from "@/domain/agreement";
import { AgreementView, type AgreementActions } from "./agreement-view";
import { LineForm } from "./line-form";
import { LineRow } from "./line-row";
import type { LineState } from "./state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));

const EMPTY: ServiceLineInput = { description: "", visitMonths: [], costPerVisit: "", assetTypeIds: [] };
const CHOICES: EquipmentChoice[] = [
  { id: "t-ahu", code: "AHU", name: "AHU", defaultVisitMonths: [3, 6, 9, 12] },
  { id: "t-boiler", code: "BOILER", name: "Boiler", defaultVisitMonths: [10] },
  { id: "t-rtu", code: "RTU", name: "RTU", defaultVisitMonths: [3, 6, 9, 12] },
];

const form = (over: { state?: LineState; checked?: number[]; choices?: EquipmentChoice[] } = {}) =>
  renderToStaticMarkup(
    createElement(LineForm, {
      idPrefix: "new-line",
      initial: EMPTY,
      state: over.state ?? { status: "idle" },
      pending: false,
      submitLabel: "Add line",
      choices: over.choices ?? CHOICES,
      checked: over.checked ?? [],
    }),
  );

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const fieldset = (html: string, legend: string) => new RegExp(`<fieldset[^>]*><legend[^>]*>${legend}</legend>.*?</fieldset>`).exec(html)?.[0] ?? "";
const boxes = (html: string, name: string) => html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`, "g")) ?? [];
const value = (box: string) => /value="([^"]*)"/.exec(box)?.[1];

const line = (over: Partial<ServiceLineView> = {}): ServiceLineView => ({
  id: "l1",
  position: 0,
  description: "HVAC",
  visitsPerYear: 4,
  costPerVisitCents: 25000,
  annualCents: 100000,
  visitMonths: [3, 6, 9, 12],
  equipment: [
    { id: "t-ahu", code: "AHU", name: "AHU" },
    { id: "t-rtu", code: "RTU", name: "RTU" },
  ],
  ...over,
});

const BOILER_LINE = line({ id: "l2", position: 1, description: "Boiler", visitsPerYear: 1, annualCents: 25000, visitMonths: [10], equipment: [{ id: "t-boiler", code: "BOILER", name: "Boiler" }] });

function agreement(over: Partial<AgreementDetail> = {}): AgreementDetail {
  const lines = over.shown?.lines ?? [line(), BOILER_LINE];
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
    equipmentChoices: CHOICES,
    serviceScope: { source: "live", takenAt: null, types: [] },
    terms: null,
    portalLink: null,
    linkEmail: null,
    ...over,
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
const view = (a: AgreementDetail) => renderToStaticMarkup(createElement(AgreementView, { agreement: a, role: "estimator", actions }));

describe("the line form's months", () => {
  test("C1062: a Visit months fieldset with twelve visitMonths boxes, Jan to Dec, the responsive grid and the presets", () => {
    const html = form();
    const months = fieldset(html, "Visit months");
    expect(months).not.toBe("");
    const checks = boxes(months, "visitMonths");
    expect(checks).toHaveLength(12);
    for (const box of checks) expect(box).toContain('type="checkbox"');
    expect(checks.map(value)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
    const labels = [...months.matchAll(/<label[^>]*><input[^>]*name="visitMonths"[^>]*\/?>([^<]+)<\/label>/g)].map((m) => m[1]);
    expect(labels).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
    expect(months).toMatch(/<div class="[^"]*\bgrid-cols-6\b[^"]*\bmd:grid-cols-12\b[^"]*">(<label[^>]*><input[^>]*name="visitMonths")/);
    for (const preset of ["Quarterly", "Semi-annual", "Monthly"]) expect(months).toMatch(new RegExp(`<button type="button"[^>]*>${preset}</button>`));
  });

  test("C1063: checked [4, 10] checks exactly the boxes 4 and 10", () => {
    const checked = boxes(form({ checked: [4, 10] }), "visitMonths").filter((box) => box.includes("checked"));
    expect(checked.map(value)).toEqual(["4", "10"]);
  });

  test("C1064: the month error renders under the grid", () => {
    const html = form({ state: { status: "invalid", errors: { visitMonths: "Choose at least one visit month" }, values: EMPTY } });
    expect(fieldset(html, "Visit months")).toContain("Choose at least one visit month");
  });

  test("C1065: no visitsPerYear input and no Visits per year text", () => {
    const html = form();
    expect(html).not.toMatch(/name="visitsPerYear"/);
    expect(html).not.toContain("Visits per year");
  });

  test("C1089: status locked shows This version can no longer be changed.", () => {
    expect(form({ state: { status: "locked" } })).toMatch(/role="alert"[^>]*>This version can no longer be changed\.</);
  });
});

describe("the line form's equipment", () => {
  test("C1067: an Equipment covered fieldset with one assetTypeIds box per choice, in order", () => {
    const equipment = fieldset(form(), "Equipment covered");
    expect(equipment).not.toBe("");
    const checks = boxes(equipment, "assetTypeIds");
    expect(checks.map(value)).toEqual(["t-ahu", "t-boiler", "t-rtu"]);
    for (const box of checks) expect(box).toContain('type="checkbox"');
  });

  test("C1074: a site with no equipment gets the link to the site and no line form", () => {
    const html = view(agreement({ equipmentChoices: [] }));
    expect(html).toMatch(/<a[^>]*href="\/sites\/s1"[^>]*>Add equipment to this site before adding a service line<\/a>/);
    expect(html).not.toContain('id="new-line-description"');
    expect(html).not.toContain(">Add line</button>");
  });
});

describe("the line row", () => {
  const row = (l: ServiceLineView) => text(renderToStaticMarkup(createElement(LineRow, { line: l })));

  test("C1066: months [3, 6, 9, 12] read Mar, Jun, Sep, Dec and 4 visits/yr; [12, 1] reads Jan, Dec", () => {
    const quarterly = row(line());
    expect(quarterly).toContain("Mar, Jun, Sep, Dec");
    expect(quarterly).toContain("4 visits/yr");
    expect(row(line({ visitMonths: [12, 1], visitsPerYear: 2 }))).toContain("Jan, Dec");
  });

  test("C1075: a line covering RTU and AHU shows AHU, RTU", () => {
    const covered = row(line({ equipment: [{ id: "t-rtu", code: "RTU", name: "RTU" }, { id: "t-ahu", code: "AHU", name: "AHU" }] }));
    expect(covered).toContain("AHU, RTU");
  });
});

describe("the agreement view's visit schedule", () => {
  test("C1084: Visit schedule comes after the lines and before Service included, with its month rows", () => {
    const out = text(view(agreement()));
    const at = (needle: string) => out.indexOf(needle);
    expect(at("Visit schedule")).toBeGreaterThan(at("Total per year"));
    expect(at("Visit schedule")).toBeLessThan(at("Service included"));
    const section = out.slice(at("Visit schedule"), at("Service included"));
    expect(section).toContain("March AHU, RTU");
    expect(section).toContain("October Boiler");
  });

  test("C1085: with no lines the section says No visits scheduled yet", () => {
    const out = text(view(agreement({ shown: { versionNo: 1, current: true, lines: [], annualCents: 0 } })));
    const section = out.slice(out.indexOf("Visit schedule"), out.indexOf("Service included"));
    expect(section).toContain("No visits scheduled yet");
  });
});
