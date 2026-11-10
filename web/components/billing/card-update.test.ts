// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FinishResult, StartResult } from "./state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refresh = vi.fn();
const confirmSetup = vi.fn();
const loadStripe = vi.fn<(key: string) => Promise<object>>(async () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@stripe/stripe-js/pure", () => ({ loadStripe: (key: string) => loadStripe(key) }));
vi.mock("@stripe/react-stripe-js", async () => {
  const React = await import("react");
  return {
    Elements: ({ children }: { children: React.ReactNode }) => children,
    PaymentElement: () => React.createElement("div", { "data-testid": "card-field" }, "card field"),
    useStripe: () => ({ confirmSetup }),
    useElements: () => ({ id: "elements" }),
  };
});

const { CardUpdate } = await import("./card-update");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  refresh.mockClear();
  confirmSetup.mockReset();
  loadStripe.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

type Actions = { startCardUpdate: () => Promise<StartResult>; finishCardUpdate: (id: string) => Promise<FinishResult> };
const ready = async (): Promise<StartResult> => ({ status: "ready", clientSecret: "seti_secret" });
const saved = async (): Promise<FinishResult> => ({ status: "saved" });

const mount = (publishableKey: string | null, actions?: Actions) =>
  act(async () => {
    root.render(createElement(CardUpdate, { publishableKey, actions }));
  });
const button = (name: string) => [...container.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === name);
const press = (name: string) =>
  act(async () => {
    const found = button(name);
    if (!found) throw new Error(`no button "${name}"`);
    found.click();
  });
const submit = () =>
  act(async () => {
    container.querySelector("form")?.requestSubmit();
  });
const alertText = () => container.querySelector('[role="alert"]')?.textContent;

describe("the card update island", () => {
  test("C3141: with no publishable key it says card updates are not set up, offers no button and loads no Stripe code", async () => {
    await mount(null, { startCardUpdate: vi.fn(ready), finishCardUpdate: vi.fn(saved) });
    expect(container.textContent).toContain("Card updates aren't set up yet");
    expect(button("Update card")).toBeUndefined();
    expect(loadStripe).not.toHaveBeenCalled();
  });

  test("C3141: Update card asks the server once, then shows the card field and Save card", async () => {
    const actions = { startCardUpdate: vi.fn(ready), finishCardUpdate: vi.fn(saved) };
    await mount("pk_test_x", actions);
    await press("Update card");
    expect(actions.startCardUpdate).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="card-field"]')).toBeTruthy();
    expect(button("Save card")).toBeTruthy();
    expect(loadStripe).toHaveBeenCalledWith("pk_test_x");
  });

  test("C3141: Cancel closes the card form without confirming anything", async () => {
    await mount("pk_test_x", { startCardUpdate: vi.fn(ready), finishCardUpdate: vi.fn(saved) });
    await press("Update card");
    await press("Cancel");
    expect(button("Save card")).toBeUndefined();
    expect(button("Update card")).toBeTruthy();
    expect(confirmSetup).not.toHaveBeenCalled();
  });

  test.each([
    ["forbidden", "You don't have permission to change this"],
    ["unavailable", "We couldn't update your card"],
  ] as const)("C3139: a start answered %s shows its notice and no card form", async (status, text) => {
    await mount("pk_test_x", { startCardUpdate: async () => ({ status }), finishCardUpdate: vi.fn(saved) });
    await press("Update card");
    expect(alertText()).toBe(text);
    expect(button("Save card")).toBeUndefined();
  });

  test("C3141: Save card confirms with Stripe without a redirect, sends only the SetupIntent id, then refreshes once", async () => {
    confirmSetup.mockResolvedValue({ setupIntent: { id: "seti_1AbC" } });
    const actions = { startCardUpdate: vi.fn(ready), finishCardUpdate: vi.fn(saved) };
    await mount("pk_test_x", actions);
    await press("Update card");
    await submit();
    expect(confirmSetup).toHaveBeenCalledTimes(1);
    expect(confirmSetup.mock.calls[0][0]).toMatchObject({ redirect: "if_required", elements: { id: "elements" } });
    expect(actions.finishCardUpdate).toHaveBeenCalledTimes(1);
    expect(actions.finishCardUpdate.mock.calls[0]).toEqual(["seti_1AbC"]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(button("Save card")).toBeUndefined();
  });

  test("C3141: a Stripe error shows Stripe's message beside the field, finish is not called, the form stays", async () => {
    confirmSetup.mockResolvedValue({ error: { message: "Your card has been declined." } });
    const actions = { startCardUpdate: vi.fn(ready), finishCardUpdate: vi.fn(saved) };
    await mount("pk_test_x", actions);
    await press("Update card");
    await submit();
    expect(alertText()).toBe("Your card has been declined.");
    expect(actions.finishCardUpdate).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(button("Save card")).toBeTruthy();
  });

  test.each([
    [{ status: "failed" } as FinishResult, "We couldn't update your card"],
    [{ status: "forbidden" } as FinishResult, "You don't have permission to change this"],
  ])("C3139: a finish answered %j shows %s and does not refresh", async (answer, text) => {
    confirmSetup.mockResolvedValue({ setupIntent: { id: "seti_1AbC" } });
    await mount("pk_test_x", { startCardUpdate: vi.fn(ready), finishCardUpdate: async () => answer });
    await press("Update card");
    await submit();
    expect(alertText()).toBe(text);
    expect(refresh).not.toHaveBeenCalled();
  });

  test("C3141: a second submit while saving confirms only once", async () => {
    let release: (value: unknown) => void = () => {};
    confirmSetup.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    await mount("pk_test_x", { startCardUpdate: vi.fn(ready), finishCardUpdate: vi.fn(saved) });
    await press("Update card");
    await submit();
    expect(button("Saving…")?.hasAttribute("disabled")).toBe(true);
    await submit();
    expect(confirmSetup).toHaveBeenCalledTimes(1);
    await act(async () => release({ setupIntent: { id: "seti_1AbC" } }));
  });
});
