// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { StartAgreementState } from "./new-agreement-state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const { NewAgreementDialog } = await import("./new-agreement-dialog");

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const FREE = "22222222-2222-4222-8222-222222222221";
const BUSY = "22222222-2222-4222-8222-222222222222";

const noop = vi.fn();
const sites = [
  { id: FREE, name: "Tower A", customerId: CUSTOMER, customer: "Harbourview", liveAgreement: null },
  { id: BUSY, name: "Tower B", customerId: CUSTOMER, customer: "Harbourview", liveAgreement: { id: "ag-live", number: "AG-0042" } },
];
const props = (start: (input: never) => Promise<StartAgreementState>) => ({
  customers: [{ id: CUSTOMER, name: "Harbourview" }],
  sites,
  actions: { start: start as never, startImport: noop, confirmImport: noop, readImport: noop, extractImport: noop },
  templates: [],
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  push.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const change = async (element: HTMLSelectElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
const pick = (id: string) => container.querySelector<HTMLSelectElement>(`#${id}`)!;

describe("the sites in the New agreement dialog", () => {
  test("C1362: a site with a live agreement is shown disabled and named with its number, and only free sites can be chosen", async () => {
    await act(async () => root.render(createElement(NewAgreementDialog, props(vi.fn()) as never)));
    await change(pick("newAgreementCustomer"), CUSTOMER);
    const options = [...pick("newAgreementSite").querySelectorAll("option")].map((option) => ({ text: option.textContent, value: option.value, disabled: option.disabled }));
    expect(options).toEqual([
      { text: "Choose a site", value: "", disabled: true },
      { text: "Tower A", value: FREE, disabled: false },
      { text: "Tower B (AG-0042 in progress)", value: BUSY, disabled: true },
      { text: "+ Add a new site…", value: "__new", disabled: false },
    ]);
  });
});

describe("the dialog's answer to a site that already has an agreement", () => {
  test("C1364: open_exists names the live agreement, links to it, creates nothing more and keeps the choices", async () => {
    const start = vi.fn(async (): Promise<StartAgreementState> => ({ status: "open_exists", agreementId: "ag-live", number: "AG-0042" }));
    await act(async () => root.render(createElement(NewAgreementDialog, props(start) as never)));
    await change(pick("newAgreementCustomer"), CUSTOMER);
    await change(pick("newAgreementSite"), FREE);
    await act(async () => container.querySelector("form")!.requestSubmit());

    expect(start).toHaveBeenCalledTimes(1);
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("AG-0042 is already in progress for this site.");
    const link = alert.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/agreements/ag-live");
    expect(link.textContent).toBe("Open AG-0042");
    expect(push).not.toHaveBeenCalled();
    expect(pick("newAgreementSite").value).toBe(FREE);
  });

  test.each([
    ["not_found", "That customer or site no longer exists. Close this and try again."],
    ["unavailable", "We couldn't create the agreement. Try again."],
    ["forbidden", "You don't have permission to create agreements."],
  ] as const)("C1364: a %s answer shows its message", async (status, message) => {
    const start = vi.fn(async (): Promise<StartAgreementState> => ({ status }));
    await act(async () => root.render(createElement(NewAgreementDialog, props(start) as never)));
    await change(pick("newAgreementCustomer"), CUSTOMER);
    await change(pick("newAgreementSite"), FREE);
    await act(async () => container.querySelector("form")!.requestSubmit());
    expect(container.querySelector('[role="alert"]')!.textContent).toContain(message);
    expect(push).not.toHaveBeenCalled();
  });
});
