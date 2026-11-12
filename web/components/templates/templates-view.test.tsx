import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementTemplateSummary, MemberRole } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { TemplatesView } from "./templates-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/templates" }));

const NOW = new Date("2026-11-12T18:00:00Z");
const line = (months: number[], codes: string[] = ["RTU"]) => ({ description: "Visit", visitMonths: months, assetTypeCodes: codes, costPerVisitCents: 45000 });

const template = (id: string, name: string, patch: Partial<AgreementTemplateSummary> = {}): AgreementTemplateSummary => ({
  id,
  versionId: `${id}-v`,
  versionNo: 2,
  updatedAt: new Date("2026-10-29T12:00:00Z"),
  system: false,
  body: { ...SYSTEM_AGREEMENT_BODY, name, description: `About ${name}`, preset: { termMonths: 12, lines: [line([3, 6, 9, 12])] } },
  ...patch,
});

const A = template("t-a", "Annual boiler");
const B = template("t-b", "Quarterly HVAC");
const SYSTEM = template("t-0", "Standard agreement", { system: true, body: SYSTEM_AGREEMENT_BODY });

const actions = { duplicate: vi.fn(), archive: vi.fn() };
const render = (role: MemberRole, props: Partial<Parameters<typeof TemplatesView>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(TemplatesView, { templates: [A, B], selectedId: "t-b", role, typeNames: { RTU: "Rooftop units" }, now: NOW, actions: role === "owner" || role === "admin" ? actions : undefined, ...props }),
  );

describe("the Templates page header", () => {
  test.each(["owner", "admin"] as const)("C5340: a %s sees the title, the subtitle and one primary New template link to /templates/new after the title", (role) => {
    const html = render(role);
    expect(html).toContain("<h1");
    expect(html).toContain("Agreement templates");
    expect(html).toContain("Standardize scope and pricing without making every customer agreement feel generic.");
    const buttons = html.match(/<a[^>]*href="\/templates\/new"[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain('data-variant="primary"');
    expect(html.indexOf("Agreement templates")).toBeLessThan(html.indexOf('href="/templates/new"'));
    expect(html).toContain("New template");
  });

  test.each(["estimator", "viewer"] as const)("C5340: a %s sees the title and no New template", (role) => {
    const html = render(role);
    expect(html).toContain("Agreement templates");
    expect(html).not.toContain("New template");
    expect(html).not.toContain('href="/templates/new"');
  });
});

describe("the two regions", () => {
  test("C5341: the card grid comes first, then the preview, and each exists once", () => {
    const html = render("owner");
    const grid = html.indexOf('aria-label="Templates"');
    const preview = html.indexOf('aria-label="Template preview"');
    expect(grid).toBeGreaterThan(-1);
    expect(preview).toBeGreaterThan(grid);
    expect(html.match(/aria-label="Templates"/g)).toHaveLength(1);
    expect(html.match(/aria-label="Template preview"/g)).toHaveLength(1);
  });

  test("C5341: side by side from 1280px with a two-column grid, stacked and one column below", () => {
    const html = render("owner");
    expect(html).toMatch(/class="[^"]*xl:grid-cols-\[minmax\(0,1fr\)_22rem\][^"]*"/);
    expect(html).toMatch(/<ul class="[^"]*\bgrid-cols-1\b[^"]*md:grid-cols-2[^"]*"/);
    expect(html).not.toMatch(/<ul class="[^"]*\b(?:sm|lg|xl):grid-cols-[3-9]/);
  });
});

describe("controls by role", () => {
  const menuItems = (html: string) => ({
    newButton: html.includes('href="/templates/new"'),
    menu: (html.match(/aria-label="Actions for /g) ?? []).length,
    edit: (html.match(/href="\/templates\/t-[ab]"/g) ?? []).length,
    duplicate: (html.match(/>Duplicate</g) ?? []).length,
    archive: (html.match(/>Archive</g) ?? []).length,
    use: html.includes("Use template"),
  });

  test.each(["owner", "admin"] as const)("C5344: a %s sees New template, a menu on each card (Edit, Duplicate, Archive), Duplicate and Use template", (role) => {
    // Two cards: two menus with Edit, Duplicate and Archive each; the preview of the selected org template adds one more Edit and one more Duplicate.
    expect(menuItems(render(role))).toEqual({ newButton: true, menu: 2, edit: 3, duplicate: 3, archive: 2, use: true });
  });

  test("C5344: an estimator sees Use template and none of the writer controls", () => {
    expect(menuItems(render("estimator"))).toEqual({ newButton: false, menu: 0, edit: 0, duplicate: 0, archive: 0, use: true });
  });

  test("C5344: a viewer sees none of the controls and still sees the list and the preview", () => {
    const html = render("viewer");
    expect(menuItems(html)).toEqual({ newButton: false, menu: 0, edit: 0, duplicate: 0, archive: 0, use: false });
    expect(html).toContain("Annual boiler");
    expect(html).toContain("Quarterly HVAC");
    expect(html).toContain('aria-label="Template preview"');
  });
});

describe("empty and error states", () => {
  test("C5345: an org with no template of its own shows the system template as the only, selected card with its preview and New template for an owner", () => {
    const html = render("owner", { templates: [SYSTEM], selectedId: "t-0" });
    expect(html.match(/<article/g)).toHaveLength(1);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Standard agreement");
    expect(html).toContain('aria-label="Template preview"');
    expect(html).toContain('href="/templates/new"');
    // The system template can be copied, not edited or archived.
    expect(html).not.toContain('href="/templates/t-0"');
    expect(html).not.toContain(">Archive<");
  });

  test("C5345: an estimator in that org sees the system template and no New template", () => {
    const html = render("estimator", { templates: [SYSTEM], selectedId: "t-0" });
    expect(html).toContain("Standard agreement");
    expect(html).not.toContain("New template");
  });

  test("C5346: when the list cannot be read the page says so with a link back to /templates and shows no cards", () => {
    const html = render("owner", { templates: null, selectedId: null });
    expect(html).toContain("We couldn&#x27;t load templates. Try again.");
    expect(html).toMatch(/<a[^>]*href="\/templates"[^>]*>Try again<\/a>/);
    expect(html).not.toContain("<article");
    expect(html).not.toContain('aria-label="Template preview"');
  });
});

describe("the two regions, arranged", () => {
  test("C5341: the preview sits beside the grid section, not inside it, and the container is a flex column that becomes a two-track grid from xl", () => {
    const html = render("owner");
    const sectionEnd = html.indexOf("</section>");
    expect(sectionEnd).toBeGreaterThan(html.indexOf('aria-label="Templates"'));
    expect(html.indexOf('aria-label="Template preview"')).toBeGreaterThan(sectionEnd);
    const container = /<div class="([^"]*)"><section aria-label="Templates"/.exec(html)?.[1] ?? "";
    expect(container.split(" ")).toEqual(expect.arrayContaining(["flex", "flex-col", "xl:grid", "xl:grid-cols-[minmax(0,1fr)_22rem]"]));
    expect(container).not.toMatch(/(?:^| )(?:sm|md|lg):grid\b/);
  });

  test("C5341: every card is one cell of the grid list, one per template, inside the grid section", () => {
    const html = render("owner");
    const section = html.slice(html.indexOf('<section aria-label="Templates"'), html.indexOf("</section>"));
    expect(section.match(/<li>/g)).toHaveLength(2);
    expect(section.match(/<article/g)).toHaveLength(2);
    expect(html.slice(html.indexOf("</section>")).match(/<article/g)).toBeNull();
  });
});

