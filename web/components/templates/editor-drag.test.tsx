// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DRAG_TYPE } from "@/domain/templates/editor-model";
import { ContractWordingEditor } from "./contract-wording-editor";
import { AGREEMENT, CONTRACT, click, frameOf, pageItems, withText } from "./editor-test-kit";
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

const mountAgreement = () => act(async () => root.render(createElement(TemplateEditor, { templateId: "t-1", initial: AGREEMENT, types: [], save: vi.fn(async () => ({ status: "idle" as const })) })));
const mountContract = () => act(async () => root.render(createElement(ContractWordingEditor, { initial: CONTRACT, save: vi.fn(async () => ({ status: "saved" as const })) })));

/** A stand-in for the browser's DataTransfer: it keeps what was set and says which types it holds. */
function transfer() {
  const data = new Map<string, string>();
  return {
    setData: (type: string, value: string) => void data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
    get types() {
      return [...data.keys()];
    },
    effectAllowed: "",
  };
}
type Transfer = ReturnType<typeof transfer>;

/** Fires a drag event the way the browser does: it bubbles, can be cancelled, and carries the transfer and the pointer's height. */
const fire = (target: Element | Document, type: string, init: { transfer?: Transfer; clientY?: number; relatedTarget?: Element | null } = {}) =>
  act(async () => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    if (init.transfer) Object.defineProperty(event, "dataTransfer", { value: init.transfer });
    Object.defineProperty(event, "clientY", { value: init.clientY ?? 0 });
    Object.defineProperty(event, "relatedTarget", { value: init.relatedTarget ?? null });
    target.dispatchEvent(event);
  });

// jsdom lays nothing out, so every block's box is 0 high at 0: a pointer at -1 is in its upper half and at 1 in its lower half.
const UPPER = -1;
const LOWER = 1;
const writing = (label: string) => [...container.querySelectorAll('[role="tabpanel"] > button')].find((b) => (b.textContent ?? "").includes(label)) as HTMLElement;
const tab = (name: string) => [...container.querySelectorAll('[role="tab"]')].find((t) => t.textContent === name) as HTMLElement;
const lines = () => [...container.querySelectorAll("[data-drop-line]")];
const lineIn = (index: number) => pageItems(container)[index].querySelector("[data-drop-line]") !== null;
const endZone = () => container.querySelector("[data-drop-end]") as HTMLElement;
const grips = () => [...container.querySelectorAll('button[aria-label="Drag to move"]')] as HTMLElement[];
const texts = () => pageItems(container).map((item) => item.textContent ?? "");
const selectedAt = () => pageItems(container).findIndex((item) => item.querySelector('[aria-current="true"]') !== null);

/** Starts dragging the panel item and returns what it carries. */
async function dragFromPanel(item: HTMLElement) {
  const carried = transfer();
  await fire(item, "dragstart", { transfer: carried });
  return carried;
}

describe("the drop line", () => {
  test("[C43] over the upper half of a block the line is before it, and over the lower half it is before the next block", async () => {
    await mountAgreement();
    const carried = await dragFromPanel(writing("Heading"));
    expect(carried.types).toEqual([DRAG_TYPE]);
    await fire(pageItems(container)[1], "dragover", { transfer: carried, clientY: UPPER });
    expect(lines()).toHaveLength(1);
    expect(lineIn(1)).toBe(true);
    await fire(pageItems(container)[1], "dragover", { transfer: carried, clientY: LOWER });
    expect(lines()).toHaveLength(1);
    expect(lineIn(1)).toBe(false);
    expect(lineIn(2)).toBe(true);
  });

  test("[C43] over the end of the page, or the lower half of the last block, the line is at the end", async () => {
    await mountAgreement();
    const carried = await dragFromPanel(writing("Text"));
    await fire(endZone(), "dragover", { transfer: carried });
    expect(lines()).toHaveLength(1);
    expect(endZone().querySelector("[data-drop-line]")).not.toBeNull();
    await fire(pageItems(container)[6], "dragover", { transfer: carried, clientY: LOWER });
    expect(lines()).toHaveLength(1);
    expect(endZone().querySelector("[data-drop-line]")).not.toBeNull();
  });

  test("[C43] a drag that carries something else shows no line", async () => {
    await mountAgreement();
    await fire(pageItems(container)[1], "dragover", { transfer: transfer(), clientY: UPPER });
    expect(lines()).toHaveLength(0);
  });
});

