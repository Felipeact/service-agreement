// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DraftFormState } from "./draft-state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { DraftPanel } = await import("./draft-panel");

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

const acceptAction = async () => ({ status: "idle" as const });
const mount = (draftAction: (state: DraftFormState, formData: FormData) => Promise<DraftFormState>) =>
  act(async () => {
    root.render(createElement(DraftPanel, { draftAction, acceptAction }));
  });
const form = () => container.querySelector("form") as HTMLFormElement;
const submit = () =>
  act(async () => {
    form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
const field = (id: string) => container.querySelector(`#${id}`) as HTMLInputElement;
const typeTrade = (value: string) => {
  const input = field("draft-trade");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
};

describe("the draft form in a browser", () => {
  test("C4126: while a draft is being made the button is disabled and a second submit sends no second request", async () => {
    let release: (state: DraftFormState) => void = () => {};
    const draftAction = vi.fn(() => new Promise<DraftFormState>((resolve) => (release = resolve)));
    await mount(draftAction);
    typeTrade("pest control");
    await submit();
    expect(draftAction).toHaveBeenCalledTimes(1);
    expect((container.querySelector("button[type=submit]") as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Claude is drafting");
    await submit();
    expect(draftAction).toHaveBeenCalledTimes(1);
    await act(async () => release({ status: "failed", code: "unavailable", trade: "pest control", notes: "" }));
  });

  test("C4127: after a failed draft the form is not reset: the same trade field and file input stay, with their values", async () => {
    const draftAction = vi.fn(async (): Promise<DraftFormState> => ({ status: "failed", code: "unavailable", trade: "pest control", notes: "" }));
    await mount(draftAction);
    const fileBefore = field("draft-file");
    const tradeBefore = field("draft-trade");
    typeTrade("pest control");
    const file = new File(["x"], "proposal.pdf");
    Object.defineProperty(fileBefore, "files", { value: [file], configurable: true });
    await submit();
    expect(container.textContent).toContain("We couldn't draft your catalog. Try again.");
    expect(field("draft-file")).toBe(fileBefore);
    expect((field("draft-file") as HTMLInputElement).files?.[0]).toBe(file);
    expect(field("draft-trade")).toBe(tradeBefore);
    expect(field("draft-trade").value).toBe("pest control");
    const sent = (draftAction.mock.calls[0] as unknown as [DraftFormState, FormData])[1];
    expect(sent.get("trade")).toBe("pest control");
  });
});
