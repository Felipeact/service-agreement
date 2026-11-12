// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let query = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }));
const checkWorkspaceAction = vi.fn(async () => "pending" as const);
vi.mock("./actions", () => ({ checkWorkspaceAction }));

const { SuccessStatus } = await import("./success-status");
const { default: Page } = await import("./page");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  query = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (element: React.ReactElement) =>
  act(async () => {
    root.render(element);
  });

describe("the success page wiring", () => {
  test("C4202: SuccessStatus reads session_id from the address and asks the real Server Action with it", async () => {
    query = "session_id=cs_test_abc";
    await mount(createElement(SuccessStatus, { fallback: createElement("p", null, "static copy") }));
    expect(checkWorkspaceAction).toHaveBeenCalledTimes(1);
    expect(checkWorkspaceAction).toHaveBeenCalledWith("cs_test_abc");
    expect(container.textContent).toContain("Setting up your workspace");
  });

  test("C4202: another query name is not a session id", async () => {
    query = "sessionId=cs_test_abc&session=cs_test_abc";
    await mount(createElement(SuccessStatus, { fallback: createElement("p", null, "static copy") }));
    expect(checkWorkspaceAction).not.toHaveBeenCalled();
    expect(container.textContent).toContain("static copy");
  });

  test("C4201: the real page with no session_id shows its own copy and the Sign in link to /login, and asks nothing", async () => {
    await mount(createElement(Page));
    expect(container.textContent).toContain("Your trial is registered.");
    expect(container.textContent).toContain("We will email a sign-in link to the address you gave at checkout.");
    // The site header has its own Sign in link; the claim is about the one under the page's heading.
    const hero = [...container.querySelectorAll("section")].find((section) => section.querySelector("h1")?.textContent === "Your trial is registered.");
    const signIn = [...(hero?.querySelectorAll("a") ?? [])].filter((a) => a.textContent?.trim() === "Sign in");
    expect(signIn).toHaveLength(1);
    expect(signIn[0].getAttribute("href")).toBe("/login");
    expect(container.textContent).not.toContain("Setting up your workspace");
    expect(checkWorkspaceAction).not.toHaveBeenCalled();
  });

  test("C4201: the page rendered on the server (no client hooks) is the same static copy", () => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain("Your trial is registered.");
    const hero = html.slice(html.indexOf("Your trial is registered."), html.indexOf("If the email does not arrive"));
    expect(hero).toMatch(/<a\b[^>]*href="\/login"[^>]*>\s*Sign in\s*<\/a>/);
  });
});
