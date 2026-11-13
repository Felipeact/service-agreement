// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { WorkspaceAnswer } from "@/domain/billing/workspace-state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { WorkspaceStatus } = await import("./status-panel");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const FALLBACK = createElement("p", null, "Your trial is registered. We will email a sign-in link.");

const mount = (sessionId: string | null, check: (id: string) => Promise<WorkspaceAnswer>) =>
  act(async () => {
    root.render(createElement(WorkspaceStatus, { sessionId, check, fallback: FALLBACK }));
  });
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const text = () => container.textContent ?? "";
const link = (label: string) => [...container.querySelectorAll("a")].find((a) => a.textContent?.trim() === label);

describe("the workspace status panel", () => {
  test("C4201: with no session id it shows the static copy and never asks", async () => {
    const check = vi.fn(async (): Promise<WorkspaceAnswer> => "ready");
    await mount(null, check);
    await tick(60_000);
    expect(text()).toContain("Your trial is registered.");
    expect(text()).not.toContain("Setting up your workspace");
    expect(check).not.toHaveBeenCalled();
  });

  test("C4202: with a session id it says it is setting up and asks once, at once, with that id", async () => {
    const check = vi.fn(async (): Promise<WorkspaceAnswer> => "pending");
    await mount("cs_test_1", check);
    expect(text()).toContain("Setting up your workspace");
    expect(text()).not.toContain("Your trial is registered.");
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith("cs_test_1");
  });

  test("C4203: ready says the workspace is ready, offers Sign in to /login and stops asking", async () => {
    const check = vi.fn(async (): Promise<WorkspaceAnswer> => "ready");
    await mount("cs_test_1", check);
    expect(text()).toContain("Your workspace is ready.");
    expect(text()).toContain("We emailed a sign-in link");
    expect(link("Sign in")?.getAttribute("href")).toBe("/login");
    await tick(60_000);
    expect(check).toHaveBeenCalledTimes(1);
  });

  test("C4204: refused says it could not be set up, links to /contact, shows no code and stops asking", async () => {
    const check = vi.fn(async (): Promise<WorkspaceAnswer> => "refused");
    await mount("cs_test_1", check);
    expect(text()).toContain("We could not set up your workspace.");
    expect(link("Contact us")?.getAttribute("href")).toBe("/contact");
    expect(text()).not.toContain("email_in_use");
    expect(text()).not.toContain("invalid_metadata");
    await tick(60_000);
    expect(check).toHaveBeenCalledTimes(1);
  });

  test("C4204: a pending answer that turns ready after a few asks shows ready", async () => {
    const answers: WorkspaceAnswer[] = ["pending", "pending", "ready"];
    const check = vi.fn(async () => answers.shift() ?? "ready");
    await mount("cs_test_1", check);
    await tick(3000);
    await tick(3000);
    expect(check).toHaveBeenCalledTimes(3);
    expect(text()).toContain("Your workspace is ready.");
  });

  test("C4205: pending is asked again every 3000 ms, 20 times in all and never a 21st", async () => {
    const check = vi.fn(async (): Promise<WorkspaceAnswer> => "pending");
    await mount("cs_test_1", check);
    expect(check).toHaveBeenCalledTimes(1);
    await tick(2999);
    expect(check).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(check).toHaveBeenCalledTimes(2);
    await tick(3000 * 40);
    expect(check).toHaveBeenCalledTimes(20);
  });

  test("C4206: after 20 pending answers it says it is taking longer than usual with Sign in and Contact us links", async () => {
    const check = vi.fn(async (): Promise<WorkspaceAnswer> => "pending");
    await mount("cs_test_1", check);
    await tick(3000 * 18);
    expect(check).toHaveBeenCalledTimes(19);
    expect(text()).toContain("Setting up your workspace");
    await tick(3000);
    expect(check).toHaveBeenCalledTimes(20);
    expect(text()).toContain("This is taking longer than usual.");
    expect(link("Sign in")?.getAttribute("href")).toBe("/login");
    expect(link("Contact us")?.getAttribute("href")).toBe("/contact");
  });

  test.each([
    ["rejects", async (): Promise<WorkspaceAnswer> => Promise.reject(new Error("down"))],
    ["answers unavailable", async (): Promise<WorkspaceAnswer> => "unavailable"],
  ])("C4207: when the action %s it shows the taking-longer wording, stops asking and does not throw", async (_name, impl) => {
    const check = vi.fn(impl);
    await mount("cs_test_1", check);
    expect(text()).toContain("This is taking longer than usual.");
    expect(link("Sign in")).toBeTruthy();
    await tick(60_000);
    expect(check).toHaveBeenCalledTimes(1);
  });

  test("C4205: leaving the page stops the asking", async () => {
    const check = vi.fn(async (): Promise<WorkspaceAnswer> => "pending");
    await mount("cs_test_1", check);
    act(() => root.unmount());
    await tick(60_000);
    expect(check).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });
});
