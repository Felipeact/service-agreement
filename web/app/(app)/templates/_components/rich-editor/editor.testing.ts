import { createElement, lazy, Suspense, type ComponentType } from "react";

/**
 * What the Word-style editor's tests share. `next/dynamic` loads the editor in the test (it is loaded with `ssr: false` in the app):
 * a test file writes `vi.mock("next/dynamic", async () => (await import("./rich-editor/editor.testing")).dynamicModule)`.
 */
export const dynamicModule = {
  default: (load: () => Promise<ComponentType<Record<string, unknown>>>) => {
    const Lazy = lazy(async () => ({ default: await load() }));
    return (props: Record<string, unknown>) => createElement(Suspense, { fallback: null }, createElement(Lazy, props));
  },
};

/** jsdom has no layout: ProseMirror asks for rectangles when it scrolls the selection into view. */
export function stubLayout() {
  const rect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
  const rects = Object.assign([rect], { item: () => rect }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () => rects;
  Element.prototype.scrollIntoView = () => {};
  document.elementFromPoint = () => null;
}

export const ENV = {
  orgName: "Kettle Ridge Mechanical",
  address: "1 Main St",
  phone: "555-0100",
  accent: "#1f6f8b",
  logoUrl: null,
  imageBase: "https://x.supabase.co/storage/v1/object/public/template-images/",
  agreements: [{ id: "33333333-3333-4333-8333-333333333333", label: "AG-1052 for Fernwood Dental, Main office" }],
};

/** Waits for the lazily loaded editor (its page is on screen) and for the effects and updates that follow. */
export async function settle(act: (callback: () => Promise<void>) => Promise<void>) {
  for (let round = 0; round < 200 && !document.querySelector(".ProseMirror"); round += 1) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  for (let round = 0; round < 4; round += 1) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}
