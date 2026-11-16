// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SYSTEM_CONTRACT_BODY } from "@/domain/contract";
import { importedWordingForm } from "@/domain/contract/import";
import { contractFormFromBody, type ContractLayoutForm } from "@/domain/contract/layout-form";
import { ContractWordingEditor } from "./contract-wording-editor";
import { IMPORT_MESSAGES, IMPORT_NOTICE, type ImportContractWordingState, type SaveContractWordingState } from "./state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const INITIAL = contractFormFromBody(SYSTEM_CONTRACT_BODY);
const IMPORTED = importedWordingForm([
  { type: "heading", text: "Imported terms" },
  { type: "clause", text: "Work is done by {{tenant.legalName}}." },
])! as ContractLayoutForm;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const save = vi.fn(async (): Promise<SaveContractWordingState> => ({ status: "saved" }));
// The import control sits in the header's Import contract popover; open it, as the owner does.
const mount = async (importAction: (formData: FormData) => Promise<ImportContractWordingState>) => {
  await act(async () => {
    root.render(createElement(ContractWordingEditor, { initial: INITIAL, save, importAction }));
  });
  await act(async () => ([...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Import contract") as HTMLElement | undefined)?.click());
};
const rowTexts = () => [...container.querySelectorAll('article[aria-label="Document page"] > ol > li')].map((li) => li.textContent ?? "");
const fileInput = () => container.querySelector("#contract-import-file") as HTMLInputElement;
const choose = (name: string) => Object.defineProperty(fileInput(), "files", { value: [new File([new Uint8Array([1])], name)], configurable: true });
const readButton = () => [...container.querySelectorAll("button")].find((b) => /Read my contract|Reading/.test(b.textContent ?? "")) as HTMLButtonElement;
const press = () => act(async () => readButton().click());
const button = (name: string) => [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === name);
const lastPreviewBody = () => JSON.parse(String(((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1) as [string, RequestInit])[1].body));

describe("the import control in the contract wording editor", () => {
  test("[C33] C5818: after an import the rows are the imported ones, the banner names the file, and the preview request carries them", async () => {
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    choose("Our contract.docx");
    await press();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Imported from Our contract.docx. Nothing is saved until you save.");
    expect(rowTexts().length).toBe(IMPORTED.layout.length);
    expect(container.innerHTML).toContain("Imported terms");
    // The PDF is drawn when the owner asks for it, from the rows as they are then.
    await act(async () => (button("Preview PDF") as HTMLButtonElement).click());
    expect(lastPreviewBody()).toEqual(JSON.parse(JSON.stringify(IMPORTED)));
  });

  test("[C33] C5819: with unsaved edits the editor asks before replacing and keeps them on cancel; with none it does not ask", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    choose("a.docx");
    await press();
    expect(confirm).not.toHaveBeenCalled();
    expect(container.innerHTML).toContain("Imported terms");

    // The imported rows are themselves unsaved, so a second import asks; cancelling keeps them.
    await press();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain("replaces the wording you are editing");
    expect(container.innerHTML).toContain("Imported terms");

    confirm.mockReturnValue(true);
    await press();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(container.innerHTML).toContain("Imported terms");
  });

  test("[C33] C5819: cancelling the confirmation leaves the editor's own rows in place", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    // Make an edit first: select the first block on the page and type in its text field.
    await act(async () => (container.querySelector('article[aria-label="Document page"] [aria-label^="Select Heading"]') as HTMLElement).click());
    const field = container.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, "edited by hand");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const before = rowTexts();
    choose("a.docx");
    await press();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(rowTexts()).toEqual(before);
    expect(container.innerHTML).not.toContain("Imported terms");
    expect(container.textContent).not.toContain("Imported from");
  });

  test("[C33] C5820: saving after an import sends the imported form to the existing save once", async () => {
    save.mockClear();
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    choose("a.docx");
    await press();
    await act(async () => container.querySelector("form")!.requestSubmit());
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(IMPORTED);
  });

  test("[C33] C5820: after the save the import banner is gone and only the saved line remains", async () => {
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    choose("a.docx");
    await press();
    expect(container.textContent).toContain("Imported from a.docx");
    await act(async () => container.querySelector("form")!.requestSubmit());
    expect(container.textContent).not.toContain("Imported from");
    expect(container.textContent).toContain("Saved.");
  });

  test("C5821: the notice sits beside the control, and the control is absent when no import action is given", async () => {
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    expect(IMPORT_NOTICE).toBe("A starting point: you own your wording. Read it through, and confirm it is valid under your province's law.");
    expect(container.querySelector("#contract-import-file")!.closest("div")!.textContent).toContain(IMPORT_NOTICE);
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(createElement(ContractWordingEditor, { initial: INITIAL, save })));
    expect(container.querySelector("#contract-import-file")).toBeNull();
  });

  test("C5823: while the import runs the status shows, the control is disabled, and a second press sends no second request", async () => {
    let release: (state: ImportContractWordingState) => void = () => {};
    const importAction = vi.fn(() => new Promise<ImportContractWordingState>((resolve) => (release = resolve)));
    await mount(importAction);
    choose("a.docx");
    await press();
    expect(importAction).toHaveBeenCalledTimes(1);
    expect(readButton().disabled).toBe(true);
    expect(fileInput().disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Claude is reading your contract");
    await press();
    expect(importAction).toHaveBeenCalledTimes(1);
    await act(async () => release({ status: "imported", form: IMPORTED }));
    expect(readButton().disabled).toBe(false);
  });

  test.each(["invalid", "forbidden", "unreadable", "too_large", "unavailable"] as const)("C5824: %s shows its message, keeps the rows and leaves the control usable", async (code) => {
    await mount(async () => ({ status: "failed", code }));
    const before = rowTexts();
    choose("a.docx");
    await press();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(IMPORT_MESSAGES[code]);
    expect(rowTexts()).toEqual(before);
    expect(readButton().disabled).toBe(false);
    expect(fileInput().disabled).toBe(false);
  });

  test("C5826: the control's button and file input use the 44 px touch classes and no fixed width past w-44", async () => {
    await mount(async () => ({ status: "failed", code: "invalid" }));
    expect(readButton().className).toContain("h-11");
    expect(readButton().className).toContain("lg:h-[34px]");
    expect(fileInput().className).toContain("min-h-11");
    const source = readFileSync(path.resolve(__dirname, "contract-import-control.tsx"), "utf8");
    expect(source).not.toMatch(/\bw-(5\d|[6-9]\d|\d{3})\b|w-\[\d+px\]/);
    expect(source).not.toContain("overflow-x");
  });

  test("C5827: the file input accepts only .docx and .pdf and has a label", async () => {
    await mount(async () => ({ status: "failed", code: "invalid" }));
    expect(fileInput().accept).toBe(".docx,.pdf");
    expect(container.querySelector('label[for="contract-import-file"]')?.textContent).toContain("Import your existing contract");
  });
});
