// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MAX_PRESET_LINES } from "@/domain/agreement/template";
import { EMPTY_PRESET_LINE } from "@/domain/agreement/template-form";
import { ContractWordingEditor } from "./contract-wording-editor";
import { AGREEMENT, CONTRACT, click, pageItems, selectItem, setValue, withText } from "./editor-test-kit";
import { TemplateEditor } from "./template-editor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const save = vi.fn(async () => ({ status: "idle" as const }));
const mountAgreement = (initial = AGREEMENT) => act(async () => root.render(createElement(TemplateEditor, { templateId: "t-1", initial, types: [{ code: "RTU", name: "Rooftop units" }], save })));
const mountContract = () => act(async () => root.render(createElement(ContractWordingEditor, { initial: CONTRACT, save: vi.fn(async () => ({ status: "saved" as const })) })));
const optionsCard = () => container.querySelector('section[aria-label="Options"]') as HTMLElement | null;
/** The labels of the fields in the options card: its <label> elements and fieldset legends. */
const labelText = (label: Element) => (label.querySelector("span > span") ?? label).textContent?.trim() ?? "";
const fields = () => [...(optionsCard()?.querySelectorAll("label, legend") ?? [])].map(labelText);

describe("the options of a selected part", () => {
  test("[C18] the price table shows its title, the five column labels and the visits format, and nothing from another part", async () => {
    await mountAgreement();
    await selectItem(container, 2);
    expect(fields()).toEqual(expect.arrayContaining(["Title", "Description column", "Visits column", "Per visit column", "Per year column", "Total row", "Visits format"]));
    expect(fields()).not.toContain("Customer label");
    expect(fields()).not.toContain("Show the frequency in each heading");
  });

  test("[C18] Service included shows its title, show frequency and uppercase", async () => {
    await mountAgreement();
    await selectItem(container, 4);
    expect(fields()).toEqual(["Title", "Show the frequency in each heading", "Capital letters in each heading"]);
  });

  test("[C18] the visit schedule and the equipment show a title only", async () => {
    await mountAgreement();
    for (const index of [3, 5]) {
      await selectItem(container, index);
      expect(fields()).toEqual(["Title"]);
    }
  });

  test("[C18] the terms have no options and say so", async () => {
    await mountAgreement();
    await selectItem(container, 6);
    expect(fields()).toEqual([]);
    expect(optionsCard()?.textContent).toContain("It has no options.");
  });

  test("[C18] the signatures show the customer label, the contractor label, the caption and the name line", async () => {
    await mountContract();
    await selectItem(container, 2);
    expect(fields()).toEqual(["Customer label", "Contractor label", "Caption", "Name and title line"]);
  });

  test("[C18] a text block shows no options card, and a column label typed in the card reaches the page", async () => {
    await mountAgreement();
    await selectItem(container, 1);
    expect(optionsCard()).toBeNull();
    await selectItem(container, 2);
    await setValue(container.querySelector("#layout-2-column-perYear") as HTMLInputElement, "Annual cost");
    await selectItem(container, 3);
    expect(pageItems(container)[2].textContent).toContain("Annual cost");
  });
});

describe("the preset lines", () => {
  test("[C19] the agreement's price part shows its preset lines with their fields, Add line and Remove", async () => {
    await mountAgreement();
    await selectItem(container, 2);
    expect(withText(container, "button", "Add line")).toBeDefined();
    await click(withText(container, "button", "Add line"));
    const card = optionsCard()!;
    expect(card.textContent).toContain("Line 1 description");
    expect(card.textContent).toContain("Price per visit");
    expect(card.textContent).toContain("Visit months");
    expect(card.textContent).toContain("Rooftop units");
    await setValue(card.querySelector("#line-0-description") as HTMLInputElement, "Quarterly HVAC visit");
    await setValue(card.querySelector("#line-0-price") as HTMLInputElement, "$450.00");
    expect(pageItems(container)[2].textContent).toContain("Quarterly HVAC visit");
    expect(pageItems(container)[2].textContent).toContain("$450.00");
    await click(withText(card, "button", "Remove line 1"));
    expect(card.querySelector("#line-0-description")).toBeNull();
  });

  test("[C19] Add line is refused at the limit", async () => {
    const full = { ...AGREEMENT, lines: Array.from({ length: MAX_PRESET_LINES }, () => ({ ...EMPTY_PRESET_LINE, description: "x" })) };
    await mountAgreement(full);
    await selectItem(container, 2);
    expect((withText(container, "button", "Add line") as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain(`A template can have at most ${MAX_PRESET_LINES} lines.`);
  });

  test("[C19] the contract's price part has no preset lines", async () => {
    await mountContract();
    await selectItem(container, 0);
    expect(withText(container, "button", "Add line")).toBeUndefined();
  });
});

describe("page settings and details", () => {
  test("[C21] Page settings offers the number lines, the letterhead and the footer, and nothing else", async () => {
    await mountAgreement();
    await click(withText(container, "button", "Page settings"));
    const card = container.querySelector('section[aria-label="Page settings"]') as HTMLElement;
    expect([...card.querySelectorAll("label")].map(labelText)).toEqual(
      expect.arrayContaining(["Show the number, customer and site lines", "Letterhead on every page", "Footer"]),
    );
    expect(card.querySelectorAll('input[role="switch"]')).toHaveLength(2);
    expect(card.querySelectorAll("select")).toHaveLength(1);
    expect(card.querySelectorAll("input:not([role='switch'])")).toHaveLength(0);
    expect(card.querySelectorAll("textarea")).toHaveLength(0);
  });

  test("[C21] Escape closes the Page settings", async () => {
    await mountAgreement();
    await click(withText(container, "button", "Page settings"));
    expect(container.querySelector('section[aria-label="Page settings"]')).not.toBeNull();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('section[aria-label="Page settings"]')).toBeNull();
  });

  test("[C21] a switch changes only its own option", async () => {
    await mountAgreement();
    await click(withText(container, "button", "Page settings"));
    const meta = container.querySelector("#page-meta") as HTMLInputElement;
    expect(meta.checked).toBe(true);
    await click(meta);
    expect((container.querySelector("#page-meta") as HTMLInputElement).checked).toBe(false);
    expect((container.querySelector("#page-header") as HTMLInputElement).checked).toBe(false);
    expect((container.querySelector("#page-footer") as HTMLSelectElement).value).toBe("number");
  });

  test("[C22] the header name changes the name, and Details holds the description and the term length", async () => {
    await mountAgreement();
    await setValue(container.querySelector("#template-name") as HTMLInputElement, "Annual boiler");
    expect((container.querySelector("#template-name") as HTMLInputElement).value).toBe("Annual boiler");
    await click(withText(container, "button", "Details"));
    const card = container.querySelector('section[aria-label="Details"]') as HTMLElement;
    expect(card.querySelector("#template-description")).not.toBeNull();
    expect((card.querySelector("#template-term") as HTMLInputElement).value).toBe("12");
    await setValue(card.querySelector("#template-description") as HTMLTextAreaElement, "Boilers once a year");
    await setValue(card.querySelector("#template-term") as HTMLInputElement, "24");
    expect((container.querySelector("#template-name") as HTMLInputElement).value).toBe("Annual boiler");
    expect((container.querySelector("#template-term") as HTMLInputElement).value).toBe("24");
  });

  test("[C22] the contract editor has no Details and no name field", async () => {
    await mountContract();
    expect(withText(container, "button", "Details")).toBeUndefined();
    expect(container.querySelector("#template-name")).toBeNull();
    expect(withText(container, "button", "Page settings")).toBeDefined();
  });
});