describe("dropping an element from the panel", () => {
  test("[C44] a Heading dropped before the third block lands there, selected, with its field focused", async () => {
    await mountAgreement();
    const carried = await dragFromPanel(writing("Heading"));
    await fire(pageItems(container)[2], "dragover", { transfer: carried, clientY: UPPER });
    await fire(pageItems(container)[2], "drop", { transfer: carried, clientY: UPPER });
    expect(pageItems(container)).toHaveLength(8);
    expect(frameOf(container, 2).getAttribute("aria-label")).toBe("Heading, selected");
    expect(selectedAt()).toBe(2);
    expect(document.activeElement).toBe(container.querySelector("textarea"));
    expect(lines()).toHaveLength(0);
    // the rows around it kept their places
    expect(texts()[1]).toContain("Prepared for");
    expect(texts()[3]).toContain("Price lines");
  });

  test("[C44] a Clause dropped on the lower half of a block lands after it", async () => {
    await mountAgreement();
    const carried = await dragFromPanel(writing("Clause"));
    await fire(pageItems(container)[0], "drop", { transfer: carried, clientY: LOWER });
    expect(selectedAt()).toBe(1);
    expect(frameOf(container, 1).getAttribute("aria-label")).toBe("Clause, selected");
  });

  test("[C44] a part dropped at the end of the page is added there with its options", async () => {
    await mountContract();
    await click(tab("Document parts"));
    const part = writing("Visit schedule");
    const carried = await dragFromPanel(part);
    await fire(endZone(), "dragover", { transfer: carried });
    await fire(endZone(), "drop", { transfer: carried });
    expect(pageItems(container)).toHaveLength(4);
    expect(texts()[3]).toContain("Visit schedule");
    expect(selectedAt()).toBe(3);
    expect(container.querySelector('section[aria-label="Options"]')).not.toBeNull();
  });
});

describe("what cannot be dropped", () => {
  test("[C45] a part already on the page is not draggable, and the others are", async () => {
    await mountContract();
    await click(tab("Document parts"));
    expect(writing("Price lines").getAttribute("draggable")).toBe("false");
    expect(writing("Signatures").getAttribute("draggable")).toBe("false");
    expect(writing("Visit schedule").getAttribute("draggable")).toBe("true");
    expect(writing("Equipment").getAttribute("draggable")).toBe("true");
  });

  test("[C45] a payload naming a part the page already has changes nothing", async () => {
    await mountAgreement();
    const carried = transfer();
    carried.setData(DRAG_TYPE, JSON.stringify({ kind: "add", choice: { kind: "part", key: "price" } }));
    await fire(pageItems(container)[0], "drop", { transfer: carried, clientY: UPPER });
    expect(pageItems(container)).toHaveLength(7);
  });

  test("[C45] text dragged in from somewhere else, and a payload of another shape, change nothing", async () => {
    await mountAgreement();
    for (const raw of ["hello", '{"kind":"add","choice":{"kind":"block","type":"table"}}', '{"kind":"move","from":99}']) {
      const carried = transfer();
      carried.setData(DRAG_TYPE, raw);
      await fire(pageItems(container)[0], "drop", { transfer: carried, clientY: UPPER });
      expect(pageItems(container), raw).toHaveLength(7);
    }
    expect(container.querySelector("[data-save-state]")?.getAttribute("data-save-state")).toBe("saved");
  });
});

