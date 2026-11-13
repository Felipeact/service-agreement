// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementTemplateSummary } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/templates" }));

const { TemplateUseDialog } = await import("./template-use-dialog");
const { TemplatePreview } = await import("./template-preview");

const VERSION = "77777777-7777-4777-8777-777777777777";
const OTHER = "88888888-8888-4888-8888-888888888888";
const CUSTOMER = "11111111-1111-4111-8111-111111111111";

const TEMPLATE: AgreementTemplateSummary = {
  id: "t-1",
  versionId: VERSION,
  versionNo: 3,
  updatedAt: new Date("2026-10-29T12:00:00Z"),
  system: false,
  body: { ...SYSTEM_AGREEMENT_BODY, name: "Light commercial essentials", description: "A focused plan for small offices." },
};

const noop = vi.fn();
const actions = { start: noop, startImport: noop, confirmImport: noop, readImport: noop, extractImport: noop } as never;
const dialog = {
  customers: [{ id: CUSTOMER, name: "Harbourview" }],
  sites: [],
  templates: [
    { versionId: VERSION, name: "Light commercial essentials", description: "A focused plan for small offices.", presetLines: 2, termMonths: 12 },
    { versionId: OTHER, name: "Annual boiler", description: "", presetLines: 0, termMonths: null },
  ],
  actions,
};
const preview = { template: TEMPLATE, typeNames: {}, canUse: true, canWrite: false };

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  // jsdom draws no top layer: these stand in for the two methods the dialog calls and keep the `open` attribute honest.
  const proto = window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
beforeEach(() => {
  noop.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = () => act(async () => root.render(createElement(TemplateUseDialog, { preview, dialog })));
const dialogEl = () => container.querySelector("dialog")!;
const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)!;
const press = (label: string) => act(async () => button(label).click());
const chosen = () => container.querySelector<HTMLSelectElement>("#newAgreementTemplate")!.value;

describe("Use template on the Templates page", () => {
  test("C5410: pressing Use template calls onUse with the template's latest version id", async () => {
    const onUse = vi.fn();
    await act(async () => root.render(createElement(TemplatePreview, { ...preview, onUse })));
    await act(async () => button("Use template").click());
    expect(onUse).toHaveBeenCalledTimes(1);
    expect(onUse).toHaveBeenCalledWith(VERSION);
  });

  test("C5410: with the dialog mounted, Use template opens it with that template chosen, and the page does not navigate", async () => {
    const before = window.location.href;
    await mount();
    expect(dialogEl().hasAttribute("open")).toBe(false);
    expect(container.querySelector("#template-preview")).not.toBeNull();

    await press("Use template");

    expect(dialogEl().hasAttribute("open")).toBe(true);
    expect(chosen()).toBe(VERSION);
    expect(container.textContent).toContain("2 lines · 12 months term");
    expect(window.location.href).toBe(before);
    expect(push).not.toHaveBeenCalled();
    expect(container.querySelector("a[href^='/agreements/new']")).toBeNull();
  });

  test("C5411: closing the dialog without creating shuts it, keeps the same card's preview and calls no action", async () => {
    await mount();
    await press("Use template");
    expect(dialogEl().hasAttribute("open")).toBe(true);

    await press("Cancel");

    expect(dialogEl().hasAttribute("open")).toBe(false);
    expect(container.querySelector("#template-preview h2")?.textContent).toBe("Light commercial essentials");
    expect(noop).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    // It can be opened again, with the template chosen again.
    await press("Use template");
    expect(dialogEl().hasAttribute("open")).toBe(true);
    expect(chosen()).toBe(VERSION);
  });

  test("C5410: a template that is not one of the org's own (the system one) opens the dialog on Standard agreement", async () => {
    await act(async () => root.render(createElement(TemplateUseDialog, { preview: { ...preview, template: { ...TEMPLATE, system: true, versionId: "system-version" } }, dialog })));
    await press("Use template");
    expect(dialogEl().hasAttribute("open")).toBe(true);
    expect(chosen()).toBe("");
  });

  test("C5412: without the dialog props (a member who cannot start agreements) no dialog is mounted", async () => {
    await act(async () => root.render(createElement(TemplateUseDialog, { preview: { ...preview, canUse: false } })));
    expect(container.querySelector("dialog")).toBeNull();
    expect(container.textContent).not.toContain("Use template");
  });
});
