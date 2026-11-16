// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementLayoutForm } from "@/domain/agreement/template-form";
import { VARIABLE_LABELS } from "@/domain/templates/editor-model";
import { ContractWordingEditor } from "./contract-wording-editor";
import { AGREEMENT, CONTRACT, click, frameOf, pageItems, selectItem, setValue, toolbar, withText } from "./editor-test-kit";
import { SAVE_MESSAGES, WORDING_MESSAGES, type SaveContractWordingState, type SaveTemplateState } from "./state";
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

const saveAgreement = vi.fn<(id: string | null, form: AgreementLayoutForm) => Promise<SaveTemplateState>>(async () => ({ status: "idle" }));
const saveContract = vi.fn<(form: typeof CONTRACT) => Promise<SaveContractWordingState>>(async () => ({ status: "saved" }));
const mountAgreement = () => act(async () => root.render(createElement(TemplateEditor, { templateId: "t-1", initial: AGREEMENT, types: [], save: saveAgreement })));
const mountContract = () => act(async () => root.render(createElement(ContractWordingEditor, { initial: CONTRACT, save: saveContract })));
const submit = () => act(async () => container.querySelector("form")!.requestSubmit());
const items = () => pageItems(container).map((item) => item.textContent ?? "");
const state = () => container.querySelector("[data-save-state]")?.getAttribute("data-save-state");
const panelButton = (label: string) => [...container.querySelectorAll('[role="toolbar"][aria-label="Add element"] button')].find((b) => (b.textContent ?? "").includes(label)) as HTMLElement;
const openFields = () => click(panelButton("Field"));

beforeEach(() => {
  saveAgreement.mockClear();
  saveContract.mockClear();
});

describe("adding from the panel", () => {
  test("[C14] with a block selected the new block goes right after it and becomes the selected one", async () => {
    await mountAgreement();
    await selectItem(container, 0);
    await click(panelButton("Clause"));
    expect(items()).toHaveLength(8);
    expect(pageItems(container)[1].querySelector('[aria-current="true"]')).not.toBeNull();
    expect(pageItems(container)[0].querySelector('[aria-current="true"]')).toBeNull();
    expect(pageItems(container)[1].querySelector("textarea")).not.toBeNull();
  });

  test("[C14] with nothing selected it goes at the end, and in the contract before the final signatures", async () => {
    await mountAgreement();
    await click(panelButton("Text"));
    expect(items()).toHaveLength(8);
    expect(pageItems(container)[7].querySelector('[aria-current="true"]')).not.toBeNull();
    await mountContract();
    await click(panelButton("Heading"));
    expect(items()).toHaveLength(4);
    expect(frameOf(container, 2).getAttribute("aria-label")).toBe("Heading, selected");
    expect(items()[3]).toContain("Signatures");
  });

  test("[C14] a part added from Document parts lands on the page with its sample and its options", async () => {
    await mountContract();
    await click(panelButton("Visit schedule"));
    expect(items().some((text) => text.includes("Visit schedule"))).toBe(true);
    expect(container.querySelector('section[aria-label="Options"]')).not.toBeNull();
  });

  test("[C15] a new text block takes focus in its field", async () => {
    await mountAgreement();
    await click(panelButton("Text"));
    const field = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(field).not.toBeNull();
    expect(document.activeElement).toBe(field);
  });

  test("[C16] a field chosen from the Field list puts {{name}} at the caret of the selected text block", async () => {
    await mountAgreement();
    await selectItem(container, 1);
    const field = container.querySelector("textarea") as HTMLTextAreaElement;
    await setValue(field, "Hello , welcome");
    field.setSelectionRange(6, 6);
    await openFields();
    await click([...container.querySelectorAll("button")].find((b) => b.textContent === VARIABLE_LABELS["customer.name"]));
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Hello {{customer.name}}, welcome");
  });

  test("[C16] a chip does nothing while a part is selected", async () => {
    await mountAgreement();
    await selectItem(container, 3);
    await openFields();
    const chip = [...container.querySelectorAll("button")].find((b) => b.textContent === VARIABLE_LABELS["customer.name"]) as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
  });
});

describe("the preview follows the order on the page", () => {
  const sentKinds = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) => (JSON.parse(String((call as [string, RequestInit])[1].body)) as { layout: { kind: string; key?: string; text?: string }[] }).layout.map((row) => row.key ?? row.text));

  test("[C23] a block moved with the Down button is sent to Preview PDF in its new place", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    await mountAgreement();
    await selectItem(container, 0);
    await click(container.querySelector('[aria-label="Move down"]'));
    await click(withText(container, "button", "Preview PDF"));
    const [layout] = sentKinds();
    expect(layout.slice(0, 3)).toEqual(["Prepared for {{customer.name}}.", "About this agreement", "price"]);
  });

  test("[C23] a block dragged to a new place is sent to Preview PDF in that place", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    await mountAgreement();
    const grip = container.querySelectorAll('button[aria-label="Drag to move"]')[0];
    const carried = new Map<string, string>();
    const transfer = { setData: (t: string, v: string) => carried.set(t, v), getData: (t: string) => carried.get(t) ?? "", get types() { return [...carried.keys()]; }, effectAllowed: "" };
    const fire = (target: Element, type: string, clientY = 0) =>
      act(async () => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", { value: transfer });
        Object.defineProperty(event, "clientY", { value: clientY });
        target.dispatchEvent(event);
      });
    await fire(grip, "dragstart");
    await fire(pageItems(container)[2], "drop", -1);
    await click(withText(container, "button", "Preview PDF"));
    const [layout] = sentKinds();
    expect(layout.slice(0, 3)).toEqual(["Prepared for {{customer.name}}.", "About this agreement", "price"]);
  });
});

