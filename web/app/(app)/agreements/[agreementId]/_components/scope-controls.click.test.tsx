// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ScopeControl } from "@/domain/agreement";
import { ScopeControls } from "./scope-controls";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CONTROLS: ScopeControl[] = [
  { assetId: "a1", typeCode: "RTU", typeName: "Rooftop unit", unitNo: "RTU-1", typeModel: null, location: null, excluded: false },
  { assetId: "a2", typeCode: "RTU", typeName: "Rooftop unit", unitNo: "RTU-2", typeModel: null, location: null, excluded: true },
];

let host: HTMLDivElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
});

async function mount(setExcluded: (assetId: string, excluded: boolean) => Promise<{ status: string }>) {
  host = document.createElement("div");
  document.body.append(host);
  await act(async () => {
    createRoot(host!).render(createElement(ScopeControls, { controls: CONTROLS, uncovered: [], setExcluded: setExcluded as never }));
  });
  return host;
}

const press = async (root: HTMLElement, label: string) => {
  const button = root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  await act(async () => {
    button.click();
  });
};

describe("the Scope panel buttons", () => {
  test("C6013: Leave out on an included unit asks to exclude it, and Include on an excluded one asks to include it", async () => {
    const setExcluded = vi.fn(async () => ({ status: "saved" }));
    const root = await mount(setExcluded);
    await press(root, "Leave out RTU-1");
    expect(setExcluded).toHaveBeenLastCalledWith("a1", true);
    await press(root, "Include RTU-2");
    expect(setExcluded).toHaveBeenLastCalledWith("a2", false);
  });

  test("C6013: a refusal shows its message in an alert", async () => {
    const root = await mount(async () => ({ status: "locked" }));
    await press(root, "Leave out RTU-1");
    expect(root.querySelector('[role="alert"]')?.textContent).toBe("This version can no longer be changed.");
  });
});
