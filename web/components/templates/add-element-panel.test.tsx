// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ItemWordsProvider } from "@/components/shell/item-words";
import { newBlockRow, newSectionRow, type LayoutRow } from "@/domain/agreement/layout-form";
import { TEMPLATE_VARIABLES } from "@/domain/contract/template";
import { VARIABLE_LABELS, type EditorDocument } from "@/domain/templates/editor-model";
import { AddElementPanel } from "./add-element-panel";
import { click, withText } from "./editor-test-kit";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const onAdd = vi.fn();
const onVariable = vi.fn();
const mount = (document: EditorDocument, rows: LayoutRow[] = [], canInsertVariable = true, words = { singular: "equipment", plural: "equipment", Singular: "Equipment", Plural: "Equipment" }) =>
  act(async () => root.render(createElement(ItemWordsProvider, { words } as ComponentProps<typeof ItemWordsProvider>, createElement(AddElementPanel, { document, rows, onAdd, onVariable, canInsertVariable }))));
const tab = (name: string) => [...container.querySelectorAll('[role="tab"]')].find((t) => t.textContent === name) as HTMLElement;
const items = () => [...container.querySelectorAll('[role="tabpanel"] > button')].map((b) => b.querySelector("span.flex-1")?.textContent ?? (b.textContent ?? "").slice(1));

beforeEach(() => {
  onAdd.mockClear();
  onVariable.mockClear();
});

describe("the panel", () => {
  test("[C11] two tabs, Writing with Heading, Text and Clause, and Document parts", async () => {
    await mount("agreement");
    expect([...container.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(["Writing", "Document parts"]);
    expect(tab("Writing").getAttribute("aria-selected")).toBe("true");
    expect(items()).toHaveLength(3);
    const names = [...container.querySelectorAll('[role="tabpanel"] > button')].map((b) => b.textContent ?? "");
    expect(names[0]).toContain("Heading");
    expect(names[1]).toContain("Text");
    expect(names[2]).toContain("Clause");
  });

  test("[C11] choosing a writing item asks for a block of that type", async () => {
    await mount("agreement");
    for (const [label, type] of [["Heading", "heading"], ["Text", "paragraph"], ["Clause", "clause"]] as const) {
      await click([...container.querySelectorAll('[role="tabpanel"] > button')].find((b) => (b.textContent ?? "").includes(label)));
      expect(onAdd).toHaveBeenLastCalledWith({ kind: "block", type });
    }
  });

  test("[C12] the agreement's parts, in order, and the contract's", async () => {
    await mount("agreement");
    await click(tab("Document parts"));
    expect(items()).toEqual(["Price lines", "Visit schedule", "Service included", "Equipment", "Terms"]);
    await mount("contract");
    await click(tab("Document parts"));
    expect(items()).toEqual(["Price lines", "Visit schedule", "Service included", "Equipment", "Signatures"]);
  });

  test("[C12] the equipment part takes the org's own word", async () => {
    await mount("agreement", [], true, { singular: "station", plural: "stations", Singular: "Station", Plural: "Stations" });
    await click(tab("Document parts"));
    expect(items()).toContain("Stations");
    expect(items()).not.toContain("Equipment");
  });

  test("[C13] a part on the page reads On page, does nothing when chosen, and becomes addable once it is gone", async () => {
    await mount("agreement", [newSectionRow("price"), newBlockRow("paragraph")]);
    await click(tab("Document parts"));
    const price = withText(container, '[role="tabpanel"] > button', "$Price linesOn page") ?? ([...container.querySelectorAll('[role="tabpanel"] > button')][0] as HTMLElement);
    expect(price.textContent).toContain("On page");
    expect(price.getAttribute("aria-disabled")).toBe("true");
    await click(price);
    expect(onAdd).not.toHaveBeenCalled();
    const schedule = [...container.querySelectorAll('[role="tabpanel"] > button')][1] as HTMLElement;
    expect(schedule.getAttribute("aria-disabled")).toBe("false");
    await click(schedule);
    expect(onAdd).toHaveBeenCalledWith({ kind: "part", key: "schedule" });
    await mount("agreement", [newBlockRow("paragraph")]);
    await click(tab("Document parts"));
    expect([...container.querySelectorAll('[role="tabpanel"] > button')][0].getAttribute("aria-disabled")).toBe("false");
  });

  test("[C13] with every part on the page the tab says so", async () => {
    await mount("agreement", ["price", "schedule", "included", "equipment", "terms"].map((key) => newSectionRow(key as "price")));
    await click(tab("Document parts"));
    expect(container.textContent).toContain("Every part is on the page.");
    await mount("agreement", [newSectionRow("price")]);
    await click(tab("Document parts"));
    expect(container.textContent).not.toContain("Every part is on the page.");
  });

  test("[C16] the Writing tab lists all 16 fields as chips and choosing one reports its name", async () => {
    await mount("agreement");
    const chips = [...container.querySelectorAll("button")].filter((b) => Object.values(VARIABLE_LABELS).includes(b.textContent ?? ""));
    expect(chips).toHaveLength(16);
    for (const name of TEMPLATE_VARIABLES) {
      await click(chips.find((chip) => chip.textContent === VARIABLE_LABELS[name]));
      expect(onVariable).toHaveBeenLastCalledWith(name);
    }
    expect(onVariable).toHaveBeenCalledTimes(16);
  });

  test("[C16] with no text block selected the chips are disabled and the panel says why", async () => {
    await mount("agreement", [], false);
    const chips = [...container.querySelectorAll("button")].filter((b) => Object.values(VARIABLE_LABELS).includes(b.textContent ?? ""));
    expect(chips.every((chip) => (chip as HTMLButtonElement).disabled)).toBe(true);
    expect(container.textContent).toContain("Select a text block to insert a field into it.");
  });
});

describe("the bottom sheet", () => {
  const aside = () => container.querySelector("aside") as HTMLElement;

  test("[C17] below 1024 px an Add button of 44px opens the panel as a bottom sheet, and choosing an item closes it", async () => {
    await mount("agreement");
    const add = withText(container, "button", "Add") as HTMLButtonElement;
    expect(add.className).toContain("h-11");
    expect(add.className).toContain("lg:hidden");
    expect(aside().className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(aside().className).toContain("lg:flex");
    await click(add);
    expect(aside().className).toContain("fixed");
    expect(aside().className).toContain("bottom-0");
    expect(aside().className).not.toMatch(/(^|\s)hidden(\s|$)/);
    await click([...container.querySelectorAll('[role="tabpanel"] > button')][1]);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(aside().className).toMatch(/(^|\s)hidden(\s|$)/);
  });

  test("[C17] the sheet has a Close control and it closes the sheet", async () => {
    await mount("agreement");
    await click(withText(container, "button", "Add"));
    await click(container.querySelector('button[aria-label="Close"]'));
    expect(aside().className).toMatch(/(^|\s)hidden(\s|$)/);
  });
});

describe("touch size", () => {
  test("[C39] every button in the panel carries the 44px class below desktop", async () => {
    await mount("agreement");
    const small = [...container.querySelectorAll("button")].filter((b) => !/(?:^|\s)(?:min-h-11|h-11|size-11)(?:\s|$)/.test(b.className));
    expect(small.map((b) => b.textContent)).toEqual([]);
    await click(tab("Document parts"));
    const smallParts = [...container.querySelectorAll("button")].filter((b) => !/(?:^|\s)(?:min-h-11|h-11|size-11)(?:\s|$)/.test(b.className));
    expect(smallParts.map((b) => b.textContent)).toEqual([]);
  });
});
