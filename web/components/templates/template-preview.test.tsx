import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementTemplateSummary } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
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
const actions = { duplicate: vi.fn() };

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

  test("C5343: Use template is the primary button and Duplicate the secondary one", () => {
    const html = preview();
    expect(html).toMatch(/<a[^>]*data-variant="primary"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Use template<\/a>/);
    expect(html).toMatch(/<button[^>]*data-variant="secondary"[^>]*>Duplicate<\/button>/);
  });

  test("C5357: Use template is a link to /agreements/new with the template's latest version", () => {
    expect(preview()).toMatch(/<a[^>]*href="\/agreements\/new\?template=77777777-7777-4777-8777-777777777777"/);
  });

  test("C5344: without the right to use or write, the buttons are not drawn", () => {
    expect(preview(true, false)).toContain("Use template");
    expect(preview(true, false)).not.toContain(">Duplicate<");
    const viewer = preview(false, false);
    expect(viewer).not.toContain("Use template");
    expect(viewer).toContain("Default frequency");
  });

  test("C5343: a template with no preset reads Not set, None and No preset lines", () => {
    const html = renderToStaticMarkup(
      createElement(TemplatePreview, { template: { ...TEMPLATE, system: true, body: SYSTEM_AGREEMENT_BODY }, typeNames: {}, canUse: true, canWrite: true, actions }),
    );
    expect([...html.matchAll(/<dd[^>]*>([^<]*)<\/dd>/g)].map((match) => match[1])).toEqual(["Not set", "None", "2 sections · 0 clauses", "No preset lines"]);
  });
});
