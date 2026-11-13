// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { layoutFromRows, rowsFromLayout, type LayoutFormState, type LayoutRow } from "@/domain/agreement/layout-form";
import { bodyFromContractForm } from "@/domain/contract/layout-form";
import { LayoutFields } from "./layout-fields";
import { TemplateEditor } from "./template-editor";
import { EMPTY_LAYOUT_FORM } from "@/domain/agreement/template-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SIXTEEN = [
  "terms.paymentDays",
  "terms.cancellationNoticeDays",
  "terms.repairDiscountPct",
  "terms.cpiCapPct",
  "terms.cpiRenegotiationThresholdPct",
  "terms.renewalNoticeDays",
  "province",
  "term.label",
  "tenant.legalName",
  "customer.name",
  "site.name",
  "term.start",
  "tenant.address",
  "tenant.phone",
  "signer.name",
  "terms.taxNote",
];

const AGREEMENT: LayoutFormState = {
  doc: { title: "Preventive maintenance service agreement", showMeta: true, pageHeader: "first", pageFooter: "number" },
  layout: rowsFromLayout([
    { kind: "block", type: "heading", text: "About this agreement" },
    { kind: "block", type: "paragraph", text: "Welcome." },
    { kind: "section", key: "price" },
    { kind: "section", key: "schedule" },
    { kind: "section", key: "included" },
    { kind: "section", key: "equipment" },
    { kind: "section", key: "terms" },
  ]),
};

const CONTRACT: LayoutFormState = {
  doc: { title: "Service Contract", showMeta: true, pageHeader: "first", pageFooter: "number" },
  layout: rowsFromLayout([
    { kind: "section", key: "price" },
    { kind: "block", type: "clause", text: "Pay in {{terms.paymentDays}} days." },
    { kind: "section", key: "signatures" },
  ]),
};

let container: HTMLDivElement;
let root: Root;
/** The form state as the editor last reported it. */
const seen: { value: LayoutFormState } = { value: AGREEMENT };

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function Harness({ initial, document: kind, errors, report }: { initial: LayoutFormState; document: "agreement" | "contract"; errors?: Record<string, string>; report: (next: LayoutFormState) => void }) {
  const [value, setValue] = useState(initial);
  const change = (next: LayoutFormState) => {
    report(next);
    setValue(next);
  };
  return createElement(LayoutFields, { value, onChange: change, document: kind, errors });
}

