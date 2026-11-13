// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, test, vi } from "vitest";
import { SYSTEM_CONTRACT_BODY } from "@/domain/contract";
import { contractFormFromBody } from "@/domain/contract/layout-form";
import type { SaveContractWordingState } from "./state";
import { ContractWordingEditor } from "./contract-wording-editor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const INITIAL = contractFormFromBody(SYSTEM_CONTRACT_BODY);

async function submitWith(answer: SaveContractWordingState) {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  const save = vi.fn(async () => answer);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(ContractWordingEditor, { initial: INITIAL, save })));
  await act(async () => container.querySelector("form")!.requestSubmit());
  return { save, container, done: () => (act(() => root.unmount()), container.remove(), vi.unstubAllGlobals()) };
}

describe("the contract wording editor", () => {
  test("C5553: saving sends the typed rows once and says the wording is saved", async () => {
    const { save, container, done } = await submitWith({ status: "saved" });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(INITIAL);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Saved.");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    done();
  });

  test.each<[SaveContractWordingState["status"], string]>([
    ["forbidden", "You don't have permission to save the contract wording."],
    ["unavailable", "We couldn't save the contract wording. Try again."],
  ])("C5553: a save answering %s says so in words and keeps the rows", async (status, message) => {
    const { container, done } = await submitWith({ status } as SaveContractWordingState);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(message);
    expect(container.querySelectorAll('section[aria-label="Layout"] > ol > li')).toHaveLength(INITIAL.layout.length);
    done();
  });

  test("C5554: an invalid answer shows the row's message beside it, with the contract preview frame beside the form", async () => {
    const { container, done } = await submitWith({ status: "invalid", errors: { "layout.4.text": "Item 5 uses an unknown variable: nope." }, values: INITIAL });
    const rows = container.querySelectorAll('section[aria-label="Layout"] > ol > li');
    expect(rows[4].textContent).toContain("Item 5 uses an unknown variable: nope.");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Fix the highlighted fields");
    expect(container.querySelector('section[aria-label="Preview"]')).not.toBeNull();
    done();
  });

  test("C5552: the preview request goes to the contract preview route with the layout and options", async () => {
    const { done } = await submitWith({ status: "idle" });
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    expect(calls[0][0]).toBe("/templates/contract/preview");
    expect(JSON.parse(String(calls[0][1].body))).toEqual(JSON.parse(JSON.stringify(INITIAL)));
    done();
  });

  test("C5550: the container is a column below 1280 px and two equal tracks from xl, the same as the agreement editor", async () => {
    const { container, done } = await submitWith({ status: "idle" });
    const classes = (container.firstElementChild as HTMLElement).className;
    expect(classes).toMatch(/\bflex-col\b/);
    expect(classes).toMatch(/\bxl:grid\b/);
    expect(classes).toMatch(/\bxl:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
    expect(classes).not.toMatch(/\b(?:lg|md|sm):grid\b/);
    const children = [...container.firstElementChild!.children];
    expect(children[0].getAttribute("aria-label")).toBe("Contract wording form");
    expect(children[1].getAttribute("aria-label")).toBe("Preview");
    done();
  });

  test("C5550: every row button carries min-h-11, and every field in a row is 44px tall below lg", async () => {
    const { container, done } = await submitWith({ status: "idle" });
    const items = [...container.querySelectorAll('section[aria-label="Layout"] > ol > li')];
    expect(items.length).toBe(INITIAL.layout.length);
    for (const li of items) {
      for (const button of li.querySelectorAll("button")) expect(button.className, button.textContent ?? "").toContain("min-h-11");
      for (const input of li.querySelectorAll<HTMLElement>('input:not([type="checkbox"]), select')) expect(input.className, input.id).toMatch(/\bh-11\b/);
    }
    done();
  });
});
