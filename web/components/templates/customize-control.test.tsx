import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CustomizeTemplateState } from "./state";

// The form action is React's own; its state is replaced here so a pending or failed answer can be drawn, and the reducer React is given is called as the form would.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

const react = await import("react");
const { CustomizeControl } = await import("./customize-control");

type Reducer = (state: CustomizeTemplateState, formData: FormData) => Promise<CustomizeTemplateState>;
let reducer: Reducer | undefined;

beforeEach(() => {
  reducer = undefined;
});

function draw(state: CustomizeTemplateState, pending: boolean, action = vi.fn(async (): Promise<CustomizeTemplateState> => ({ status: "idle" }))) {
  vi.mocked(react.useActionState).mockImplementationOnce(((given: Reducer) => {
    reducer = given;
    return [state, vi.fn(), pending];
  }) as never);
  const html = renderToStaticMarkup(createElement(CustomizeControl, { templateId: "tpl-1", action }) as ReactElement);
  return { html, action };
}

describe("the Customize control", () => {
  test("C5420: pressing Customize calls the action once with the template's id", async () => {
    const { html, action } = draw({ status: "idle" }, false);
    expect(html).toContain(">Customize</button>");
    expect(html).toContain('type="submit"');
    expect(action).not.toHaveBeenCalled();
    await reducer!({ status: "idle" }, new FormData());
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith("tpl-1");
  });

  test("C5420: while the action is pending the button is disabled and says Customizing…", () => {
    const pending = draw({ status: "idle" }, true).html;
    expect(pending).toMatch(/<button[^>]*disabled=""/);
    expect(pending).toContain("Customizing…");
    expect(draw({ status: "idle" }, false).html).not.toMatch(/<button[^>]*disabled=""/);
  });

  test.each([
    ["forbidden", "Only owners and admins can change templates."],
    ["not_found", "That template no longer exists."],
    ["unavailable", "We couldn&#x27;t do that. Try again."],
  ] as const)("C5420: a %s answer shows its message as an alert and the button is usable", (status, message) => {
    const { html } = draw({ status }, false);
    expect(html).toMatch(new RegExp(`<p[^>]*role="alert"[^>]*>${message}</p>`));
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
  });

  test("C5420: with no answer yet there is no alert", () => {
    expect(draw({ status: "idle" }, false).html).not.toContain('role="alert"');
  });
});
