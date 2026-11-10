// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SubscriptionResult } from "./state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const { SubscriptionControls } = await import("./subscription-controls");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  refresh.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (props: { ending: boolean; actions?: { cancel: () => Promise<SubscriptionResult>; resume: () => Promise<SubscriptionResult> } }) =>
  act(async () => {
    root.render(createElement(SubscriptionControls, { ending: props.ending, endDate: "Nov 24, 2026", actions: props.actions }));
  });
const button = (name: string) => [...container.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === name);
const press = (name: string) =>
  act(async () => {
    const found = button(name);
    if (!found) throw new Error(`no button "${name}"; have ${[...container.querySelectorAll("button")].map((b) => b.textContent).join(", ")}`);
    found.click();
  });
const done = async (): Promise<SubscriptionResult> => ({ status: "done" });

describe("cancelling", () => {
  test("C3140: pressing Cancel subscription only asks: the prompt names the date and nothing is called", async () => {
    const actions = { cancel: vi.fn(done), resume: vi.fn(done) };
    await mount({ ending: false, actions });
    await press("Cancel subscription");
    expect(container.textContent).toContain("Service ends on Nov 24, 2026 and you keep access until then.");
    expect(actions.cancel).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  test("C3140: Keep subscription closes the prompt and nothing is called", async () => {
    const actions = { cancel: vi.fn(done), resume: vi.fn(done) };
    await mount({ ending: false, actions });
    await press("Cancel subscription");
    await press("Keep subscription");
    expect(container.textContent).not.toContain("keep access until then");
    expect(button("Cancel subscription")).toBeTruthy();
    expect(actions.cancel).not.toHaveBeenCalled();
  });

  test("C3140: only Yes, cancel calls cancel, once, then the page refreshes once", async () => {
    const actions = { cancel: vi.fn(done), resume: vi.fn(done) };
    await mount({ ending: false, actions });
    await press("Cancel subscription");
    await press("Yes, cancel");
    expect(actions.cancel).toHaveBeenCalledTimes(1);
    expect(actions.resume).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("C3140: a second press while the cancel is pending makes no second call", async () => {
    let release: (value: SubscriptionResult) => void = () => {};
    const cancel = vi.fn(() => new Promise<SubscriptionResult>((resolve) => (release = resolve)));
    await mount({ ending: false, actions: { cancel, resume: vi.fn(done) } });
    await press("Cancel subscription");
    await press("Yes, cancel");
    expect(button("Cancelling…")?.hasAttribute("disabled")).toBe(true);
    await act(async () => {
      container.querySelector("form")?.requestSubmit();
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    await act(async () => release({ status: "done" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["forbidden", "You don't have permission to change this"],
    ["unavailable", "We couldn't update your subscription. Try again."],
  ] as const)("C3140: a cancel answered %s shows its notice and does not refresh", async (status, text) => {
    await mount({ ending: false, actions: { cancel: async () => ({ status }), resume: vi.fn(done) } });
    await press("Cancel subscription");
    await press("Yes, cancel");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(text);
    expect(refresh).not.toHaveBeenCalled();
  });

  test("C3140: a cancel that throws shows the unavailable notice", async () => {
    await mount({
      ending: false,
      actions: {
        cancel: async () => {
          throw new Error("network");
        },
        resume: vi.fn(done),
      },
    });
    await press("Cancel subscription");
    await press("Yes, cancel");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("We couldn't update your subscription. Try again.");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("resuming", () => {
  test("C3140: Resume calls resume once, never cancel, then refreshes once", async () => {
    const actions = { cancel: vi.fn(done), resume: vi.fn(done) };
    await mount({ ending: true, actions });
    expect(button("Cancel subscription")).toBeUndefined();
    await press("Resume");
    expect(actions.resume).toHaveBeenCalledTimes(1);
    expect(actions.cancel).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("C3140: a resume answered forbidden shows the permission notice and does not refresh", async () => {
    await mount({ ending: true, actions: { cancel: vi.fn(done), resume: async () => ({ status: "forbidden" }) } });
    await press("Resume");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("You don't have permission to change this");
    expect(refresh).not.toHaveBeenCalled();
  });
});
