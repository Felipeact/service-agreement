// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PlanKey } from "@/domain/billing";
import type { PlanChangeResult } from "./state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const { PlanSwitcher } = await import("./plan-switcher");

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

type Props = { current: PlanKey | null; seats: number; trialEndsOn: string | null; readOnlyReason: string | null; changePlan?: (plan: PlanKey) => Promise<PlanChangeResult> };
const mount = (props: Partial<Props> = {}) =>
  act(async () => {
    const all: Props = { current: "starter", seats: 2, trialEndsOn: null, readOnlyReason: null, ...props };
    root.render(createElement(PlanSwitcher, { current: all.current, seats: all.seats, trialEndsOn: all.trialEndsOn, readOnlyReason: all.readOnlyReason, actions: all.changePlan ? { changePlan: all.changePlan } : undefined }));
  });
const button = (name: string) => [...container.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === name);
const press = (name: string) =>
  act(async () => {
    const found = button(name);
    if (!found) throw new Error(`no button "${name}"; have ${[...container.querySelectorAll("button")].map((b) => b.textContent).join(", ")}`);
    found.click();
  });
const done = async (): Promise<PlanChangeResult> => ({ status: "done" });
const text = () => container.textContent ?? "";

describe("the plan list", () => {
  test("C3204: it lists the three plans with price and included seats, and marks the current one without a switch control", async () => {
    await mount({ current: "starter" });
    expect(text()).toContain("Starter");
    expect(text()).toContain("$49/month");
    expect(text()).toContain("$99/month");
    expect(text()).toContain("$199/month");
    expect(text()).toContain("2 seats included");
    expect(text()).toContain("5 seats included");
    expect(text()).toContain("10 seats included");
    expect(text().match(/Current plan/g)).toHaveLength(1);
    expect(button("Switch to Starter")).toBeUndefined();
    expect(button("Switch to Team")).toBeTruthy();
    expect(button("Switch to Business")).toBeTruthy();
  });
});

describe("the confirming step", () => {
  test("C3204: the prompt names the plan, its price, the seat line, the new total, and says nothing is charged during a trial", async () => {
    await mount({ current: "starter", seats: 2, trialEndsOn: "Nov 24, 2026" });
    await press("Switch to Team");
    expect(text()).toContain("Switch to Team?");
    expect(text()).toContain("$99/month");
    expect(text()).toContain("Included seats: 5. Extra seats: 0.");
    expect(text()).toContain("New monthly total: $99.00.");
    expect(text()).toContain("Nothing is charged until your trial ends on Nov 24, 2026.");
    expect(text()).not.toContain("prorated");
  });

  test("C3204: outside a trial the prompt says the change takes effect now and the difference is prorated", async () => {
    await mount({ current: "starter", seats: 2, trialEndsOn: null });
    await press("Switch to Team");
    expect(text()).toContain("The change takes effect now and the difference is prorated.");
    expect(text()).not.toContain("Nothing is charged");
  });

  test("C3204: extra seats carry into the seat line and the total", async () => {
    await mount({ current: "team", seats: 7 });
    await press("Switch to Starter");
    expect(text()).toContain("Included seats: 2. Extra seats: 5.");
    expect(text()).toContain("New monthly total: $124.00.");
  });

  test("C3205: Switch to Team only opens the prompt and calls nothing", async () => {
    const changePlan = vi.fn(done);
    await mount({ changePlan });
    await press("Switch to Team");
    expect(button("Confirm switch")).toBeTruthy();
    expect(changePlan).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  test("C3205: Keep my plan closes the prompt and calls nothing", async () => {
    const changePlan = vi.fn(done);
    await mount({ changePlan });
    await press("Switch to Team");
    await press("Keep my plan");
    expect(button("Confirm switch")).toBeUndefined();
    expect(button("Switch to Team")).toBeTruthy();
    expect(changePlan).not.toHaveBeenCalled();
  });

  test("C3205: only Confirm switch calls the action, once, with the plan key, then refreshes once", async () => {
    const changePlan = vi.fn(done);
    await mount({ changePlan });
    await press("Switch to Business");
    await press("Confirm switch");
    expect(changePlan).toHaveBeenCalledTimes(1);
    expect(changePlan.mock.calls[0]).toEqual(["business"]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("C3205: a second submit while the change is pending makes no second call", async () => {
    let release: (value: PlanChangeResult) => void = () => {};
    const changePlan = vi.fn(() => new Promise<PlanChangeResult>((resolve) => (release = resolve)));
    await mount({ changePlan });
    await press("Switch to Team");
    await press("Confirm switch");
    expect(button("Switching…")?.hasAttribute("disabled")).toBe(true);
    await act(async () => {
      container.querySelector("form")?.requestSubmit();
    });
    expect(changePlan).toHaveBeenCalledTimes(1);
    await act(async () => release({ status: "done" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["forbidden", "You don't have permission to change this"],
    ["same_plan", "You're already on this plan"],
    ["failed", "We couldn't change your plan. Try again."],
  ] as const)("C3205: an answer of %s shows its notice and does not refresh", async (status, notice) => {
    await mount({ changePlan: async () => ({ status }) });
    await press("Switch to Team");
    await press("Confirm switch");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(notice);
    expect(refresh).not.toHaveBeenCalled();
  });

  test("C3205: a throw shows the plan notice and does not refresh", async () => {
    await mount({
      changePlan: async () => {
        throw new Error("network");
      },
    });
    await press("Switch to Team");
    await press("Confirm switch");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("We couldn't change your plan. Try again.");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("a list that cannot be used", () => {
  test("C3202: with a reason the plans are listed with no switch control and the reason is shown", async () => {
    await mount({ current: "team", readOnlyReason: "Resume your subscription to change plan", changePlan: vi.fn(done) });
    expect(text()).toContain("Resume your subscription to change plan");
    expect(text()).toContain("Current plan");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  test("C3202: with an unknown current plan nothing is marked current and no switch control shows", async () => {
    await mount({ current: null, readOnlyReason: "This plan can't be changed here" });
    expect(text()).toContain("This plan can't be changed here");
    expect(text()).not.toContain("Current plan");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
