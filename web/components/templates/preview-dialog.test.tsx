// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { click, withText } from "./editor-test-kit";
import { PREVIEW_DIALOG_MESSAGES, PreviewDialog } from "./preview-dialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Values = { title: string };
let container: HTMLDivElement;
let root: Root;
const fetchSpy = vi.fn();
const pdf = (type = "application/pdf", status = 200) => new Response(new Blob(["%PDF-1.4"]), { status, headers: { "Content-Type": type } });

beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const mount = (values: Values, canDraw = () => true, endpoint = "/templates/preview") =>
  act(async () => root.render(createElement(PreviewDialog<Values>, { values, endpoint, canDraw, frameTitle: "Agreement PDF preview" })));
const opener = () => withText(container, "button", "Preview PDF") as HTMLButtonElement;
const dialog = () => container.querySelector('[role="dialog"]');

describe("Preview PDF", () => {
  test("[C23] pressing it sends the current form once to the agreement endpoint and shows the PDF in a dialog", async () => {
    fetchSpy.mockResolvedValue(pdf());
    await mount({ title: "Hello" });
    expect(dialog()).toBeNull();
    await click(opener());
    await act(async () => {});
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/templates/preview");
    expect(JSON.parse(String(init.body))).toEqual({ title: "Hello" });
    expect(dialog()).not.toBeNull();
    expect(container.querySelector('iframe[title="Agreement PDF preview"]')).not.toBeNull();
  });

  test("[C23] the contract's endpoint is the one asked when the editor gives it", async () => {
    fetchSpy.mockResolvedValue(pdf());
    await mount({ title: "Hello" }, () => true, "/templates/contract/preview");
    await click(opener());
    await act(async () => {});
    expect(fetchSpy.mock.calls[0][0]).toBe("/templates/contract/preview");
  });

  test("[C24] with the dialog closed, a change to the form makes no request", async () => {
    fetchSpy.mockResolvedValue(pdf());
    await mount({ title: "One" });
    await mount({ title: "Two" });
    await mount({ title: "Three" });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 900)));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("[C25] a form that cannot be drawn opens the dialog with the message and makes no request", async () => {
    await mount({ title: "Hello" }, () => false);
    await click(opener());
    await act(async () => {});
    expect(dialog()?.textContent).toContain(PREVIEW_DIALOG_MESSAGES.invalid);
    expect(PREVIEW_DIALOG_MESSAGES.invalid).toBe("Fix the highlighted blocks to preview.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("[C26] a failed request shows Preview unavailable with Try again, which asks again", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(pdf());
    await mount({ title: "Hello" });
    await click(opener());
    await act(async () => {});
    expect(dialog()?.textContent).toContain("Preview unavailable.");
    await click(withText(dialog()!, "button", "Try again"));
    await act(async () => {});
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(dialog()?.textContent).not.toContain("Preview unavailable.");
  });

  test("[C26] an answer that is not a PDF is also Preview unavailable", async () => {
    fetchSpy.mockResolvedValue(new Response("<html>sign in</html>", { status: 200, headers: { "Content-Type": "text/html" } }));
    await mount({ title: "Hello" });
    await click(opener());
    await act(async () => {});
    expect(dialog()?.textContent).toContain("Preview unavailable.");
    expect(withText(dialog()!, "button", "Try again")).toBeDefined();
  });

  test("[C27] Escape closes the dialog and focus returns to the Preview PDF button", async () => {
    fetchSpy.mockResolvedValue(pdf());
    await mount({ title: "Hello" });
    await click(opener());
    await act(async () => {});
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener());
  });

  test("[C27] Close does the same, and the dialog offers to open the PDF in a new tab", async () => {
    fetchSpy.mockResolvedValue(pdf());
    await mount({ title: "Hello" });
    await click(opener());
    await act(async () => {});
    expect(dialog()?.textContent).toContain("Open the preview in a new tab");
    await click(withText(dialog()!, "button", "Close"));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener());
  });

  test("[C39] the opener and Close carry the 44px class", async () => {
    fetchSpy.mockResolvedValue(pdf());
    await mount({ title: "Hello" });
    expect(opener().className).toContain("h-11");
    await click(opener());
    expect(withText(dialog()!, "button", "Close")!.className).toContain("h-11");
  });
});
