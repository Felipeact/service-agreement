// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { TemplateFormInput } from "@/domain/agreement/template-form";
import type { SaveTemplateState } from "./state";
import { TemplateEditor, TemplateEditorView } from "./template-editor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TYPES = [
  { code: "RTU", name: "Rooftop units" },
  { code: "HP", name: "Heat pumps" },
];
const VALUES: TemplateFormInput = {
  name: "Quarterly HVAC",
  description: "Quarterly visits",
  intro: "# Welcome\nHello {{customer.name}}.",
  footer: "- Thank you.",
  schedule: true,
  scope: false,
  termMonths: "24",
  lines: [{ description: "Quarterly visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisit: "$450.00" }],
};

/** Every input tag of the markup whose attributes include all of `parts`. */
const inputs = (html: string, ...parts: string[]) => (html.match(/<input[^>]*>/g) ?? []).filter((tag) => parts.every((part) => tag.includes(part)));

const view = (values: TemplateFormInput = VALUES, errors: Record<string, string> = {}, message: string | null = null) =>
  renderToStaticMarkup(createElement(TemplateEditorView, { values, errors, types: TYPES, pending: false, message }));

describe("the template editor", () => {
  test("C5349: the fields come in order: Name, Description, Intro, Visit schedule, Scope, Closing text, Term length, Preset lines, then Save and Cancel", () => {
    const html = view();
    const labels = [
      html.search(/<label[^>]*for="template-name"[^>]*>Name</),
      html.search(/<label[^>]*for="template-description"[^>]*>Description</),
      html.search(/<label[^>]*for="template-intro"[^>]*>Intro</),
      html.search(/<label[^>]*for="template-schedule"/),
      html.search(/<label[^>]*for="template-scope"/),
      html.search(/<label[^>]*for="template-footer"[^>]*>Closing text</),
      html.search(/<label[^>]*for="template-term"[^>]*>Term length</),
      html.search(/<section aria-label="Preset lines"/),
      html.indexOf(">Save template<"),
      html.search(/<a[^>]*href="\/templates"[^>]*>Cancel</),
    ];
    expect(labels.every((index) => index > -1)).toBe(true);
    expect(labels).toEqual([...labels].sort((a, b) => a - b));
    expect(html).toContain("Visit schedule");
    expect(html).toMatch(/<label[^>]*for="template-scope"[\s\S]*?>Scope</);
  });

  test("C5349: the two sections are switches and say whether they are on", () => {
    const html = view();
    expect(inputs(html, 'id="template-schedule"', 'role="switch"', 'checked=""')).toHaveLength(1);
    expect(inputs(html, 'id="template-scope"', 'role="switch"')).toHaveLength(1);
    expect(inputs(html, 'id="template-scope"', 'checked=""')).toHaveLength(0);
  });

  test("C5349: each preset line has a description, a month grid, equipment types and a price per visit, then Remove; Add line follows the lines", () => {
    const html = view();
    const line = html.slice(html.indexOf('<fieldset class="flex flex-col gap-3 rounded-panel'));
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

  test("C5349: the buttons are real buttons and the fields are labelled, so the controls can be reached by touch and by name", () => {
    const html = view();
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Add line<\/button>/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Save template<\/button>/);
    expect(html.match(/<textarea/g)).toHaveLength(3);
    for (const id of ["template-name", "template-description", "template-intro", "template-footer", "template-term"]) expect(html).toContain(`id="${id}"`);
  });

  test("C5349: Add line is disabled at 20 lines", () => {
    const lines = Array.from({ length: 20 }, () => VALUES.lines[0]);
    expect(view({ ...VALUES, lines })).toMatch(/<button[^>]*disabled=""[^>]*>Add line<\/button>/);
    expect(view()).not.toMatch(/<button[^>]*disabled=""[^>]*>Add line<\/button>/);
  });
});

describe("a field that fails validation", () => {
  const typed: TemplateFormInput = { ...VALUES, name: "", termMonths: "61", lines: [{ description: "", visitMonths: [], assetTypeCodes: [], costPerVisit: "lots" }] };
  const errors = {
    name: "Name is required.",
    "preset.termMonths": "Term length must be empty or a whole number of months from 1 to 60.",
    "preset.lines.0.description": "Preset line 1 needs a description.",
    "preset.lines.0.visitMonths": "Preset line 1 needs at least one visit month.",
    "preset.lines.0.costPerVisitCents": "Enter a price per visit like $450.00, or leave it empty.",
    intro: "The intro has an unknown variable.",
  };

  test("C5350: the editor stays open and shows each message beside its field, announced with it", () => {
    const html = view(typed, errors);
    expect(html).toMatch(/id="template-name"[^>]*aria-invalid="true"[^>]*aria-describedby="template-name-error"[\s\S]*?<p id="template-name-error"[^>]*>Name is required\.<\/p>/);
    expect(html).toMatch(/id="template-term"[^>]*aria-invalid="true"[\s\S]*?<p id="template-term-error"[^>]*>Term length must be empty/);
    expect(html).toMatch(/id="line-0-description"[^>]*aria-invalid="true"[\s\S]*?Preset line 1 needs a description\./);
    expect(html).toMatch(/id="line-0-price"[^>]*aria-invalid="true"[\s\S]*?Enter a price per visit like \$450\.00/);
    expect(html).toContain("Preset line 1 needs at least one visit month.");
    expect(html).toContain("The intro has an unknown variable.");
    expect(html).toContain('role="alert"');
  });

  test("C5350: every field keeps what was typed", () => {
    const html = view(typed, errors);
    expect(html).toMatch(/id="template-term"[^>]*value="61"/);
    expect(html).toMatch(/id="line-0-price"[^>]*value="lots"/);
    expect(html).toMatch(/<textarea[^>]*id="template-description"[^>]*>Quarterly visits<\/textarea>/);
    expect(html).toContain("# Welcome\nHello {{customer.name}}.");
    expect(html).toContain("- Thank you.");
    expect(inputs(html, 'id="template-scope"', 'checked=""')).toHaveLength(0);
  });

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
  ])("C5424: a save answering %s shows %s, keeps every typed value and re-enables Save", async (status, message) => {
    const { save: action, container, root } = await submitWith({ status } as SaveTemplateState);
    expect(action).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(message);
    expect(field(container, "template-name").value).toBe("Quarterly HVAC");
    expect(field(container, "template-description").value).toBe("Quarterly visits");
    expect(field(container, "template-intro").value).toBe(VALUES.intro);
    expect(field(container, "template-footer").value).toBe("- Thank you.");
    expect(field(container, "template-term").value).toBe("24");
    expect(field(container, "line-0-price").value).toBe("$450.00");
    expect(container.querySelector<HTMLInputElement>("#template-scope")!.checked).toBe(false);
    expect(save(container).disabled).toBe(false);
    expect(save(container).textContent).toBe("Save template");
    act(() => root.unmount());
    container.remove();
  });

  test("C5424: the message is gone from a form whose save has not failed", () => {
    expect(view()).not.toContain("You don't have permission");
    expect(view()).not.toContain("no longer exists");
  });
});
