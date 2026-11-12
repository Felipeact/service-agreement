import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementTemplateSummary } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { canUseTemplates, canWriteTemplates } from "./state";
import { TemplatePreview } from "./template-preview";

const TEMPLATE: AgreementTemplateSummary = {
  id: "t-1",
  versionId: "77777777-7777-4777-8777-777777777777",
  versionNo: 3,
  updatedAt: new Date("2026-10-29T12:00:00Z"),
  system: false,
  body: {
    ...SYSTEM_AGREEMENT_BODY,
    name: "Light commercial essentials",
    description: "A focused plan for small offices.",
    intro: [{ type: "clause", text: "Payment is due in 30 days." }],
    footer: [{ type: "clause", text: "Thank you." }, { type: "paragraph", text: "Hello." }],
    preset: {
      termMonths: 12,
      lines: [
        { description: "Visit", visitMonths: [4, 10], assetTypeCodes: ["RTU", "NOPE"], costPerVisitCents: 45000 },
        { description: "Visit 2", visitMonths: [4, 10], assetTypeCodes: ["HP"], costPerVisitCents: null },
      ],
    },
  },
};
const actions = { duplicate: vi.fn(), customize: vi.fn() };

const preview = (canUse = true, canWrite = true) =>
  renderToStaticMarkup(createElement(TemplatePreview, { template: TEMPLATE, typeNames: { RTU: "RTUs", HP: "Heat pumps" }, canUse, canWrite, actions }));

describe("the template preview", () => {
  test("C5343: the eyebrow, name, description, the four-row box, Use template and Duplicate come in that order", () => {
    const html = preview();
    const order = [
      html.indexOf("Template preview</p>"),
      html.indexOf("Light commercial essentials</h2>"),
      html.indexOf("A focused plan for small offices."),
      html.indexOf("<dl"),
      html.indexOf("Use template"),
      html.indexOf(">Duplicate<"),
    ];
    expect(order.every((index) => index > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("C5343: the box has four rows labelled Default frequency, Equipment types, Sections and Preset lines, in that order", () => {
    const html = preview();
    expect([...html.matchAll(/<dt[^>]*>([^<]*)<\/dt>/g)].map((match) => match[1])).toEqual(["Default frequency", "Equipment types", "Sections", "Preset lines"]);
    expect([...html.matchAll(/<dd[^>]*>([^<]*)<\/dd>/g)].map((match) => match[1])).toEqual([
      "Semiannual",
      "RTUs, NOPE, Heat pumps",
      "2 sections · 2 clauses",
      "2 lines · 12 months term",
    ]);
  });

  test("C5410: Use template is a primary button with no href and Duplicate stays the secondary button", () => {
    const html = preview();
    expect(html).toMatch(/<button[^>]*data-variant="primary"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Use template<\/button>/);
    expect(html).toMatch(/<button[^>]*data-variant="secondary"[^>]*>Duplicate<\/button>/);
    expect(html).not.toMatch(/<a[^>]*>(?:<svg[\s\S]*?<\/svg>)?Use template</);
    expect(html).not.toContain("/agreements/new");
  });

  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", true],
    ["viewer", false],
  ] as const)("C5412: for a %s the preview shows Use template: %s", (role, shown) => {
    const html = preview(canUseTemplates(role), canWriteTemplates(role));
    expect(html.includes("Use template")).toBe(shown);
    expect(/<button[^>]*>(?:<svg[\s\S]*?<\/svg>)?Use template<\/button>/.test(html)).toBe(shown);
  });

  test("C5344: without the right to use or write, the buttons are not drawn", () => {
    expect(preview(true, false)).toContain("Use template");
    expect(preview(true, false)).not.toContain(">Duplicate<");
    const viewer = preview(false, false);
    expect(viewer).not.toContain("Use template");
    expect(viewer).toContain("Default frequency");
  });

  test("C2021: the equipment row is spoken in the org's words", () => {
    const words = { singular: "station", plural: "stations", Singular: "Station", Plural: "Stations" };
    const html = renderToStaticMarkup(createElement(TemplatePreview, { template: TEMPLATE, typeNames: {}, canUse: true, canWrite: true, actions, words }));
    expect(html).toContain("<dt");
    expect(html).toContain(">Station types</dt>");
    expect(html).not.toContain("Equipment types");
  });

  test("C5343: a template with no preset reads Not set, None and No preset lines", () => {
    const html = renderToStaticMarkup(
      createElement(TemplatePreview, { template: { ...TEMPLATE, system: true, body: SYSTEM_AGREEMENT_BODY }, typeNames: {}, canUse: true, canWrite: true, actions }),
    );
    expect([...html.matchAll(/<dd[^>]*>([^<]*)<\/dd>/g)].map((match) => match[1])).toEqual(["Not set", "None", "2 sections · 0 clauses", "No preset lines"]);
  });
});

describe("Edit and Customize on the preview", () => {
  const roleView = (role: "owner" | "admin" | "estimator" | "viewer", template = TEMPLATE) =>
    renderToStaticMarkup(createElement(TemplatePreview, { template, typeNames: {}, canUse: canUseTemplates(role), canWrite: canWriteTemplates(role), actions: canWriteTemplates(role) ? actions : undefined }));

  test.each(["owner", "admin"] as const)("C5421: for a %s the preview of an org template links Edit to /templates/<templateId>", (role) => {
    const html = roleView(role);
    expect(html).toMatch(/<a[^>]*href="\/templates\/t-1"[^>]*>Edit<\/a>/);
    expect(html).not.toContain("Customize");
  });

  test.each(["estimator", "viewer"] as const)("C5421: for a %s the preview has no Edit", (role) => {
    const html = roleView(role);
    expect(html).not.toContain("/templates/t-1");
    expect(html).not.toContain(">Edit<");
  });

  test("C5421: on the system template the preview shows Customize, a button, and no Edit", () => {
    const html = roleView("owner", { ...TEMPLATE, id: "t-0", system: true, body: SYSTEM_AGREEMENT_BODY });
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Customize<\/button>/);
    expect(html).not.toContain(">Edit<");
    expect(html).not.toContain("/templates/t-0");
    expect(roleView("estimator", { ...TEMPLATE, system: true, body: SYSTEM_AGREEMENT_BODY })).not.toContain("Customize");
  });
});
