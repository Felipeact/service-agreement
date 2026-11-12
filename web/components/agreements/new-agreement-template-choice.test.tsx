// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TemplateListResult } from "@/application/use-cases/templates";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import type { StartAgreementState, DialogTemplate } from "./new-agreement-state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/composition", () => ({ getContainer: async () => ({}) }));

const { NewAgreementDialog } = await import("./new-agreement-dialog");
const { dialogTemplates } = await import("@/app/(app)/new-agreement-launcher");

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222222";
const V1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const V2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const V3 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";

const QUARTERLY: DialogTemplate = { versionId: V1, name: "Quarterly HVAC", description: "Four visits a year.", presetLines: 3, termMonths: 12 };
const NO_TERM: DialogTemplate = { versionId: V2, name: "Annual plan", description: "", presetLines: 3, termMonths: null };
const EMPTY: DialogTemplate = { versionId: V3, name: "Blank wording", description: "Wording only.", presetLines: 0, termMonths: null };

const noop = vi.fn();
const actions = (start: (input: never) => Promise<StartAgreementState> = vi.fn()) => ({ start: start as never, startImport: noop, confirmImport: noop, readImport: noop, extractImport: noop });
const props = (templates: DialogTemplate[] | null, over: Record<string, unknown> = {}) => ({
  customers: [{ id: CUSTOMER, name: "Harbourview" }],
  sites: [{ id: SITE, name: "Tower A", customerId: CUSTOMER, customer: "Harbourview", liveAgreement: null }],
  actions: actions(),
  templates,
  ...over,
});
const html = (templates: DialogTemplate[] | null, over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(NewAgreementDialog, props(templates, over) as never)).replace(/&#x27;/g, "'");

/** The `<option>` texts of the select with this id, in order, and the one marked selected. */
function options(markup: string, id: string) {
  const select = new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)</select>`).exec(markup)?.[1] ?? "";
  const all = [...select.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)];
  return { texts: all.map((match) => match[2]), selected: all.filter((match) => match[1].includes("selected")).map((match) => match[2]) };
}

describe("the Template choice in the New agreement dialog", () => {
  test("C5400: a Template select comes above Customer and Site, Standard agreement first and selected, then the templates by name", () => {
    const markup = html([QUARTERLY, EMPTY, NO_TERM]);
    expect(markup).toMatch(/<label[^>]*for="newAgreementTemplate"[^>]*>Template</);
    expect(markup.indexOf('for="newAgreementTemplate"')).toBeLessThan(markup.indexOf('for="newAgreementCustomer"'));
    expect(markup.indexOf('for="newAgreementTemplate"')).toBeLessThan(markup.indexOf("Who is it for?"));
    const { texts, selected } = options(markup, "newAgreementTemplate");
    expect(texts).toEqual(["Standard agreement", "Annual plan", "Blank wording", "Quarterly HVAC"]);
    expect(selected).toEqual(["Standard agreement"]);
  });

  test("C5400: under the select the chosen template's description is shown", () => {
    const markup = html([QUARTERLY, NO_TERM], { initialTemplateVersionId: V1 });
    expect(options(markup, "newAgreementTemplate").selected).toEqual(["Quarterly HVAC"]);
    expect(markup).toContain("Four visits a year.");
    expect(html([QUARTERLY, NO_TERM])).not.toContain("Four visits a year.");
  });

  test("C5401: an org with no template of its own has one option, Standard agreement, selected", () => {
    const { texts, selected } = options(html([]), "newAgreementTemplate");
    expect(texts).toEqual(["Standard agreement"]);
    expect(selected).toEqual(["Standard agreement"]);
  });

  test.each<[string, DialogTemplate, string]>([
    ["three lines and a 12-month term", QUARTERLY, "3 lines · 12 months term"],
    ["three lines and no term", NO_TERM, "3 lines"],
    ["no lines", EMPTY, "No preset lines"],
  ])("C5402: a template with %s reads %s under the choice", (_label, template, expected) => {
    expect(html([template], { initialTemplateVersionId: template.versionId })).toContain(expected);
  });

  test("C5402: Standard agreement reads No preset lines", () => {
    const markup = html([QUARTERLY]);
    expect(markup).toContain("No preset lines");
    expect(markup).not.toContain("3 lines");
  });

  test("C5403: with the templates unavailable the select holds only Standard agreement, the message shows and Create stays enabled", () => {
    const markup = html(null);
    expect(options(markup, "newAgreementTemplate").texts).toEqual(["Standard agreement"]);
    expect(markup).toContain("Templates are unavailable. You can still start a standard agreement.");
    const create = /<button[^>]*type="submit"[^>]*>Create agreement</.exec(markup)?.[0];
    expect(create).toBeDefined();
    expect(create).not.toMatch(/\sdisabled=""/);
  });

  test("C5403: with templates listed the unavailable message is not shown", () => {
    expect(html([QUARTERLY])).not.toContain("Templates are unavailable");
  });

  test("C5425: the system template is not passed on, so the dialog's choices are Standard agreement plus the org's own", () => {
    const system = { id: "s", versionId: "sv", versionNo: 1, updatedAt: new Date(), system: true, body: SYSTEM_AGREEMENT_BODY };
    const own = { id: "t", versionId: V1, versionNo: 1, updatedAt: new Date(), system: false, body: { ...SYSTEM_AGREEMENT_BODY, name: "Quarterly HVAC", description: "d" } };
    const listed: TemplateListResult = { ok: true, templates: [own, system] };
    const passed = dialogTemplates(listed);
    expect(passed).toEqual([{ versionId: V1, name: "Quarterly HVAC", description: "d", presetLines: 0, termMonths: null }]);
    expect(options(html(passed), "newAgreementTemplate").texts).toEqual(["Standard agreement", "Quarterly HVAC"]);
    expect(options(html(dialogTemplates({ ok: true, templates: [system] })), "newAgreementTemplate").texts).toEqual(["Standard agreement"]);
    expect(dialogTemplates({ ok: false, code: "unavailable" })).toBeNull();
  });
});

describe("the dialog's answer to a rejected template", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    push.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const change = async (element: HTMLSelectElement | HTMLInputElement, value: string) =>
    act(async () => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")!.set!;
      setter.call(element, value);
      element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
  const pick = (id: string) => container.querySelector<HTMLSelectElement>(`#${id}`)!;

  test("C5405: invalid_template says so in words, creates nothing, keeps the fields and lets another template be chosen", async () => {
    const start = vi.fn(async (): Promise<StartAgreementState> => ({ status: "invalid_template" }));
    await act(async () => root.render(createElement(NewAgreementDialog, props([QUARTERLY, NO_TERM], { actions: actions(start) }) as never)));

    await change(pick("newAgreementCustomer"), CUSTOMER);
    await change(pick("newAgreementSite"), SITE);
    await change(pick("newAgreementTemplate"), V1);
    await act(async () => container.querySelector("form")!.requestSubmit());

    expect(start).toHaveBeenCalledWith(expect.objectContaining({ customer: CUSTOMER, site: SITE, templateVersionId: V1 }));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("That template is no longer available. Choose another.");
    expect(push).not.toHaveBeenCalled();
    // The fields are as they were typed, and the member can pick again.
    expect(pick("newAgreementCustomer").value).toBe(CUSTOMER);
    expect(pick("newAgreementSite").value).toBe(SITE);
    expect(pick("newAgreementTemplate").value).toBe(V1);
    expect(pick("newAgreementTemplate").disabled).toBe(false);

    start.mockResolvedValueOnce({ status: "started", agreementId: "ag-1", siteId: SITE });
    await change(pick("newAgreementTemplate"), V2);
    await act(async () => container.querySelector("form")!.requestSubmit());
    expect(start).toHaveBeenLastCalledWith(expect.objectContaining({ templateVersionId: V2 }));
    expect(push).toHaveBeenCalledWith("/agreements/ag-1");
  });

  test("C5404: choosing Standard agreement sends an empty version, which the action treats as none", async () => {
    const start = vi.fn(async (): Promise<StartAgreementState> => ({ status: "started", agreementId: "ag-2", siteId: SITE }));
    await act(async () => root.render(createElement(NewAgreementDialog, props([QUARTERLY], { actions: actions(start) }) as never)));
    await change(pick("newAgreementCustomer"), CUSTOMER);
    await change(pick("newAgreementSite"), SITE);
    await act(async () => container.querySelector("form")!.requestSubmit());
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ templateVersionId: "" }));
  });
});