describe("moving a block by its grip", () => {
  test("[C46] the heading dragged to before the fourth block lands before it, selected, and the rest keep their order", async () => {
    await mountAgreement();
    const carried = transfer();
    await fire(grips()[0], "dragstart", { transfer: carried });
    expect(carried.getData(DRAG_TYPE)).toBe('{"kind":"move","from":0}');
    await fire(pageItems(container)[3], "dragover", { transfer: carried, clientY: UPPER });
    await fire(pageItems(container)[3], "drop", { transfer: carried, clientY: UPPER });
    const after = texts();
    expect(after[0]).toContain("Prepared for");
    expect(after[1]).toContain("Price lines");
    expect(after[2]).toContain("About this agreement");
    expect(after[3]).toContain("Visit schedule");
    expect(selectedAt()).toBe(2);
    expect(pageItems(container)).toHaveLength(7);
  });

  test("[C46] the last part dragged to the top goes first", async () => {
    await mountAgreement();
    const carried = transfer();
    await fire(grips()[6], "dragstart", { transfer: carried });
    await fire(pageItems(container)[0], "drop", { transfer: carried, clientY: UPPER });
    expect(texts()[0]).toContain("Terms");
    expect(selectedAt()).toBe(0);
  });

  test("[C46] a drop on the line just before or after the block itself changes nothing", async () => {
    await mountAgreement();
    for (const clientY of [UPPER, LOWER]) {
      const carried = transfer();
      await fire(grips()[1], "dragstart", { transfer: carried });
      await fire(pageItems(container)[1], "drop", { transfer: carried, clientY });
    }
    expect(texts()[1]).toContain("Prepared for");
    expect(container.querySelector("[data-save-state]")?.getAttribute("data-save-state")).toBe("saved");
  });

  test("[C46] the block being dragged is dimmed until the drag ends", async () => {
    await mountAgreement();
    const carried = transfer();
    await fire(grips()[2], "dragstart", { transfer: carried });
    expect(pageItems(container)[2].className).toContain("opacity-50");
    await fire(document, "dragend");
    expect(pageItems(container)[2].className).not.toContain("opacity-50");
  });
});

describe("a drag that does not end in a drop", () => {
  test("[C47] when the drag ends without a drop the line goes and nothing changes", async () => {
    await mountAgreement();
    const carried = await dragFromPanel(writing("Heading"));
    await fire(pageItems(container)[2], "dragover", { transfer: carried, clientY: UPPER });
    expect(lines()).toHaveLength(1);
    await fire(document, "dragend");
    expect(lines()).toHaveLength(0);
    expect(pageItems(container)).toHaveLength(7);
  });

  test("[C47] when the pointer leaves the page the line goes", async () => {
    await mountAgreement();
    const carried = await dragFromPanel(writing("Heading"));
    await fire(pageItems(container)[2], "dragover", { transfer: carried, clientY: UPPER });
    await fire(container.querySelector('article[aria-label="Document page"]')!, "dragleave", { relatedTarget: document.body });
    expect(lines()).toHaveLength(0);
    expect(pageItems(container)).toHaveLength(7);
  });

  test("[C47] moving between two blocks of the page keeps the line", async () => {
    await mountAgreement();
    const carried = await dragFromPanel(writing("Heading"));
    await fire(pageItems(container)[2], "dragover", { transfer: carried, clientY: UPPER });
    await fire(container.querySelector('article[aria-label="Document page"]')!, "dragleave", { relatedTarget: pageItems(container)[3] });
    expect(lines()).toHaveLength(1);
  });
});

describe("without dragging", () => {
  test("[C48] clicking an item adds it and Up and Down move a block, with no drag event fired", async () => {
    await mountAgreement();
    await click(writing("Heading"));
    expect(pageItems(container)).toHaveLength(8);
    await click(container.querySelector('[aria-label="Move up"]'));
    expect(selectedAt()).toBe(6);
    await click(withText(container, "button", "Add") ?? null);
    expect(lines()).toHaveLength(0);
  });

  test("[C48] every block has one grip named Drag to move, with the 44px class below desktop", async () => {
    await mountAgreement();
    expect(grips()).toHaveLength(7);
    for (const grip of grips()) {
      expect(grip.className).toContain("min-h-11");
      expect(grip.className).toContain("min-w-11");
      expect(grip.getAttribute("draggable")).toBe("true");
    }
  });
});