describe("saving", () => {
  test("[C28] the agreement's Save sends the template id and the form as typed, once", async () => {
    await mountAgreement();
    await setValue(container.querySelector("#template-name") as HTMLInputElement, "Renamed");
    await submit();
    expect(saveAgreement).toHaveBeenCalledTimes(1);
    expect(saveAgreement.mock.calls[0][0]).toBe("t-1");
    expect(saveAgreement.mock.calls[0][1]).toEqual({ ...AGREEMENT, name: "Renamed" });
  });

  test("[C28] the contract's Save sends the form, shows its saved line and the editor stays open", async () => {
    await mountContract();
    await submit();
    expect(saveContract).toHaveBeenCalledTimes(1);
    expect(saveContract).toHaveBeenCalledWith(CONTRACT);
    expect(container.textContent).toContain(WORDING_MESSAGES.saved);
    expect(container.querySelector('article[aria-label="Document page"]')).not.toBeNull();
  });

  test("[C29] the header reads Saved until the form differs, then Unsaved changes, and Saved again after the contract is saved", async () => {
    await mountContract();
    expect(state()).toBe("saved");
    expect(container.textContent).toContain("Saved");
    await selectItem(container, 1);
    await setValue(container.querySelector("textarea") as HTMLTextAreaElement, "Changed clause.");
    expect(state()).toBe("unsaved");
    expect(container.textContent).toContain("Unsaved changes");
    await submit();
    expect(state()).toBe("saved");
  });

  test("[C29] editing the agreement makes it Unsaved changes, and putting the text back makes it Saved", async () => {
    await mountAgreement();
    expect(state()).toBe("saved");
    await setValue(container.querySelector("#document-title") as HTMLInputElement, "Other");
    expect(state()).toBe("unsaved");
    await setValue(container.querySelector("#document-title") as HTMLInputElement, AGREEMENT.doc.title);
    expect(state()).toBe("saved");
  });

  test("[C30] a refused save keeps what was typed, shows the message on its block and selects the first block with an error", async () => {
    saveAgreement.mockResolvedValueOnce({ status: "invalid", errors: { "layout.4.options.title": "That title is too long.", "layout.1.text": "This text is not allowed." }, values: AGREEMENT });
    await mountAgreement();
    await setValue(container.querySelector("#template-name") as HTMLInputElement, "Kept name");
    await submit();
    expect(container.textContent).toContain("Fix the highlighted fields, then save again. Nothing you typed is lost.");
    expect((container.querySelector("#template-name") as HTMLInputElement).value).toBe("Kept name");
    expect(pageItems(container)[1].querySelector('[aria-current="true"]')).not.toBeNull();
    expect(pageItems(container)[1].textContent).toContain("This text is not allowed.");
    expect(pageItems(container)[4].textContent).toContain("That title is too long.");
    expect(frameOf(container, 4).className).toContain("border-danger");
  });

  test("[C30] a refused contract save also keeps the form and selects the first block with an error", async () => {
    saveContract.mockResolvedValueOnce({ status: "invalid", errors: { "layout.1.text": "Not allowed." }, values: CONTRACT });
    await mountContract();
    await submit();
    expect(pageItems(container)[1].querySelector('[aria-current="true"]')).not.toBeNull();
    expect(pageItems(container)[1].textContent).toContain("Not allowed.");
    expect(toolbar(container)).toContain("Delete");
  });

  test.each(["forbidden", "not_found", "unavailable"] as const)("[C31] the agreement's %s answer shows its message", async (status) => {
    saveAgreement.mockResolvedValueOnce({ status });
    await mountAgreement();
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(SAVE_MESSAGES[status]);
  });

  test.each(["forbidden", "not_found", "unavailable"] as const)("[C31] the contract's %s answer shows its message", async (status) => {
    saveContract.mockResolvedValueOnce({ status });
    await mountContract();
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(WORDING_MESSAGES[status]);
  });
});

describe("one editor", () => {
  test("[C32] the agreement and the contract are the same editor: the same panel, page and header controls, with the parts of their own document", async () => {
    const shape = () => ({
      panel: container.querySelector('[role="toolbar"][aria-label="Add element"]') !== null,
      page: container.querySelector('article[aria-label="Document page"]') !== null,
      buttons: ["Preview PDF", "Page settings"].map((label) => withText(container, "button", label) !== undefined),
    });
    await mountAgreement();
    const agreement = shape();
    expect(container.querySelector("article")?.getAttribute("data-editor-document")).toBe("agreement");
    expect(container.textContent).toContain("Terms");
    expect(container.textContent).not.toContain("Signatures");
    await mountContract();
    const contract = shape();
    expect(container.querySelector("article")?.getAttribute("data-editor-document")).toBe("contract");
    expect(container.textContent).toContain("Signatures");
    expect(agreement).toEqual(contract);
    expect(agreement).toEqual({ panel: true, page: true, buttons: [true, true] });
  });
});
