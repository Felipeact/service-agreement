// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ItemWordsProvider } from "@/components/shell/item-words";
import { newBlockRow, newSectionRow, type LayoutRow } from "@/domain/agreement/layout-form";
import { TEMPLATE_VARIABLES } from "@/domain/contract/template";
import { VARIABLE_LABELS, type EditorDocument } from "@/domain/templates/editor-model";
import { AddElementDock } from "./add-element-dock";
import { click } from "./editor-test-kit";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  onAdd.mockClear();
  onVariable.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const onAdd = vi.fn();
const onVariable = vi.fn();
const mount = (document: EditorDocument, rows: LayoutRow[] = [], canInsertVariable = true, words = { singular: "equipment", plural: "equipment", Singular: "Equipment", Plural: "Equipment" }) =>
  act(async () => root.render(createElement(ItemWordsProvider, { words } as ComponentProps<typeof ItemWordsProvider>, createElement(AddElementDock, { document, rows, onAdd, onVariable, canInsertVariable }))));
const dock = () => container.querySelector('[role="toolbar"][aria-label="Add element"]') as HTMLElement;
/** The dock's buttons by their label (the glyph above it and the screen-reader note are not part of the label). */
const items = () => [...dock().querySelectorAll("button")];
const labelOf = (button: Element) => (button.textContent ?? "").replace(/^(\{ \}|[^A-Za-z]+|Aa|H|1\.)/, "").replace("On page", "").trim();
const item = (label: string) => items().find((button) => labelOf(button) === label) as HTMLElement;
const FIELD = () => item("Field");
const fieldChips = () => [...container.querySelectorAll('[role="group"][aria-label="Fields"] button')];

describe("the dock", () => {
  test("[C11] a Writing group with Heading, Text and Clause, the parts, then a Field button, in that order", async () => {
    await mount("agreement");
    expect(items().map(labelOf)).toEqual(["Heading", "Text", "Clause", "Price lines", "Visit schedule", "Service included", "Equipment", "Terms", "Field"]);
  });

  test("[C11] choosing a writing item asks for a block of that type", async () => {
    await mount("agreement");
    for (const [label, type] of [["Heading", "heading"], ["Text", "paragraph"], ["Clause", "clause"]] as const) {
      await click(item(label));
      expect(onAdd).toHaveBeenLastCalledWith({ kind: "block", type });
    }
  });

  test("[C12] the agreement's parts in order, and the contract's", async () => {
    await mount("agreement");
    expect(items().map(labelOf).slice(3, 8)).toEqual(["Price lines", "Visit schedule", "Service included", "Equipment", "Terms"]);
    await mount("contract");
    expect(items().map(labelOf).slice(3, 8)).toEqual(["Price lines", "Visit schedule", "Service included", "Equipment", "Signatures"]);
  });

  test("[C12] the equipment part takes the org's own word", async () => {
    await mount("agreement", [], true, { singular: "station", plural: "stations", Singular: "Station", Plural: "Stations" });
    expect(items().map(labelOf)).toContain("Stations");
    expect(items().map(labelOf)).not.toContain("Equipment");
  });

  test("[C13] a part on the page is dimmed, reads On page, does nothing when chosen, and is addable once it is gone", async () => {
    await mount("agreement", [newSectionRow("price"), newBlockRow("paragraph")]);
    const price = item("Price lines");
    expect(price.getAttribute("aria-disabled")).toBe("true");
    expect(price.className).toContain("opacity-40");
    expect(price.textContent).toContain("On page");
    await click(price);
    expect(onAdd).not.toHaveBeenCalled();
    const schedule = item("Visit schedule");
    expect(schedule.getAttribute("aria-disabled")).toBe("false");
    expect(schedule.textContent).not.toContain("On page");
    await click(schedule);
    expect(onAdd).toHaveBeenCalledWith({ kind: "part", key: "schedule" });
    await mount("agreement", [newBlockRow("paragraph")]);
    expect(item("Price lines").getAttribute("aria-disabled")).toBe("false");
  });
});

describe("the Field list", () => {
  test("[C16] it is closed until Field is pressed, then lists all 16 fields above the dock", async () => {
    await mount("agreement");
    expect(fieldChips()).toHaveLength(0);
    expect(FIELD().getAttribute("aria-expanded")).toBe("false");
    await click(FIELD());
    expect(FIELD().getAttribute("aria-expanded")).toBe("true");
    expect(fieldChips().map((chip) => chip.textContent)).toEqual(TEMPLATE_VARIABLES.map((name) => VARIABLE_LABELS[name]));
    expect(fieldChips()).toHaveLength(16);
  });

  test("[C16] choosing a field reports its name and closes the list, for every field", async () => {
    await mount("agreement");
    for (const name of TEMPLATE_VARIABLES) {
      await click(FIELD());
      await click(fieldChips().find((chip) => chip.textContent === VARIABLE_LABELS[name]));
      expect(onVariable).toHaveBeenLastCalledWith(name);
      expect(fieldChips()).toHaveLength(0);
    }
    expect(onVariable).toHaveBeenCalledTimes(16);
  });

  test("[C16] with no text block selected the fields are disabled and the list says why", async () => {
    await mount("agreement", [], false);
    await click(FIELD());
    expect(fieldChips().every((chip) => (chip as HTMLButtonElement).disabled)).toBe(true);
    expect(container.textContent).toContain("Select a text block to insert a field into it.");
  });

  test("[C16] Field pressed again closes the list", async () => {
    await mount("agreement");
    await click(FIELD());
    await click(FIELD());
    expect(fieldChips()).toHaveLength(0);
  });
});

describe("narrow screens and touch", () => {
  test("[C17] the dock scrolls inside itself and never makes the page wider", async () => {
    await mount("agreement");
    expect(dock().className).toContain("overflow-x-auto");
    expect(dock().className).toContain("max-w-full");
    // Its screen-reader notes are absolutely placed; without a positioned dock they would sit outside its clipping and widen the page.
    expect(dock().className).toMatch(/(^|\s)relative(\s|$)/);
    expect(dock().parentElement!.className).toContain("max-w-full");
    expect(dock().parentElement!.className).toContain("sticky");
    expect(dock().parentElement!.className).toContain("bottom-3");
  });

  test("[C17] [C39] every control of the dock carries the 44px class below desktop, with the field list open too", async () => {
    await mount("agreement");
    await click(FIELD());
    const small = [...container.querySelectorAll("button")].filter((b) => !/(?:^|\s)(?:min-h-11|h-11|size-11)(?:\s|$)/.test(b.className));
    expect(small.map((b) => b.textContent)).toEqual([]);
  });
});
