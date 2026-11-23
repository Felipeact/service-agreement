import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementTemplateSummary } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { TemplateCard } from "./template-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/templates" }));

const NOW = new Date("2026-11-12T18:00:00Z");
const TEMPLATE: AgreementTemplateSummary = {
  id: "t-1",
  versionId: "v-1",
  versionNo: 3,
  updatedAt: new Date("2026-10-29T12:00:00Z"),
  system: false,
  body: {
    ...SYSTEM_AGREEMENT_BODY,
    name: "Standard commercial HVAC PM",
    description: "Quarterly inspection and maintenance for packaged and split systems.",
    preset: { termMonths: 12, lines: [{ description: "Visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisitCents: null }] },
  },
};
const actions = { duplicate: vi.fn(), archive: vi.fn(), customize: vi.fn() };

const card = (patch: { canWrite?: boolean; canUse?: boolean; template?: AgreementTemplateSummary } = {}) =>
  renderToStaticMarkup(createElement(TemplateCard, { template: patch.template ?? TEMPLATE, canWrite: patch.canWrite ?? true, canUse: patch.canUse ?? true, now: NOW, actions }));

describe("a template card", () => {
  test("[C35] the parts come in order: page thumbnail, name, description, frequency and updated-ago, then Use template", () => {
    const html = card();
    const at = (needle: string) => {
      const index = html.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    const order = [at("data-template-thumb"), at("Standard commercial HVAC PM</h3>"), at("Quarterly inspection and maintenance"), at("Quarterly · Updated 2 weeks ago"), at("Use template")];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("[C35] Use template shows for a member who can use templates and not for one who cannot", () => {
    expect(card({ canUse: true })).toContain("Use template");
    expect(card({ canUse: false })).not.toContain("Use template");
  });

  test("[C35] the writer's buttons are Edit, Duplicate and Archive, and a member who cannot write has none", () => {
    const html = card();
    expect(html).toMatch(/<a[^>]*href="\/templates\/t-1"[^>]*>Edit<\/a>/);
    expect(html).toContain(">Duplicate<");
    expect(html).toContain(">Archive<");
    expect(card({ canWrite: false })).not.toContain(">Duplicate<");
    expect(card({ canWrite: false })).not.toContain(">Edit<");
  });

  test("[C35] the footer shows the derived frequency, or No preset lines for a template without any", () => {
    expect(card()).toContain("Quarterly · ");
    expect(card({ template: { ...TEMPLATE, body: SYSTEM_AGREEMENT_BODY } })).toContain("No preset lines · ");
  });

  test("[C35] the system template has Customize and Duplicate, no Edit and no Archive, and the card says what it is", () => {
    const html = card({ template: { ...TEMPLATE, system: true, body: SYSTEM_AGREEMENT_BODY } });
    expect(html).toContain(">Customize<");
    expect(html).toContain(">Duplicate<");
    expect(html).not.toContain(">Edit<");
    expect(html).not.toContain(">Archive<");
    expect(html).toContain("every agreement uses");
  });

  test("[C39] the card's buttons are 44px tall below desktop and 32px from there up", () => {
    const html = card();
    const edit = /<a[^>]*>Edit</.exec(html)?.[0] ?? "";
    expect(edit).toContain("h-11");
    expect(edit).toContain("lg:h-8");
    const use = /<button[^>]*>(?:(?!<\/button>)[^])*Use template/.exec(html)?.[0] ?? "";
    expect(use).toContain("h-11");
    expect(use).toContain("lg:h-8");
  });
});
