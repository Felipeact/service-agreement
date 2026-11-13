// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { layoutFormFromBody, type AgreementLayoutForm } from "@/domain/agreement/template-form";
import type { SaveTemplateState } from "./state";
import { TemplateEditor, TemplateEditorView } from "./template-editor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TYPES = [
  { code: "RTU", name: "Rooftop units" },
  { code: "HP", name: "Heat pumps" },
];
const VALUES: AgreementLayoutForm = layoutFormFromBody({
  ...SYSTEM_AGREEMENT_BODY,
  name: "Quarterly HVAC",
  description: "Quarterly visits",
  intro: [
    { type: "heading", text: "Welcome" },
    { type: "paragraph", text: "Hello {{customer.name}}." },
  ],
  footer: [{ type: "clause", text: "Thank you." }],
  sections: { schedule: true, scope: false },
  preset: { termMonths: 24, lines: [{ description: "Quarterly visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisitCents: 45000 }] },
});

/** Every input tag of the markup whose attributes include all of `parts`. */
const inputs = (html: string, ...parts: string[]) => (html.match(/<input[^>]*>/g) ?? []).filter((tag) => parts.every((part) => tag.includes(part)));

const view = (values: AgreementLayoutForm = VALUES, errors: Record<string, string> = {}, message: string | null = null) =>
  renderToStaticMarkup(createElement(TemplateEditorView, { values, errors, types: TYPES, pending: false, message }));

describe("the template editor", () => {
  test("C5349: each preset line has a description, a month grid, equipment types and a price per visit, then Remove; Add line follows the lines", () => {
    const html = view();
    const line = html.slice(html.indexOf("<details"));
    const order = [
      line.search(/<label[^>]*for="line-0-description"[^>]*>Description</),
      line.search(/<label[^>]*for="line-0-price"[^>]*>Price per visit</),
      line.indexOf("Visit months"),
      line.indexOf("Equipment types"),
      line.indexOf("Remove line 1"),
      line.indexOf(">Add line<"),
    ];
    expect(order.every((index) => index > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(line.match(/name="lineMonths-0"/g)).toHaveLength(12);
    expect(line.match(/name="lineTypes-0"/g)).toHaveLength(2);
    expect(line).toContain("Rooftop units");
    expect(line).toContain("Heat pumps");
    expect(inputs(line, 'name="lineTypes-0"', 'value="RTU"', 'checked=""')).toHaveLength(1);
    expect(inputs(line, 'name="lineTypes-0"', 'value="HP"', 'checked=""')).toHaveLength(0);
  });

  test("C5349: a code already on a line that the org's catalog lacks is still shown, as its code", () => {
    const html = view({ ...VALUES, lines: [{ ...VALUES.lines[0], assetTypeCodes: ["NOPE"] }] });
    expect(inputs(html, 'name="lineTypes-0"', 'value="NOPE"', 'checked=""')).toHaveLength(1);
    expect(html).toContain("NOPE");
  });

  test("C5349: Add line is disabled at 20 lines", () => {
    const lines = Array.from({ length: 20 }, () => VALUES.lines[0]);
    expect(view({ ...VALUES, lines })).toMatch(/<button[^>]*disabled=""[^>]*>Add line<\/button>/);
    expect(view()).not.toMatch(/<button[^>]*disabled=""[^>]*>Add line<\/button>/);
  });
});

describe("a field that fails validation", () => {
  test("C5350: a form with no errors shows no alert, and a refusal that is not about a field is shown in words", () => {
    expect(view()).not.toContain('role="alert"');
    expect(view(VALUES, {}, "Only owners and admins can change templates.")).toContain("Only owners and admins can change templates.");
  });
});

describe("a save that fails for a reason other than a field", () => {
  async function submitWith(answer: SaveTemplateState) {
    const save = vi.fn(async () => answer);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(TemplateEditor, { templateId: "88888888-8888-4888-8888-888888888888", initial: VALUES, types: TYPES, save })));
    await act(async () => container.querySelector("form")!.requestSubmit());
    return { save, container, root };
  }
  const save = (container: HTMLElement) => [...container.querySelectorAll("button")].find((button) => button.type === "submit")!;
  const field = (container: HTMLElement, id: string) => container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;

  test.each<[SaveTemplateState["status"], string]>([
    ["forbidden", "You don't have permission to save templates."],
    ["not_found", "This template no longer exists."],
    ["unavailable", "We couldn't save the template. Try again."],
  ])("C5548: a save answering %s shows %s, keeps every typed value and every row, and re-enables Save", async (status, message) => {
    const { save: action, container, root } = await submitWith({ status } as SaveTemplateState);
    expect(action).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(message);
    expect(field(container, "template-name").value).toBe("Quarterly HVAC");
    expect(field(container, "template-description").value).toBe("Quarterly visits");
    expect(field(container, "template-term").value).toBe("24");
    expect(field(container, "line-0-price").value).toBe("$450.00");
    expect(field(container, "doc-title").value).toBe("Preventive maintenance service agreement");
    expect(field(container, "layout-0-text").value).toBe("Welcome");
    expect(field(container, "layout-1-text").value).toBe("Hello {{customer.name}}.");
    expect(container.querySelectorAll('section[aria-label="Layout"] > ol > li')).toHaveLength(VALUES.layout.length);
    expect(save(container).disabled).toBe(false);
    expect(save(container).textContent).toBe("Save template");
    act(() => root.unmount());
    container.remove();
  });

  test("C5548: the invalid answer of a save keeps the editor open with the row's message beside it and the typed text", async () => {
    const errors = { "layout.1.text": "Item 2 uses an unknown variable: nope.", name: "Name is required." };
    const { container, root } = await submitWith({ status: "invalid", errors, values: { ...VALUES, name: "" } });
    const rows = container.querySelectorAll('section[aria-label="Layout"] > ol > li');
    expect(rows[1].textContent).toContain("Item 2 uses an unknown variable: nope.");
    expect(rows[0].textContent).not.toContain("unknown variable");
    expect(field(container, "layout-1-text").value).toBe("Hello {{customer.name}}.");
    expect(field(container, "template-name").getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Fix the highlighted fields");
    act(() => root.unmount());
    container.remove();
  });

  test("C5424: the message is gone from a form whose save has not failed", () => {
    expect(view()).not.toContain("You don't have permission");
    expect(view()).not.toContain("no longer exists");
  });
});

describe("the editor's two regions", () => {
  const editor = () => renderToStaticMarkup(createElement(TemplateEditor, { templateId: null, initial: VALUES, types: TYPES, save: vi.fn() }));

  test("C5430: the form comes first and the preview second, and the preview region is labelled Preview", () => {
    const html = editor();
    const form = html.indexOf('<section aria-label="Template form"');
    const preview = html.indexOf('<section aria-label="Preview"');
    expect(form).toBeGreaterThan(-1);
    expect(preview).toBeGreaterThan(form);
    expect(html.match(/aria-label="Preview"/g)).toHaveLength(1);
    expect(html.match(/<form/g)).toHaveLength(1);
    // The fields sit in the first region and the preview heading in the second.
    expect(html.indexOf('id="template-name"')).toBeGreaterThan(form);
    expect(html.indexOf('id="template-name"')).toBeLessThan(preview);
    expect(html.slice(preview)).toContain(">Preview</h2>");
  });

  test("C5430: the container is a column below 1280 px and two equal tracks from xl", () => {
    const container = /^<div class="([^"]*)"/.exec(editor())?.[1] ?? "";
    expect(container).toMatch(/\bflex\b/);
    expect(container).toMatch(/\bflex-col\b/);
    expect(container).toMatch(/\bxl:grid\b/);
    expect(container).toMatch(/\bxl:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
    expect(container).not.toMatch(/(?<![:\w])grid-cols-/);
  });
});

describe("the preview follows the editor", () => {
  type Call = { url: string; init: RequestInit };
  let calls: Call[];
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Promise<Response>(() => {});
      }),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const open = (initial: AgreementLayoutForm = VALUES) => act(async () => root.render(createElement(TemplateEditor, { templateId: "88888888-8888-4888-8888-888888888888", initial, types: TYPES, save: vi.fn() })));
  const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
  const bodyOf = (index: number) => JSON.parse(String(calls[index].init.body)) as AgreementLayoutForm;
  const type = (id: string, value: string) =>
    act(async () => {
      const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  const press = (label: string) => act(async () => void [...container.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === label || button.textContent === label)!.click());

  test("C5549: opened on a saved template it requests the PDF once on mount, with its layout and options, and no more without an edit", async () => {
    await open();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/templates/preview");
    expect(bodyOf(0)).toEqual(JSON.parse(JSON.stringify(VALUES)));
    await tick(5000);
    expect(calls).toHaveLength(1);
  });

  test("C5549: a change to a document option makes one request, 700 ms after the change, carrying the new option", async () => {
    await open();
    await type("doc-title", "Maintenance schedule");
    await tick(699);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls).toHaveLength(2);
    expect(bodyOf(1).doc.title).toBe("Maintenance schedule");
    await tick(3000);
    expect(calls).toHaveLength(2);
  });

  test("C5549: moving a row and then changing a section option 300 ms later makes one request, at 1,000 ms, carrying both", async () => {
    await open();
    await press("Move row 2 up");
    await tick(300);
    await type("layout-3-title", "Visits this year");
    await tick(699);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls).toHaveLength(2);
    const sent = bodyOf(1);
    expect(sent.layout[0]).toMatchObject({ kind: "block", text: "Hello {{customer.name}}." });
    expect(sent.layout[1]).toMatchObject({ kind: "block", text: "Welcome" });
    expect(sent.layout.find((row) => row.kind === "section" && row.key === "schedule")).toMatchObject({ title: "Visits this year" });
  });

  test("C5549: with the preview unavailable the form's fields and Save stay editable", async () => {
    let fail: (error: unknown) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((_resolve, reject) => void (fail = reject))));
    await open();
    await act(async () => fail(new TypeError("Failed to fetch")));
    expect(container.textContent).toContain("Preview unavailable.");
    for (const id of ["template-name", "doc-title", "layout-0-text", "template-term", "line-0-price"]) {
      expect(container.querySelector<HTMLInputElement>(`#${id}`)!.disabled, id).toBe(false);
    }
    expect([...container.querySelectorAll("button")].find((button) => button.type === "submit")!.disabled).toBe(false);
  });

  test("C5548: invalid values mark the price field aria-invalid and the preview frame says Fix the highlighted fields to refresh the preview.", async () => {
    await open();
    expect(container.querySelector("#line-0-price")!.getAttribute("aria-invalid")).not.toBe("true");
    expect(container.textContent).not.toContain("Fix the highlighted fields to refresh the preview.");
    await type("line-0-price", "lots");
    await tick(2000);
    expect(container.querySelector("#line-0-price")!.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("Fix the highlighted fields to refresh the preview.");
    expect(calls).toHaveLength(1);
  });

  test("C5549: values the preview cannot draw make no request and the row's message shows without the save banner", async () => {
    await open();
    await type("line-0-price", "lots");
    await tick(2000);
    expect(calls).toHaveLength(1);
    expect(container.textContent).toContain("Enter a price per visit like $450.00");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
