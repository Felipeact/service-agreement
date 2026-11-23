import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

// The stateful control is called as a function below, so its two hooks are replaced there; everywhere else they call through to React.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: vi.fn(actual.useState), useActionState: vi.fn(actual.useActionState) };
});

const react = await import("react");
const { ArchiveControl, ArchivePrompt } = await import("./archive-control");

const prompt = (patch: Partial<Parameters<typeof ArchivePrompt>[0]> = {}) =>
  renderToStaticMarkup(createElement(ArchivePrompt, { templateId: "t-1", name: "Quarterly HVAC", confirming: false, pending: false, state: { status: "idle" }, ...patch }));

describe("archiving a template asks first", () => {
  test("C5353: before the first press there is an Archive button and no confirmation form", () => {
    const html = prompt();
    expect(html).toContain(">Archive</button>");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Confirm archive");
  });

  test("C5353: after the first press the confirmation names the template and offers Confirm archive and Cancel", () => {
    const html = prompt({ confirming: true });
    expect(html).toContain("Archive Quarterly HVAC?");
    expect(html).toMatch(/<button[^>]*data-variant="danger"[^>]*type="submit"|<button[^>]*type="submit"[^>]*data-variant="danger"/);
    expect(html).toContain("Confirm archive");
    expect(html).toContain(">Cancel</button>");
    expect(html).toContain('value="t-1"');
  });

  test("C5353: only the confirm form submits; Archive and Cancel are plain buttons that call nothing by themselves", () => {
    const asking = prompt({ confirming: true });
    expect(asking.match(/type="submit"/g)).toHaveLength(1);
    expect(prompt().match(/type="submit"/g) ?? []).toHaveLength(0);
  });

  test("C5353: a refusal is shown as an alert in words", () => {
    expect(prompt({ confirming: true, state: { status: "forbidden" } })).toContain("Only owners and admins can change templates.");
    expect(prompt({ state: { status: "not_found" } })).toContain("That template no longer exists.");
    expect(prompt({ state: { status: "idle" } })).not.toContain('role="alert"');
  });
});

describe("the stateful archive control", () => {
  function control() {
    const setConfirming = vi.fn();
    const archive = vi.fn(async () => ({ status: "archived" as const }));
    const formAction = vi.fn();
    vi.mocked(react.useState).mockImplementationOnce((() => [false, setConfirming]) as never);
    vi.mocked(react.useActionState).mockImplementationOnce((() => [{ status: "idle" }, formAction, false]) as never);
    const element = ArchiveControl({ templateId: "t-1", name: "Quarterly HVAC", action: archive }) as ReactElement<{
      confirming: boolean;
      action: unknown;
      onStart: () => void;
      onCancel: () => void;
    }>;
    return { element, setConfirming, archive, formAction };
  }

  test("C5353: it starts unconfirmed, Archive only asks, Cancel goes back, and nothing is archived by either", () => {
    const { element, setConfirming, archive, formAction } = control();
    expect(element.props.confirming).toBe(false);
    element.props.onStart();
    expect(setConfirming).toHaveBeenLastCalledWith(true);
    element.props.onCancel();
    expect(setConfirming).toHaveBeenLastCalledWith(false);
    expect(archive).not.toHaveBeenCalled();
    expect(formAction).not.toHaveBeenCalled();
    expect(element.props.action).toBe(formAction);
  });

  test("C5353: confirming submits the form, whose action archives that template once", async () => {
    const { archive } = control();
    const reducer = vi.mocked(react.useActionState).mock.calls.at(-1)?.[0] as unknown as (state: unknown, formData: FormData) => Promise<unknown>;
    expect(await reducer({ status: "idle" }, new FormData())).toEqual({ status: "archived" });
    expect(archive).toHaveBeenCalledTimes(1);
    expect(archive).toHaveBeenCalledWith("t-1");
  });
});
