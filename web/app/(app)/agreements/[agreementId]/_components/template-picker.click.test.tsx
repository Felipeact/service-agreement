// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TemplatePicker } from "./template-picker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CHOICES = [
  { versionId: "v-std", name: "Standard agreement" },
  { versionId: "v-hvac", name: "Quarterly HVAC" },
];

let host: HTMLDivElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
});

async function mount(change: (id: string) => Promise<{ status: string }>) {
  host = document.createElement("div");
  document.body.append(host);
  await act(async () => {
    createRoot(host!).render(createElement(TemplatePicker, { name: "Standard agreement", choices: CHOICES, selectedVersionId: "v-std", change: change as never }));
  });
  return host;
}

const choose = async (root: HTMLElement, value: string) => {
  const select = root.querySelector("select")!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    setter.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const press = async (root: HTMLElement) => {
  const button = [...root.querySelectorAll("button")].find((b) => b.textContent === "Change template")!;
  await act(async () => {
    button.click();
  });
};

describe("the Change template button", () => {
  test("C7111: it asks the action for the chosen template version", async () => {
    const change = vi.fn(async () => ({ status: "saved" }));
    const root = await mount(change);
    await choose(root, "v-hvac");
    await press(root);
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith("v-hvac");
  });

  test("C7111: with the current template still chosen the button is disabled and nothing is asked", async () => {
    const change = vi.fn(async () => ({ status: "saved" }));
    const root = await mount(change);
    const button = [...root.querySelectorAll("button")].find((b) => b.textContent === "Change template")!;
    expect(button.disabled).toBe(true);
    await press(root);
    expect(change).not.toHaveBeenCalled();
  });

  test.each([
    ["locked", "This agreement can no longer change its template."],
    ["invalid_template", "That template is no longer available. Reload the page."],
    ["forbidden", "You don't have permission to change agreements."],
  ])("C7111: a %s refusal shows its message in an alert", async (status, message) => {
    const root = await mount(async () => ({ status }));
    await choose(root, "v-hvac");
    await press(root);
    expect(root.querySelector('[role="alert"]')?.textContent).toBe(message);
  });
});
