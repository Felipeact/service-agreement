// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SYSTEM_CONTRACT_BODY } from "@/domain/contract";
import { importedWordingForm } from "@/domain/contract/import";
import type { ContractLayoutForm } from "@/domain/contract/layout-form";
import { bodyFromContractRichForm, contractRichFormFromBody, type ContractRichForm } from "@/domain/contract/rich-form";
import { layoutFromRows } from "@/domain/agreement/layout-form";
import { normalizeRichDoc, richFromLayout } from "@/domain/rich-document";
import { ContractWordingEditor } from "./contract-wording-editor";
import { ENV, settle, stubLayout } from "./rich-editor/editor.testing";
import { IMPORT_MESSAGES, IMPORT_NOTICE, type ImportContractWordingState, type SaveContractWordingState } from "./state";

vi.mock("next/dynamic", async () => (await import("./rich-editor/editor.testing")).dynamicModule);
vi.mock("../_actions/image", () => ({ prepareTemplateImageAction: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const INITIAL = contractRichFormFromBody(SYSTEM_CONTRACT_BODY);
const IMPORTED = importedWordingForm([
  { type: "heading", text: "Imported terms" },
  { type: "clause", text: "Work is done by {{tenant.legalName}}." },
])! as ContractLayoutForm;
const IMPORTED_PAGE = richFromLayout(layoutFromRows(IMPORTED.layout));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  stubLayout();
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
const mount = async (importAction?: (formData: FormData) => Promise<ImportContractWordingState>) => {
  await act(async () => {
    root.render(createElement(ContractWordingEditor, { initial: INITIAL, save, importAction, env: ENV }));
  });
  await settle(act);
  if (importAction) await act(async () => ([...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Import contract") as HTMLElement | undefined)?.click());
};
const pageText = () => container.querySelector('[aria-label="Page"]')?.textContent ?? "";
const fileInput = () => container.querySelector("#contract-import-file") as HTMLInputElement;
const choose = (name: string) => Object.defineProperty(fileInput(), "files", { value: [new File([new Uint8Array([1])], name)], configurable: true });
const readButton = () => [...container.querySelectorAll("button")].find((b) => /Read my contract|Reading/.test(b.textContent ?? "")) as HTMLButtonElement;
const press = async () => {
  await act(async () => readButton().click());
  await settle(act);
};
const submit = async () => {
  await act(async () => container.querySelector("form")!.requestSubmit());
  await settle(act);
};

describe("the import control in the contract wording editor", () => {
  test("[C33] C5818: after an import the page is the imported wording, the banner names the file, and Undo-able replacement keeps the signatures", async () => {
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    expect(pageText()).toContain("Signatures");
    choose("Our contract.docx");
    await press();
    expect(container.textContent).toContain("Imported from Our contract.docx. Nothing is saved until you save.");
    expect(pageText()).toContain("Imported terms");
    expect(pageText()).toContain("Your company name");
    expect(container.querySelector('[data-live-section="signatures"]')).not.toBeNull();
  });

  test("[C33] C5819: with unsaved edits the editor asks before replacing and keeps them on cancel; with none it does not ask", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    choose("a.docx");
    await press();
    expect(confirm).not.toHaveBeenCalled();
    expect(pageText()).toContain("Imported terms");

    // The imported page is itself unsaved, so a second import asks; cancelling keeps it.
    await press();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain("replaces the wording you are editing");
    expect(pageText()).toContain("Imported terms");
  });

  test("[C33] C5819: cancelling the confirmation leaves the editor's own edits in place", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    const title = container.querySelector("#document-title") as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, "Edited by hand");
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const before = pageText();
    choose("a.docx");
    await press();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(pageText()).toBe(before);
    expect((container.querySelector("#document-title") as HTMLInputElement).value).toBe("Edited by hand");
    expect(container.textContent).not.toContain("Imported from");
  });

  test("[C33] C5820: saving after an import sends the imported page once, and it is exactly the imported wording", async () => {
    save.mockClear();
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    choose("a.docx");
    await press();
    await submit();
    expect(save).toHaveBeenCalledTimes(1);
    const sent = (save.mock.calls[0] as unknown as [ContractRichForm])[0];
    expect(sent.doc).toEqual(IMPORTED.doc);
    expect(normalizeRichDoc(sent.content)).toEqual(normalizeRichDoc(IMPORTED_PAGE));
    expect(bodyFromContractRichForm(sent).ok).toBe(true);
  });

  test("[C33] C5820: after the save the import banner is gone and only the saved line remains", async () => {
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    choose("a.docx");
    await press();
    expect(container.textContent).toContain("Imported from a.docx");
    await submit();
    expect(container.textContent).not.toContain("Imported from");
    expect(container.textContent).toContain("Saved.");
  });

  test("[C33] C5821: the notice sits beside the control, and the control is absent when no import action is given", async () => {
    await mount(async () => ({ status: "imported", form: IMPORTED }));
    expect(IMPORT_NOTICE).toBe("A starting point: you own your wording. Read it through, and confirm it is valid under your province's law.");
    expect(fileInput().closest("div")!.textContent).toContain(IMPORT_NOTICE);
    act(() => root.unmount());
    root = createRoot(container);
    await mount();
    expect(container.querySelector("#contract-import-file")).toBeNull();
  });

  test("C5823: while the import runs the status shows, the control is disabled, and a second press sends no second request", async () => {
    let release: (state: ImportContractWordingState) => void = () => {};
    const importAction = vi.fn(() => new Promise<ImportContractWordingState>((resolve) => (release = resolve)));
    await mount(importAction);
    choose("a.docx");
    await act(async () => readButton().click());
    expect(importAction).toHaveBeenCalledTimes(1);
    expect(readButton().disabled).toBe(true);
    expect(fileInput().disabled).toBe(true);
    expect([...container.querySelectorAll('[role="status"]')].map((node) => node.textContent).join(" ")).toContain("Claude is reading your contract");
    await act(async () => readButton().click());
    expect(importAction).toHaveBeenCalledTimes(1);
    await act(async () => release({ status: "imported", form: IMPORTED }));
    expect(readButton().disabled).toBe(false);
  });

  test.each(["invalid", "forbidden", "unreadable", "too_large", "unavailable"] as const)("C5824: %s shows its message, keeps the page and leaves the control usable", async (code) => {
    await mount(async () => ({ status: "failed", code }));
    const before = pageText();
    choose("a.docx");
    await press();
    expect([...container.querySelectorAll('[role="alert"]')].map((node) => node.textContent)).toContain(IMPORT_MESSAGES[code]);
    expect(pageText()).toBe(before);
    expect(readButton().disabled).toBe(false);
    expect(fileInput().disabled).toBe(false);
  });

  test("C5826: the control's button and file input use the 44 px touch classes and no fixed width past w-44", async () => {
    await mount(async () => ({ status: "failed", code: "invalid" }));
    expect(readButton().className).toContain("h-11");
    expect(readButton().className).toContain("lg:h-[38px]");
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
