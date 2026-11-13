// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EMPTY_TEMPLATE_FORM, type TemplateFormInput } from "@/domain/agreement/template-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { TemplatePreviewFrame } = await import("./template-preview-frame");
const { TemplateEditor } = await import("./template-editor");

const SAVED: TemplateFormInput = {
  ...EMPTY_TEMPLATE_FORM,
  name: "Quarterly HVAC",
  intro: "Welcome {{customer.name}}.",
  lines: [{ description: "Quarterly visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisit: "$450.00" }],
};
const edited = (intro: string): TemplateFormInput => ({ ...SAVED, intro });
const INVALID: TemplateFormInput = { ...SAVED, lines: [{ ...SAVED.lines[0], costPerVisit: "lots" }] };

type Call = { url: string; init: RequestInit; resolve: (response: Response) => void; reject: (error: unknown) => void };
let calls: Call[];
let created: string[];
let revoked: string[];
let container: HTMLDivElement;
let root: Root;

const pdfResponse = (status = 200, type = "application/pdf") => new Response(new Blob(["%PDF-1.4"]), { status, headers: { "Content-Type": type } });

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  created = [];
  revoked = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      return new Promise<Response>((resolve, reject) => {
        calls.push({ url, init, resolve, reject });
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    }),
  );
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:preview-${created.length + 1}`;
    created.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const show = (values: TemplateFormInput) => act(async () => root.render(createElement(TemplatePreviewFrame, { values })));
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
/** Answers the oldest request that has not been answered with a PDF. */
const answer = (index: number, response = pdfResponse()) => act(async () => calls[index].resolve(response));
const text = () => container.textContent ?? "";
const frameSrc = () => container.querySelector("iframe")?.getAttribute("src") ?? null;
const bodyOf = (index: number) => JSON.parse(String(calls[index].init.body)) as TemplateFormInput;

describe("the preview frame", () => {
  test("C5431: after a change no request is made before 700 ms, one is made at 700 ms carrying the latest values", async () => {
    await show(SAVED);
    await answer(0);
    expect(calls).toHaveLength(1);

    await show(edited("Hello."));
    await tick(699);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe("/templates/preview");
    expect(calls[1].init.method).toBe("POST");
    expect(bodyOf(1)).toEqual(edited("Hello."));
  });

  test("C5431: two changes 300 ms apart make one request, at 1,000 ms, with the second change's values", async () => {
    await show(SAVED);
    await answer(0);

    await show(edited("First."));
    await tick(300);
    await show(edited("Second."));
    await tick(699);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls).toHaveLength(2);
    expect(bodyOf(1).intro).toBe("Second.");
    await tick(2000);
    expect(calls).toHaveLength(2);
  });

  test("C5431: typing in the editor's own Intro field is what the request carries", async () => {
    await act(async () => root.render(createElement(TemplateEditor, { templateId: null, initial: EMPTY_TEMPLATE_FORM, types: [], save: vi.fn() })));
    await answer(0);
    const intro = container.querySelector<HTMLTextAreaElement>("#template-intro")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(intro, "A new intro.");
      intro.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await tick(699);
    expect(calls).toHaveLength(1);
    await tick(1);
    expect(calls).toHaveLength(2);
    expect(bodyOf(1).intro).toBe("A new intro.");
  });

  test("C5432: while a request is in flight it says Updating preview… and keeps the last PDF", async () => {
    await show(SAVED);
    await answer(0);
    expect(frameSrc()).toBe("blob:preview-1#toolbar=0&view=FitH");
    expect(text()).not.toContain("Updating preview…");

    await show(edited("Hello."));
    await tick(700);
    expect(text()).toContain("Updating preview…");
    expect(frameSrc()).toBe("blob:preview-1#toolbar=0&view=FitH");

    await answer(1);
    expect(text()).not.toContain("Updating preview…");
    expect(frameSrc()).toBe("blob:preview-2#toolbar=0&view=FitH");
  });

  test("C5432: a newer change cancels the request before it and its late answer is never shown", async () => {
    await show(SAVED);
    await answer(0);
    await show(edited("One."));
    await tick(700);
    const older = calls[1];
    expect(older.init.signal?.aborted).toBe(false);

    await show(edited("Two."));
    expect(older.init.signal?.aborted).toBe(true);
    await tick(700);
    expect(calls).toHaveLength(3);

    // The older answer arrives after all: it is ignored.
    older.resolve(pdfResponse());
    await tick(0);
    expect(created).toHaveLength(1);
    await answer(2);
    expect(created).toHaveLength(2);
    expect(frameSrc()).toBe("blob:preview-2#toolbar=0&view=FitH");
  });

  test("C5432: a replaced PDF's object URL is released, and the last one when the editor goes away", async () => {
    await show(SAVED);
    await answer(0);
    expect(revoked).toEqual([]);
    await show(edited("Next."));
    await tick(700);
    await answer(1);
    expect(revoked).toEqual(["blob:preview-1"]);
    act(() => root.unmount());
    expect(revoked).toEqual(["blob:preview-1", "blob:preview-2"]);
    root = createRoot(container);
  });

  test("C5432: leaving while a request is in flight cancels it and makes no object URL", async () => {
    await show(SAVED);
    expect(calls[0].init.signal?.aborted).toBe(false);
    act(() => root.unmount());
    expect(calls[0].init.signal?.aborted).toBe(true);
    expect(created).toEqual([]);
    root = createRoot(container);
  });

  test("C5433: invalid values keep the last good PDF, say Fix the highlighted fields to refresh the preview., and make no request", async () => {
    await show(SAVED);
    await answer(0);
    await show(INVALID);
    await tick(5000);
    expect(calls).toHaveLength(1);
    expect(text()).toContain("Fix the highlighted fields to refresh the preview.");
    expect(frameSrc()).toBe("blob:preview-1#toolbar=0&view=FitH");

    // Fixing them draws again.
    await show(SAVED);
    expect(text()).not.toContain("Fix the highlighted fields");
    await tick(700);
    expect(calls).toHaveLength(2);
  });

  test("C5433: when the server answers 422 the last good PDF is kept and the invalid-values message is shown", async () => {
    await show(SAVED);
    await answer(0);
    await show(edited("Typing."));
    await tick(700);
    await answer(1, new Response(JSON.stringify({ errors: [{ field: "name", message: "x" }] }), { status: 422, headers: { "Content-Type": "application/json" } }));
    expect(text()).toContain("Fix the highlighted fields to refresh the preview.");
    expect(text()).not.toContain("Preview unavailable.");
    expect(text()).not.toContain("Updating preview…");
    expect(frameSrc()).toBe("blob:preview-1#toolbar=0&view=FitH");
  });

  test("C5433: values that turn invalid while a request is in flight cancel it", async () => {
    await show(SAVED);
    await answer(0);
    await show(edited("Typing."));
    await tick(700);
    expect(calls[1].init.signal?.aborted).toBe(false);
    await show(INVALID);
    expect(calls[1].init.signal?.aborted).toBe(true);
    await tick(2000);
    expect(calls).toHaveLength(2);
    expect(text()).not.toContain("Updating preview…");
  });

  test("C5433: in the editor the fields the preview cannot draw show their messages as soon as they are typed, without the save banner", async () => {
    await act(async () => root.render(createElement(TemplateEditor, { templateId: null, initial: INVALID, types: [], save: vi.fn() })));
    expect(container.querySelector("#line-0-price")!.getAttribute("aria-invalid")).toBe("true");
    expect(text()).toContain("Enter a price per visit like $450.00");
    expect(text()).toContain("Fix the highlighted fields to refresh the preview.");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  test("C5434: an editor opened on a saved template requests a PDF once on mount, with no edit", async () => {
    await act(async () => root.render(createElement(TemplateEditor, { templateId: "88888888-8888-4888-8888-888888888888", initial: SAVED, types: [], save: vi.fn() })));
    expect(calls).toHaveLength(1);
    expect(bodyOf(0)).toEqual(SAVED);
    await tick(5000);
    expect(calls).toHaveLength(1);
  });

  test("C5434: an editor opened on a new template requests a PDF once on mount too, before a name is typed", async () => {
    await act(async () => root.render(createElement(TemplateEditor, { templateId: null, initial: EMPTY_TEMPLATE_FORM, types: [], save: vi.fn() })));
    expect(calls).toHaveLength(1);
    expect(bodyOf(0)).toEqual(EMPTY_TEMPLATE_FORM);
    await answer(0);
    expect(frameSrc()).toBe("blob:preview-1#toolbar=0&view=FitH");
    await tick(5000);
    expect(calls).toHaveLength(1);
  });

  test.each([
    ["the request fails", () => calls[0].reject(new TypeError("Failed to fetch"))],
    ["the route answers 503", () => calls[0].resolve(pdfResponse(503, "text/plain"))],
    ["the answer is not a PDF (a redirect to the sign-in page)", () => calls[0].resolve(pdfResponse(200, "text/html"))],
  ])("C5438: when %s it says Preview unavailable. with a Try again button", async (_label, fail) => {
    await show(SAVED);
    await act(async () => fail());
    expect(text()).toContain("Preview unavailable.");
    const retry = [...container.querySelectorAll("button")].find((button) => button.textContent === "Try again");
    expect(retry).toBeDefined();
    expect(created).toEqual([]);
  });

  test("C5438: Try again requests at once, keeps the last good PDF meanwhile and replaces the message with the new PDF", async () => {
    await show(SAVED);
    await answer(0);
    await show(edited("Again."));
    await tick(700);
    await act(async () => calls[1].reject(new TypeError("Failed to fetch")));
    expect(text()).toContain("Preview unavailable.");
    expect(frameSrc()).toBe("blob:preview-1#toolbar=0&view=FitH");

    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Try again")!.click());
    expect(calls).toHaveLength(3);
    expect(bodyOf(2).intro).toBe("Again.");
    await answer(2);
    expect(text()).not.toContain("Preview unavailable.");
    expect(frameSrc()).toBe("blob:preview-2#toolbar=0&view=FitH");
  });

  test("C5438: with the preview unavailable the form's fields stay editable", async () => {
    await act(async () => root.render(createElement(TemplateEditor, { templateId: null, initial: SAVED, types: [], save: vi.fn() })));
    await act(async () => calls[0].reject(new TypeError("Failed to fetch")));
    expect(text()).toContain("Preview unavailable.");
    for (const id of ["template-name", "template-intro", "template-footer", "template-term", "line-0-price"]) {
      expect(container.querySelector<HTMLInputElement>(`#${id}`)!.disabled, id).toBe(false);
    }
    expect([...container.querySelectorAll("button")].find((button) => button.type === "submit")!.disabled).toBe(false);
  });

  test("C5439: once a PDF has been shown it offers Open the preview in a new tab, linking to its object URL", async () => {
    await show(SAVED);
    expect([...container.querySelectorAll("a")].some((a) => a.textContent === "Open the preview in a new tab")).toBe(false);
    await answer(0);
    const link = [...container.querySelectorAll("a")].find((a) => a.textContent === "Open the preview in a new tab")!;
    expect(link.getAttribute("href")).toBe("blob:preview-1");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
