// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementTemplateSummary, MemberRole } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { TemplatesView } from "./content";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/templates" }));

const NOW = new Date("2026-11-12T18:00:00Z");
const template = (id: string, name: string, patch: Partial<AgreementTemplateSummary> = {}): AgreementTemplateSummary => ({
  id,
  versionId: `${id}-v`,
  versionNo: 2,
  updatedAt: new Date("2026-10-29T12:00:00Z"),
  system: false,
  body: { ...SYSTEM_AGREEMENT_BODY, name, description: `About ${name}`, preset: { termMonths: 12, lines: [{ description: "Visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisitCents: 45000 }] } },
  ...patch,
});
const A = template("t-a", "Annual boiler");
const B = template("t-b", "Quarterly HVAC");
const actions = { duplicate: vi.fn(), archive: vi.fn() };
const render = (role: MemberRole, props: Partial<Parameters<typeof TemplatesView>[0]> = {}) =>
  renderToStaticMarkup(createElement(TemplatesView, { templates: [A, B], role, now: NOW, actions: role === "owner" || role === "admin" ? actions : undefined, ...props }));

describe("the Templates page", () => {
  test("[C35] one grid of cards, a card per template, and no preview panel", () => {
    const html = render("owner");
    expect(html.match(/<ul[^>]*aria-label="Templates"/g)).toHaveLength(1);
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).not.toContain('aria-label="Template preview"');
    expect(html).not.toContain("xl:grid-cols-[minmax(0,1fr)_22rem]");
    expect(html).toContain("Annual boiler");
    expect(html).toContain("Quarterly HVAC");
  });

  test.each(["owner", "admin"] as const)("[C35] a %s sees New template, a menu on each card and Use template", (role) => {
    const html = render(role);
    expect(html).toContain('href="/templates/new"');
    expect(html.match(/aria-label="Actions for /g)).toHaveLength(2);
    expect(html.match(/Use template/g)).toHaveLength(2);
  });

  test("[C35] an estimator has Use template and none of the writer controls; a viewer has neither", () => {
    const estimator = render("estimator");
    expect(estimator.match(/Use template/g)).toHaveLength(2);
    expect(estimator).not.toContain("Actions for ");
    expect(estimator).not.toContain("New template");
    const viewer = render("viewer");
    expect(viewer).not.toContain("Use template");
    expect(viewer).not.toContain("Actions for ");
    expect(viewer).toContain("Annual boiler");
  });

  test("[C37] an unreadable list shows the load error with a way back, and no cards", () => {
    const html = render("owner", { templates: null });
    expect(html).toContain("We couldn&#x27;t load templates. Try again.");
    expect(html).toMatch(/<a[^>]*href="\/templates"[^>]*>Try again<\/a>/);
    expect(html).not.toContain("<article");
  });

  test("[C37] an empty list says there are no templates yet", () => {
    const html = render("owner", { templates: [] });
    expect(html).toContain("No templates yet.");
    expect(html).not.toContain("<article");
  });
});

describe("the Contract wording card", () => {
  const link = (html: string) => html.match(/<a[^>]*href="\/templates\/contract"[^>]*>([^<]*)</);

  test("[C36] the card is one more cell of the same grid, below the templates, saying Standard contract wording with Customize for an owner", () => {
    const html = render("owner", { contractWording: { own: false } });
    const grid = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
    expect(grid.match(/<article/g)).toHaveLength(3);
    expect(grid.indexOf('aria-label="Contract wording"')).toBeGreaterThan(grid.indexOf("Quarterly HVAC"));
    expect(html).toContain("Standard contract wording");
    expect(link(html)?.[1]).toBe("Customize");
  });

  test("[C36] after the org saved its own wording the card says Your contract wording with Edit, for an owner and an admin", () => {
    for (const role of ["owner", "admin"] as const) {
      const html = render(role, { contractWording: { own: true } });
      expect(html).toContain("Your contract wording");
      expect(link(html)?.[1], role).toBe("Edit");
    }
  });

  test.each(["estimator", "viewer"] as const)("[C36] a %s sees the card and no link to the editor", (role) => {
    const html = render(role, { contractWording: { own: true } });
    expect(html).toContain("Your contract wording");
    expect(html).not.toContain('href="/templates/contract"');
  });

  test("[C36] with no wording read there is no card and the templates are still drawn", () => {
    const html = render("owner");
    expect(html).not.toContain('aria-label="Contract wording"');
    expect(html).toContain("Quarterly HVAC");
  });
});

describe("Use template", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("[C35] pressing Use template on a card opens the New agreement dialog without leaving the page", async () => {
    // jsdom has no native dialog behaviour.
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
    const dialog = { customers: [], sites: [], templates: [], actions: {} as never };
    await act(async () => root.render(createElement(TemplatesView, { templates: [A, B], role: "estimator", now: NOW, dialog })));
    const use = [...container.querySelectorAll("button")].filter((b) => b.textContent?.includes("Use template"));
    expect(use).toHaveLength(2);
    await act(async () => use[1].click());
    expect(container.querySelector("dialog[open]")).not.toBeNull();
  });
});
