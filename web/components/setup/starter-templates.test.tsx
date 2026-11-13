// @vitest-environment jsdom
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { OrgSettings } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { templateFormFromBody } from "@/domain/agreement/template-form";
import { groupSetupCatalog } from "@/domain/org-settings/setup";
import { itemWords } from "@/domain/org-settings";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { SetupView } = await import("./setup-view");
const { StarterTemplates } = await import("./starter-templates");

const settings: OrgSettings = {
  legalName: "Flow Plumbing Ltd.",
  address: null,
  phone: "604-555-0123",
  accentColor: null,
  repairDiscountPct: 0,
  cpiCapPct: 5,
  cancellationNoticeDays: 30,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: null,
  defaultTermMonths: 12,
  renewalNoticeDays: 30,
  cpiRenegotiationThresholdPct: 5,
  renewalCpiPct: null,
  renewalCpiAsOf: null,
  proposalValidityDays: 30,
  itemSingular: "equipment",
  itemPlural: "equipment",
};
const words = itemWords("equipment", "equipment");
const noop = async () => ({ status: "idle" as const });

type Call = { url: string; init: RequestInit; resolve: (response: Response) => void; reject: (error: unknown) => void };
let calls: Call[];
let container: HTMLDivElement;
let root: Root;

const pdf = () => new Response(new Blob(["%PDF-1.4"]), { status: 200, headers: { "Content-Type": "application/pdf" } });

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => void calls.push({ url, init, resolve, reject }))),
  );
  URL.createObjectURL = vi.fn(() => "blob:starter-1");
  URL.revokeObjectURL = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const mount = () => act(async () => root.render(createElement(SetupView, { settings, groups: groupSetupCatalog([], words), words, action: noop })));
const text = () => container.textContent ?? "";
const button = (label: string) => [...container.querySelectorAll("button")].find((node) => node.textContent === label);
const staticHtml = () => renderToStaticMarkup(createElement(StarterTemplates, { settings })).replace(/&#x27;/g, "'");

describe("the starter templates on the setup screen", () => {
  test("C5502: one POST /templates/preview on mount with the system template's fields, and its PDF shown in an iframe", async () => {
    await mount();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/templates/preview");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual(templateFormFromBody(SYSTEM_AGREEMENT_BODY));
    await act(async () => calls[0].resolve(pdf()));
    expect(container.querySelector("iframe")?.getAttribute("src")).toContain("blob:starter-1");
    expect(calls).toHaveLength(1);
  });

  test("C5503: while the request is unanswered it says Updating preview… and the profile inputs stay enabled", async () => {
    await mount();
    expect(text()).toContain("Updating preview…");
    for (const id of ["legalName", "phone", "address"]) expect(container.querySelector<HTMLInputElement>(`#${id}`)!.disabled).toBe(false);
  });

  const failures: [string, () => Promise<Response>][] = [
    ["a 503", () => Promise.resolve(new Response(null, { status: 503 }))],
    ["a rejected fetch", () => Promise.reject(new TypeError("network"))],
    ["200 with text/html", () => Promise.resolve(new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } }))],
  ];
  test.each(failures)("C5504: %s shows Preview unavailable., Try again, and leaves Continue and Skip for now enabled", async (_name, answer) => {
    await mount();
    await act(async () => {
      answer().then(calls[0].resolve, calls[0].reject);
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(text()).toContain("Preview unavailable.");
    expect(button("Try again")).toBeDefined();
    expect(button("Continue")!.disabled).toBe(false);
    expect(button("Skip for now")!.disabled).toBe(false);
    await act(async () => button("Try again")!.click());
    expect(calls).toHaveLength(2);
  });

  test("C5510: the contract half says it is sample wording and has no iframe, button or pdf or signing link", () => {
    const half = staticHtml().split('data-half="contract"')[1];
    expect(half).toContain("Sample wording, not a signed contract");
    expect(half).not.toContain("<iframe");
    expect(half).not.toContain("<button");
    expect([...half.matchAll(/href="([^"]*)"/g)].map((match) => match[1]).filter((href) => /pdf|sign/i.test(href))).toEqual([]);
  });

  test("C5514: each half has one Customize in Templates link to /templates with the inline-link tap area", () => {
    const html = staticHtml();
    for (const half of ["agreement", "contract"]) {
      const section = html.split(`data-half="${half}"`)[1].split("data-half=")[0];
      const links = [...section.matchAll(/<a [^>]*href="\/templates"[^>]*>Customize in Templates<\/a>/g)].map((match) => match[0]);
      expect(links).toHaveLength(1);
      expect(links[0]).toContain("py-3.5 -my-3.5");
      expect(links[0]).toContain("lg:py-0 lg:my-0");
    }
  });
});
