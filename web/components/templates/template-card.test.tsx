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
const actions = { duplicate: vi.fn(), archive: vi.fn() };

const card = (patch: { selected?: boolean; canWrite?: boolean; template?: AgreementTemplateSummary } = {}) =>
  renderToStaticMarkup(
    createElement(TemplateCard, { template: patch.template ?? TEMPLATE, selected: patch.selected ?? false, canWrite: patch.canWrite ?? true, now: NOW, actions }),
  );

describe("a template card", () => {
  test("C5342: the parts come in order: icon tile, menu, name, description, divider, then the frequency at the left and Updated with a relative time at the right", () => {
    const html = card();
    const at = (needle: string) => {
      const index = html.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    const order = [
      at("<svg"), // the icon tile
      at('aria-label="Actions for Standard commercial HVAC PM"'),
      at("Standard commercial HVAC PM</a>"),
      at("Quarterly inspection and maintenance"),
      at("<hr"),
      at(">Quarterly</span>"),
      at("Updated 2 weeks ago"),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("C5342: the name links to the card's own selection", () => {
    expect(card()).toMatch(/<a[^>]*href="\/templates\?selected=t-1"[^>]*>Standard commercial HVAC PM<\/a>/);
  });

  test("C5342: the menu button exists for an owner or admin and not for anyone else", () => {
    expect(card({ canWrite: true })).toContain('aria-label="Actions for ');
    expect(card({ canWrite: false })).not.toContain("Actions for ");
    expect(card({ canWrite: false })).not.toContain("Edit");
  });

  test("C5342: the menu offers Edit to the template's editor, Duplicate and Archive", () => {
    const html = card();
    expect(html).toMatch(/<a[^>]*href="\/templates\/t-1"[^>]*>Edit<\/a>/);
    expect(html).toContain(">Duplicate<");
    expect(html).toContain(">Archive<");
  });

  test("C5342: the selected card carries aria-current=true and an unselected one does not", () => {
    expect(card({ selected: true })).toContain('aria-current="true"');
    expect(card({ selected: false })).not.toContain("aria-current");
  });

  test("C5326: the footer shows the derived frequency; a template with no preset lines shows that instead", () => {
    expect(card()).toContain(">Quarterly</span>");
    const bare = { ...TEMPLATE, body: SYSTEM_AGREEMENT_BODY };
    expect(card({ template: bare })).toContain(">No preset lines</span>");
  });

  test("C5342: the system template's card has no Edit or Archive, only Duplicate, and says what it is", () => {
    const html = card({ template: { ...TEMPLATE, system: true, body: SYSTEM_AGREEMENT_BODY } });
    expect(html).not.toContain(">Edit<");
    expect(html).not.toContain(">Archive<");
    expect(html).toContain(">Duplicate<");
    expect(html).toContain("every agreement uses");
  });

  test("C5342: the menu button and the menu rows are 44px tall below desktop", () => {
    const html = card();
    expect(html).toMatch(/<summary[^>]*class="[^"]*size-11/);
    expect(html).toMatch(/<a[^>]*class="[^"]*min-h-11[^"]*"[^>]*>Edit</);
  });
});

describe("a template card, arranged", () => {
  test("C5342: the icon tile and the menu share one row with the menu pushed to the right, and a read-only member has the tile alone", () => {
    const html = card();
    expect(html).toMatch(/<div class="[^"]*\bjustify-between\b[^"]*"><span aria-hidden="true"[^>]*>[\s\S]*?<\/span><details/);
    expect(card({ canWrite: false })).not.toContain("<details");
  });

  test("C5342: the footer is one justified row with the frequency first at the left and Updated second at the right", () => {
    const html = card();
    expect(html).toMatch(/<div class="[^"]*\bjustify-between\b[^"]*"><span[^>]*>Quarterly<\/span><span[^>]*>Updated 2 weeks ago<\/span><\/div>/);
  });

  test("C5342: the selected card carries its own border and ring and the others do not", () => {
    expect(card({ selected: true })).toMatch(/<article[^>]*class="[^"]*\bborder-action\b[^"]*\bring-1\b/);
    expect(card({ selected: false })).not.toMatch(/<article[^>]*class="[^"]*\bborder-action\b/);
  });
});