const mount = (initial: LayoutFormState = AGREEMENT, kind: "agreement" | "contract" = "agreement", errors?: Record<string, string>) => {
  seen.value = initial;
  return act(async () => root.render(createElement(Harness, { initial, document: kind, errors, report: (next) => void (seen.value = next) })));
};
const rows = () => [...container.querySelectorAll<HTMLElement>('section[aria-label="Layout"] > ol > li')];
const buttons = (scope: ParentNode = container) => [...scope.querySelectorAll<HTMLButtonElement>("button")];
const named = (scope: ParentNode, name: string) => buttons(scope).find((button) => button.getAttribute("aria-label") === name || button.textContent === name);
const press = (button: HTMLButtonElement | undefined) => act(async () => void button!.click());
const keys = (state: LayoutFormState) => state.layout.map((row) => (row.kind === "section" ? row.key : `${row.type}:${row.text}`));
const setField = (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) =>
  act(async () => {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
const field = <T extends HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;

describe("the block editor's regions", () => {
  test("C5540: the document options come first (Title, Show the number, customer and site lines, Letterhead on every page, Footer), then the layout rows", () => {
    const html = renderToStaticMarkup(createElement(LayoutFields, { value: AGREEMENT, onChange: vi.fn(), document: "agreement" }));
    const order = [
      html.indexOf('aria-label="Document options"'),
      html.search(/<label[^>]*for="doc-title"[^>]*>Title</),
      html.indexOf("Show the number, customer and site lines"),
      html.indexOf("Letterhead on every page"),
      html.search(/<label[^>]*for="doc-footer"[^>]*>Footer</),
      html.indexOf('aria-label="Layout"'),
    ];
    expect(order.every((index) => index > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("C5540: a block row shows its type, text, level (a heading), indent and page-break control; a paragraph has no level", async () => {
    await mount();
    const [heading, paragraph] = rows();
    for (const part of ["-type", "-level", "-indent", "-text", "-break"]) expect(heading.querySelector(`[id$="${part}"]`), `heading ${part}`).not.toBeNull();
    for (const part of ["-type", "-indent", "-text", "-break"]) expect(paragraph.querySelector(`[id$="${part}"]`), `paragraph ${part}`).not.toBeNull();
    expect(paragraph.querySelector('[id$="-level"]')).toBeNull();
    expect(heading.textContent).toContain("1. Heading");
    expect(heading.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("About this agreement");
    expect(heading.textContent).toContain("Start a new page before this");
  });

  test("C5540: each section row shows its name and its own options", async () => {
    await mount();
    const [, , price, schedule, included, equipment, terms] = rows();
    expect(price.textContent).toContain("3. Price table");
    for (const label of ["Title", "Description column", "Visits column", "Per visit column", "Per year column", "Total row", "Visits format"]) expect(price.textContent, label).toContain(label);
    expect(schedule.textContent).toContain("4. Visit schedule");
    expect(schedule.querySelector("#layout-3-title")).not.toBeNull();
    expect(included.textContent).toContain("5. Service included");
    expect(included.textContent).toContain("Show the frequency in each heading");
    expect(included.textContent).toContain("Capital letters in each heading");
    expect(equipment.textContent).toContain("6. Equipment");
    expect(equipment.querySelector("#layout-5-title")).not.toBeNull();
    expect(terms.textContent).toContain("7. Terms");
  });

  test("C5540: a contract's signatures row shows the customer label, contractor label, caption and the name field switch", async () => {
    await mount(CONTRACT, "contract");
    const signatures = rows()[2];
    for (const label of ["Customer label", "Contractor label", "Caption", "Name and title line"]) expect(signatures.textContent, label).toContain(label);
  });
});

describe("adding, moving, removing, hiding and showing", () => {
  test("C5541: Add block offers exactly Heading, Paragraph and Clause and appends an empty row of the chosen type at the end", async () => {
    await mount();
    const group = container.querySelector<HTMLElement>('[role="group"][aria-label="Add block"]')!;
    expect(buttons(group).map((button) => button.textContent)).toEqual(["Heading", "Paragraph", "Clause"]);
    const before = seen.value.layout.length;
    await press(named(group, "Clause"));
    expect(seen.value.layout).toHaveLength(before + 1);
    expect(seen.value.layout.at(-1)).toMatchObject({ kind: "block", type: "clause", text: "" });
    await press(named(group, "Heading"));
    expect(seen.value.layout.at(-1)).toMatchObject({ kind: "block", type: "heading", text: "" });
    await press(named(group, "Paragraph"));
    expect(seen.value.layout.at(-1)).toMatchObject({ kind: "block", type: "paragraph", text: "" });
    expect(rows()).toHaveLength(before + 3);
  });

  test("C5542: Up and Down swap a row with its neighbour, the first row's Up and the last row's Down are disabled, and the saved layout has that order", async () => {
    await mount();
    const count = rows().length;
    expect(named(rows()[0], "Up")!.disabled).toBe(true);
    expect(named(rows()[0], "Down")!.disabled).toBe(false);
    expect(named(rows()[count - 1], "Down")!.disabled).toBe(true);
    expect(named(rows()[count - 1], "Up")!.disabled).toBe(false);
    await press(named(rows()[3], "Down"));
    expect(keys(seen.value)).toEqual(["heading:About this agreement", "paragraph:Welcome.", "price", "included", "schedule", "equipment", "terms"]);
    await press(named(rows()[2], "Up"));
    expect(keys(seen.value).slice(0, 3)).toEqual(["heading:About this agreement", "price", "paragraph:Welcome."]);
    expect(layoutFromRows(seen.value.layout).map((item) => (item.kind === "section" ? item.key : item.text))).toEqual(["About this agreement", "price", "Welcome.", "included", "schedule", "equipment", "terms"]);
    expect(named(rows()[0], "Up")!.disabled).toBe(true);
    expect(named(rows()[count - 1], "Down")!.disabled).toBe(true);
  });

  test("C5543: Remove deletes a block row and Hide removes a hideable section; the price row has neither", async () => {
    await mount();
    expect(named(rows()[0], "Remove")).toBeDefined();
    expect(named(rows()[0], "Hide")).toBeUndefined();
    const price = rows()[2];
    expect(buttons(price).slice(1).map((button) => button.textContent)).toEqual(["Up", "Down"]);
    for (const at of [3, 4, 5, 6]) expect(buttons(rows()[at]).slice(1).map((button) => button.textContent), `row ${at}`).toEqual(["Up", "Down", "Hide"]);
    await press(named(rows()[1], "Remove"));
    expect(keys(seen.value)).not.toContain("paragraph:Welcome.");
    await press(named(container, "Hide Visit schedule"));
    expect(keys(seen.value)).toEqual(["heading:About this agreement", "price", "included", "equipment", "terms"]);
  });

  test("C5543: in a contract the signatures row has no Remove and no Hide either", async () => {
    await mount(CONTRACT, "contract");
    expect(buttons(rows()[2]).slice(1).map((button) => button.textContent)).toEqual(["Up", "Down"]);
    expect(buttons(rows()[0]).slice(1).map((button) => button.textContent)).toEqual(["Up", "Down"]);
    expect(buttons(rows()[1]).slice(1).map((button) => button.textContent)).toEqual(["Up", "Down", "Remove"]);
  });

  test("C5544: showing a hidden section appends it at the end of the layout", async () => {
    await mount();
    await press(named(container, "Hide Visit schedule"));
    await press(named(container, "Hide Terms"));
    const hidden = container.querySelector('section[aria-label="Hidden sections"]')!;
    expect(hidden.textContent).toContain("Visit schedule");
    expect(hidden.textContent).toContain("Terms");
    await press(named(hidden, "Show Visit schedule"));
    expect(keys(seen.value).at(-1)).toBe("schedule");
    await press(named(container, "Show Terms"));
    expect(keys(seen.value).slice(-2)).toEqual(["schedule", "terms"]);
    expect(container.querySelector('section[aria-label="Hidden sections"]')).toBeNull();
  });

  test("C5544: a contract with no hidden sections offers none to show, and agreement terms cannot be shown in a contract", async () => {
    await mount(CONTRACT, "contract");
    const hidden = container.querySelector('section[aria-label="Hidden sections"]')!;
    expect(hidden.textContent).toContain("Visit schedule");
    expect(hidden.textContent).toContain("Service included");
    expect(hidden.textContent).not.toContain("Terms");
    expect(hidden.textContent).not.toContain("Price table");
    expect(hidden.textContent).not.toContain("Signatures");
  });
});

describe("the Insert variable control", () => {
  test("C5545: it lists exactly the sixteen whitelisted names", async () => {
    await mount();
    for (const row of rows().slice(0, 2)) {
      const options = [...row.querySelectorAll<HTMLOptionElement>('select[id$="-variable"] option')].map((option) => option.value).filter((value) => value !== "");
      expect(options).toEqual(SIXTEEN);
    }
    expect(rows()[2].querySelector('select[id$="-variable"]')).toBeNull();
  });

  test("C5545: choosing a name inserts {{name}} at the cursor of its row's text and leaves the rest and the other rows unchanged", async () => {
    await mount();
    const text = field<HTMLTextAreaElement>("layout-1-text");
    text.setSelectionRange(3, 3);
    await setField(field<HTMLSelectElement>("layout-1-variable"), "customer.name");
    expect(seen.value.layout[1]).toMatchObject({ text: "Wel{{customer.name}}come." });
    expect(seen.value.layout[0]).toMatchObject({ text: "About this agreement" });
    expect(field<HTMLSelectElement>("layout-1-variable").value).toBe("");
  });

  test("C5545: a selection is replaced by the variable, and a cursor past the end puts it at the end", async () => {
    await mount();
    field<HTMLTextAreaElement>("layout-1-text").setSelectionRange(0, 4);
    await setField(field<HTMLSelectElement>("layout-1-variable"), "province");
    expect(seen.value.layout[1]).toMatchObject({ text: "{{province}}ome." });
    field<HTMLTextAreaElement>("layout-0-text").setSelectionRange(20, 20);
    await setField(field<HTMLSelectElement>("layout-0-variable"), "site.name");
    expect(seen.value.layout[0]).toMatchObject({ text: "About this agreement{{site.name}}" });
  });
});

describe("the section options", () => {
  const row = (at: number) => seen.value.layout[at] as Extract<LayoutRow, { kind: "section" }>;
  const body = () => layoutFromRows(seen.value.layout);

  test("C5546: the price row's title, five column labels and visits format are in the layout the preview sends", async () => {
    await mount();
    await setField(field("layout-2-title"), "PREVENTIVE MAINTENANCE SERVICE CHARGE");
    const labels = { description: "PREVENTATIVE MAINTENANCE", visits: "NUMBER OF TIMES PER YEAR", perVisit: "COST PER VISIT", perYear: "TOTAL COST PER YEAR", total: "TOTAL" };
    for (const [key, label] of Object.entries(labels)) await setField(field(`layout-2-column-${key}`), label);
    await setField(field("layout-2-visits-format"), "times_per_year");
    expect(row(2)).toMatchObject({ title: "PREVENTIVE MAINTENANCE SERVICE CHARGE", columns: labels, visitsFormat: "times_per_year" });
    expect(body()[2]).toEqual({ kind: "section", key: "price", options: { title: "PREVENTIVE MAINTENANCE SERVICE CHARGE", columns: labels, visitsFormat: "times_per_year" } });
  });

  test("C5546: included takes a title, show frequency and capitals; equipment and schedule take a title", async () => {
    await mount();
    await setField(field("layout-4-title"), "Service included:");
    await act(async () => void field<HTMLInputElement>("layout-4-frequency").click());
    await act(async () => void field<HTMLInputElement>("layout-4-uppercase").click());
    await setField(field("layout-5-title"), "EQUIPMENT LIST");
    await setField(field("layout-3-title"), "Visits");
    expect(body()[4]).toEqual({ kind: "section", key: "included", options: { title: "Service included:", showFrequency: true, uppercase: true } });
    expect(body()[5]).toEqual({ kind: "section", key: "equipment", options: { title: "EQUIPMENT LIST" } });
    expect(body()[3]).toEqual({ kind: "section", key: "schedule", options: { title: "Visits" } });
  });

  test("C5546: signatures takes a customer label, contractor label, caption and the name field", async () => {
    await mount(CONTRACT, "contract");
    await setField(field("layout-2-customer-label"), "Client");
    await setField(field("layout-2-contractor-label"), "For and on behalf of {{tenant.legalName}}");
    await setField(field("layout-2-caption"), "Signed electronically");
    await act(async () => void field<HTMLInputElement>("layout-2-name-field").click());
    expect(body()[2]).toEqual({
      kind: "section",
      key: "signatures",
      options: { customerLabel: "Client", contractorLabel: "For and on behalf of {{tenant.legalName}}", caption: "Signed electronically", nameField: true },
    });
  });

  test("C5546: a block's level, indent and page break are in the layout, and the defaults are not stored", async () => {
    await mount();
    await setField(field("layout-0-level"), "1");
    await setField(field("layout-1-indent"), "2");
    await act(async () => void field<HTMLInputElement>("layout-1-break").click());
    expect(body()[0]).toEqual({ kind: "block", type: "heading", text: "About this agreement", level: 1 });
    expect(body()[1]).toEqual({ kind: "block", type: "paragraph", text: "Welcome.", indent: 2, pageBreakBefore: true });
  });

  test("C5546: every indent value (0, 1, 2, 3) and both heading levels reach the agreement's layout, and indent 0 and level 2 are not stored", async () => {
    await mount();
    for (const indent of [1, 2, 3, 0]) {
      await setField(field("layout-1-indent"), String(indent));
      expect(body()[1]).toEqual({ kind: "block", type: "paragraph", text: "Welcome.", ...(indent > 0 ? { indent } : {}) });
    }
    for (const level of [1, 2]) {
      await setField(field("layout-0-level"), String(level));
      expect(body()[0]).toEqual({ kind: "block", type: "heading", text: "About this agreement", ...(level === 1 ? { level } : {}) });
    }
  });

  test("C5546: every indent value (0, 1, 2, 3) and both heading levels reach the contract wording's saved body", async () => {
    const form: LayoutFormState = {
      ...CONTRACT,
      layout: rowsFromLayout([
        { kind: "block", type: "heading", text: "Payment" },
        { kind: "block", type: "clause", text: "Pay in {{terms.paymentDays}} days." },
        { kind: "section", key: "price" },
        { kind: "section", key: "signatures" },
      ]),
    };
    await mount(form, "contract");
    const saved = () => {
      const checked = bodyFromContractForm(seen.value);
      if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
      return checked.body.schema === 2 ? checked.body.layout : [];
    };
    for (const indent of [1, 2, 3, 0]) {
      await setField(field("layout-1-indent"), String(indent));
      expect(saved()[1]).toEqual({ kind: "block", type: "clause", text: "Pay in {{terms.paymentDays}} days.", ...(indent > 0 ? { indent } : {}) });
    }
    for (const level of [1, 2]) {
      await setField(field("layout-0-level"), String(level));
      expect(saved()[0]).toEqual({ kind: "block", type: "heading", text: "Payment", ...(level === 1 ? { level } : {}) });
    }
  });

  test("C5546: the document options are changed with the options panel", async () => {
    await mount();
    await setField(field("doc-title"), "Maintenance schedule");
    await act(async () => void field<HTMLInputElement>("doc-meta").click());
    await act(async () => void field<HTMLInputElement>("doc-header").click());
    await setField(field("doc-footer"), "letterhead");
    expect(seen.value.doc).toEqual({ title: "Maintenance schedule", showMeta: false, pageHeader: "every", pageFooter: "letterhead" });
  });
});

describe("a row that fails validation", () => {
  test("C5548: each message sits in its own row, beside the field it is about, and every typed value and row order is kept", async () => {
    const typed: LayoutFormState = { ...AGREEMENT, layout: AGREEMENT.layout.map((row, at) => (at === 1 && row.kind === "block" ? { ...row, text: "Hello {{nope}}." } : row)) };
    const errors = { "layout.1.text": "Item 2 uses an unknown variable: nope.", "layout.2.options.title": "The title of the price section of item 3 is empty.", "layout.4": "Item 5 has an unknown key: x." };
    await mount(typed, "agreement", errors);
    const list = rows();
    expect(list[1].textContent).toContain("Item 2 uses an unknown variable: nope.");
    expect(list[0].textContent).not.toContain("Item 2");
    expect(list[2].textContent).toContain("The title of the price section of item 3 is empty.");
    expect(list[4].textContent).toContain("Item 5 has an unknown key: x.");
    expect(list[3].textContent).not.toContain("Item");
    expect(field("layout-1-text").getAttribute("aria-invalid")).toBe("true");
    expect(field("layout-1-text").getAttribute("aria-describedby")).toBe("layout-1-text-error");
    expect((field("layout-1-text") as HTMLTextAreaElement).value).toBe("Hello {{nope}}.");
    expect(keys(seen.value)).toEqual(keys(typed));
  });

  test("C5554: an unknown variable, an empty text and a missing signatures section in the contract wording show on their rows", async () => {
    const bad: LayoutFormState = {
      ...CONTRACT,
      layout: [CONTRACT.layout[0], { ...(CONTRACT.layout[1] as Extract<LayoutRow, { kind: "block" }>), text: "{{nope}}" }, { ...(CONTRACT.layout[1] as Extract<LayoutRow, { kind: "block" }>), text: "  " }],
    };
    const checked = bodyFromContractForm(bad);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    await mount(bad, "contract", checked.errors);
    const list = rows();
    expect(list[1].textContent).toContain("unknown variable");
    expect(list[2].textContent).toContain("empty");
    expect(container.textContent).toContain("The layout needs the signatures section.");
  });
});

describe("the editor's arrangement and touch targets", () => {
  const editor = () => renderToStaticMarkup(createElement(TemplateEditor, { templateId: null, initial: EMPTY_LAYOUT_FORM, types: [], save: vi.fn() }));

  test("C5550: the container is a column below 1280 px and two equal tracks from xl", () => {
    const container = /^<div class="([^"]*)"/.exec(editor())?.[1] ?? "";
    expect(container).toMatch(/\bflex-col\b/);
    expect(container).toMatch(/\bxl:grid\b/);
    expect(container).toMatch(/\bxl:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  });

  test("C5550: every row button carries min-h-11, and every field in a row is 44px tall below lg", async () => {
    await mount();
    for (const li of rows()) {
      for (const button of buttons(li)) expect(button.className, button.textContent ?? "").toContain("min-h-11");
      for (const input of li.querySelectorAll<HTMLElement>('input:not([type="checkbox"]), select')) expect(input.className, input.id).toMatch(/\bh-11\b/);
      for (const box of li.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) expect(box.closest("label")!.className, box.id).toContain("min-h-11");
    }
    for (const button of buttons(container.querySelector('[role="group"][aria-label="Add block"]')!)) expect(button.className).toContain("min-h-11");
  });

  test("C5550: nothing in the editor is hover-only or a drag handle", async () => {
    await mount();
    const html = container.innerHTML;
    for (const marker of ["draggable", "cursor-grab", "group-hover", "opacity-0", "invisible", "onDrag", "aria-grabbed"]) expect(html, marker).not.toContain(marker);
    expect(html).not.toMatch(/(?<!:)\bhover:(?!bg-)/);
  });
});
