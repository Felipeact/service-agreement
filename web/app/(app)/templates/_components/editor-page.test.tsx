// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { rowsFromLayout } from "@/domain/agreement/layout-form";
import { layoutFormFromBody } from "@/domain/agreement/template-form";
import { ContractWordingEditor } from "./contract-wording-editor";
import { AGREEMENT, CONTRACT, click, frameOf, pageItems, selectItem, setValue, toolbar, withText } from "./editor-test-kit";
import { TemplateEditor } from "./template-editor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
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
const mountAgreement = (initial = AGREEMENT) => act(async () => root.render(createElement(TemplateEditor, { templateId: "t-1", initial, types: [], save, orgName: "Northpoint Mechanical Ltd." })));
const mountContract = () => act(async () => root.render(createElement(ContractWordingEditor, { initial: CONTRACT, save: vi.fn(async () => ({ status: "saved" as const })), orgName: "Northpoint Mechanical Ltd." })));
const texts = () => pageItems(container).map((item) => item.textContent ?? "");

describe("the page", () => {
  test("[C1] the page draws the org's name, the title, then one block per layout row in layout order, each part with its labelled sample", async () => {
    await mountAgreement();
    const page = container.querySelector('article[aria-label="Document page"]')!;
    expect(page.textContent).toContain("Northpoint Mechanical Ltd.");
    expect((container.querySelector("#document-title") as HTMLInputElement).value).toBe("Preventive maintenance service agreement");
    const items = texts();
    expect(items).toHaveLength(7);
    expect(items[0]).toContain("About this agreement");
    expect(items[1]).toContain("Prepared for");
    expect(items[2]).toContain("Price lines");
    expect(items[3]).toContain("Visit schedule");
    expect(items[4]).toContain("Service included");
    expect(items[5]).toContain("Equipment");
    expect(items[6]).toContain("Terms");
    // the title comes before the first block
    expect(page.innerHTML.indexOf('id="document-title"')).toBeLessThan(page.innerHTML.indexOf("About this agreement"));
  });

  test("[C2] a click selects exactly that block, and Enter or Space on a focused frame does the same", async () => {
    await mountAgreement();
    await selectItem(container, 1);
    expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
    expect(pageItems(container)[1].querySelector('[aria-current="true"]')).not.toBeNull();
    // the selected block is outlined in Action Blue; an unselected one is not
    expect(frameOf(container, 1).className).toContain("border-action");
    expect(frameOf(container, 0).className).not.toContain("border-action");
    const frame = frameOf(container, 3);
    await act(async () => frame.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
    expect(pageItems(container)[3].querySelector('[aria-current="true"]')).not.toBeNull();
    await act(async () => frameOf(container, 4).dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })));
    expect(pageItems(container)[4].querySelector('[aria-current="true"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });

  test("[C3] a selected text block's toolbar has Move up, Move down, Delete, both indents and Page break, and Size 1 and 2 for a heading only", async () => {
    await mountAgreement();
    await selectItem(container, 0);
    expect(toolbar(container)).toEqual(["Move up", "Move down", "Indent less", "Indent more", "Page break before", "Size 1", "Size 2", "Align left", "Align center", "Align right", "Bold", "Italic", "Delete"]);
    await selectItem(container, 1);
    expect(toolbar(container)).toEqual(["Move up", "Move down", "Indent less", "Indent more", "Page break before", "Align left", "Align center", "Align right", "Bold", "Italic", "Delete"]);
  });

  test("[C3] a clause's toolbar has the indents and Page break, and no Size", async () => {
    await mountContract();
    await selectItem(container, 1);
    expect(toolbar(container)).toEqual(["Move up", "Move down", "Indent less", "Indent more", "Page break before", "Align left", "Align center", "Align right", "Bold", "Italic", "Delete"]);
  });

  test("[C3] Indent more raises the indent up to 3 and Indent less lowers it, each disabled at its end", async () => {
    await mountAgreement();
    await selectItem(container, 1);
    const button = (label: string) => container.querySelector(`[role="toolbar"] [aria-label="${label}"]`) as HTMLButtonElement;
    expect(button("Indent less").disabled).toBe(true);
    for (let step = 0; step < 3; step += 1) await click(button("Indent more"));
    expect(button("Indent more").disabled).toBe(true);
    expect((container.querySelector("textarea") as HTMLTextAreaElement).style.paddingLeft).toBe("5rem");
    await click(button("Indent less"));
    expect(button("Indent more").disabled).toBe(false);
  });

  test("[C3] the Size and Page break buttons say which is on", async () => {
    await mountAgreement();
    await selectItem(container, 0);
    const button = (label: string) => container.querySelector(`[role="toolbar"] [aria-label="${label}"]`) as HTMLButtonElement;
    expect(button("Size 2").getAttribute("aria-pressed")).toBe("true");
    await click(button("Size 1"));
    expect(button("Size 1").getAttribute("aria-pressed")).toBe("true");
    expect(button("Size 2").getAttribute("aria-pressed")).toBe("false");
    await click(button("Page break before"));
    expect(button("Page break before").getAttribute("aria-pressed")).toBe("true");
    expect(pageItems(container)[0].textContent).toContain("Page break");
  });

  test("[C4] a selected part's toolbar has Move up and Move down, and Delete unless it is required", async () => {
    await mountAgreement();
    await selectItem(container, 3);
    expect(toolbar(container)).toEqual(["Move up", "Move down", "Delete"]);
    await selectItem(container, 2);
    expect(toolbar(container)).toEqual(["Move up", "Move down"]);
  });

  test("[C5] the price table shows Required with no Delete, and still moves", async () => {
    await mountAgreement();
    await selectItem(container, 2);
    expect(pageItems(container)[2].textContent).toContain("Required");
    expect(toolbar(container)).not.toContain("Delete");
    await click(container.querySelector('[aria-label="Move up"]'));
    expect(texts()[1]).toContain("Price lines");
  });

  test("[C5] in the contract both the price table and the signatures are required and neither can be deleted", async () => {
    await mountContract();
    for (const index of [0, 2]) {
      await selectItem(container, index);
      expect(pageItems(container)[index].textContent).toContain("Required");
      expect(toolbar(container)).not.toContain("Delete");
    }
    await selectItem(container, 1);
    expect(toolbar(container)).toContain("Delete");
  });

  test("[C4] the first row cannot move up and the last cannot move down, and a move keeps the block selected where it lands", async () => {
    await mountAgreement();
    await selectItem(container, 0);
    expect((container.querySelector('[aria-label="Move up"]') as HTMLButtonElement).disabled).toBe(true);
    await click(container.querySelector('[aria-label="Move down"]'));
    expect(texts()[1]).toContain("About this agreement");
    expect(pageItems(container)[1].querySelector('[aria-current="true"]')).not.toBeNull();
    await selectItem(container, 6);
    expect((container.querySelector('[aria-label="Move down"]') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("editing in place", () => {
  test("[C7] typing in a selected block changes only that block and makes no request", async () => {
    await mountAgreement();
    const before = texts();
    await selectItem(container, 1);
    await setValue(container.querySelector("textarea") as HTMLTextAreaElement, "A new sentence.");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("A new sentence.");
    await selectItem(container, 6);
    const after = texts();
    expect(after[1]).toContain("A new sentence.");
    for (const index of [0, 2, 3, 4, 5]) expect(after[index]).toBe(before[index]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("[C8] a block not being edited shows each variable as a chip with its label, and while edited shows the raw text", async () => {
    await mountAgreement();
    const chip = pageItems(container)[1].querySelector('[data-variable="customer.name"]');
    expect(chip?.textContent).toBe("Customer name");
    expect(pageItems(container)[1].textContent).not.toContain("{{");
    await selectItem(container, 1);
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Prepared for {{customer.name}}.");
    expect(container.querySelector('[data-variable="customer.name"]')).toBeNull();
  });

  test("[C8] a name that is not on the whitelist stays as typed, flagged, and is not drawn as a known field", async () => {
    const form = layoutFormFromBody({
      schema: 2,
      name: "x",
      description: "",
      doc: AGREEMENT.doc,
      layout: [{ kind: "block", type: "paragraph", text: "Hello {{nonsense}}." }, { kind: "section", key: "price" }],
      preset: { termMonths: 12, lines: [] },
    });
    await mountAgreement(form);
    expect(pageItems(container)[0].textContent).toContain("{{nonsense}}");
    expect(pageItems(container)[0].querySelector("[data-variable]")).toBeNull();
  });

  test("[C9] Delete removes the block and shows Block removed with Undo, which puts it back in place; the next change clears the line", async () => {
    await mountAgreement();
    await selectItem(container, 1);
    await click(container.querySelector('[aria-label="Delete"]'));
    expect(texts()).toHaveLength(6);
    expect(container.textContent).toContain("Block removed.");
    await click(withText(container, "button", "Undo"));
    expect(texts()).toHaveLength(7);
    expect(texts()[1]).toContain("Prepared for");
    expect(container.textContent).not.toContain("Block removed.");
    await selectItem(container, 0);
    await click(container.querySelector('[aria-label="Delete"]'));
    expect(container.textContent).toContain("Block removed.");
    await setValue(container.querySelector("#document-title") as HTMLInputElement, "Changed");
    expect(container.textContent).not.toContain("Block removed.");
  });

  test("[C10] a block with an error is outlined in the danger colour and shows its message under itself", async () => {
    const form = layoutFormFromBody({
      schema: 2,
      name: "x",
      description: "",
      doc: AGREEMENT.doc,
      layout: [{ kind: "block", type: "paragraph", text: "Hello" }, { kind: "block", type: "clause", text: "Uses {{bogus}} here." }, { kind: "section", key: "price" }],
      preset: { termMonths: 12, lines: [] },
    });
    await mountAgreement(form);
    const bad = pageItems(container)[1];
    expect(bad.querySelector('[role="alert"]')?.textContent ?? "").toMatch(/bogus/);
    expect(frameOf(container, 1).className).toContain("border-danger");
    expect(pageItems(container)[0].querySelector('[role="alert"]')).toBeNull();
    expect(frameOf(container, 0).className).not.toContain("border-danger");
  });

  test("[C20] editing the title at the top changes the title and nothing else", async () => {
    await mountAgreement();
    const before = texts();
    await setValue(container.querySelector("#document-title") as HTMLInputElement, "Annual boiler agreement");
    expect((container.querySelector("#document-title") as HTMLInputElement).value).toBe("Annual boiler agreement");
    expect(texts()).toEqual(before);
    expect((container.querySelector("#template-name") as HTMLInputElement).value).toBe("Quarterly service");
  });
});

describe("touch and keyboard", () => {
  const FORTY_FOUR = /(?:^|\s)(?:min-h-11|h-11|size-11)(?:\s|$)/;

  test("[C39] every button on the page and in the header carries the 44px class below desktop", async () => {
    await mountAgreement();
    await selectItem(container, 0);
    const small = [...container.querySelectorAll("button, a")].filter((element) => !FORTY_FOUR.test(element.className) && !/(?:^|\s)(?:min-h-11|h-11)(?:\s|$)/.test(element.className));
    expect(small.map((element) => `${element.tagName} ${element.textContent}`)).toEqual([]);
  });

  test("[C39] the fields and switches of the header popovers carry the 44px class too", async () => {
    await mountAgreement();
    await click(withText(container, "button", "Details"));
    await click(withText(container, "button", "Page settings"));
    const small = [...container.querySelectorAll("section[aria-label] input:not([role='switch']), section[aria-label] select, section[aria-label] textarea")].filter((field) => !/(?:^|\s)(?:min-h-11|h-11)(?:\s|$)/.test(field.className) && !/(?:^|\s)h-11(?:\s|$)/.test(field.className) && field.tagName !== "TEXTAREA");
    expect(small.map((field) => field.id)).toEqual([]);
    const labels = [...container.querySelectorAll('input[role="switch"]')].map((input) => input.closest("label")!.className);
    expect(labels.length).toBe(2);
    for (const label of labels) expect(label).toContain("min-h-11");
  });

  test("[C40] every action has an accessible name, can take focus, and nothing needs a drag", async () => {
    await mountAgreement();
    await selectItem(container, 0);
    const named = (element: Element) =>
      (element.getAttribute("aria-label") ?? "").trim() !== "" || (element.textContent ?? "").trim() !== "" || ((element as HTMLInputElement).labels?.[0]?.textContent ?? "").trim() !== "";
    for (const element of container.querySelectorAll("button, a, input, textarea, select, [role='button']")) {
      expect(named(element), element.outerHTML.slice(0, 120)).toBe(true);
      expect((element as HTMLElement).tabIndex, element.outerHTML.slice(0, 120)).toBeGreaterThanOrEqual(0);
    }
    // Dragging is an extra way, never the only one: whatever can be dragged is a focusable button with its own click path (C48).
    for (const element of container.querySelectorAll('[draggable="true"]')) expect(element.tagName).toBe("BUTTON");
    expect(container.querySelector("[onmouseover], [onmouseenter]")).toBeNull();
  });
});

describe("the layout the rows come from", () => {
  test("[C1] the rows the page draws are the rows of the form, so a form with other rows draws other blocks", async () => {
    const form = { ...AGREEMENT, layout: rowsFromLayout([{ kind: "section", key: "price" }, { kind: "block", type: "paragraph", text: "Only this." }]) };
    await mountAgreement(form);
    expect(texts()).toHaveLength(2);
    expect(texts()[1]).toContain("Only this.");
  });
});
