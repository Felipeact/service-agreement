import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DecisionPanel } from "./decision-controls";
import type { DecideState } from "./state";

const { effects } = vi.hoisted(() => ({ effects: [] as (() => void)[] }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void) => effects.push(effect),
  useRef: <T,>(value: T) => ({ current: value }),
}));

const { ViewRecorder } = await import("./view-recorder");

const primary = { backgroundColor: "#1f6f8b", color: "#ffffff" };
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

function panel(mode: "choose" | "accept" | "refuse" | "request_changes", state: DecideState = { status: "idle" }, reason = "") {
  return renderToStaticMarkup(createElement(DecisionPanel, { mode, reason, state, tenantName: "Kettle Ridge Mechanical Ltd.", primary }));
}

describe("the decision panel", () => {
  test("C918: choosing shows the three controls at 44px below desktop and nothing else", () => {
    const html = panel("choose");
    for (const label of ["Accept", "Refuse", "Request changes"]) expect(html).toMatch(new RegExp(`<button[^>]*h-11[^>]*>${label}</button>`));
    expect(html).not.toContain("<textarea");
  });

  test("C918: Accept asks for a confirmation, with Accept and Cancel", () => {
    const html = panel("accept");
    expect(text(html)).toContain("Accept this agreement?");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Accept<\/button>/);
    expect(html).toMatch(/<button[^>]*>Cancel<\/button>/);
    expect(html).not.toContain("<textarea");
  });

  test.each([
    ["refuse", "Refuse", "Why are you refusing this agreement?"],
    ["request_changes", "Request changes", "What would you like changed?"],
  ] as const)("C921: %s asks for a reason, with a submit button %s", (mode, label, question) => {
    const html = panel(mode);
    expect(text(html)).toContain(question);
    expect(html).toContain("<textarea");
    expect(html).toMatch(new RegExp(`<button[^>]*type="submit"[^>]*>${label}</button>`));
  });

  test.each(["refuse", "request_changes"] as const)("C921: a missing reason shows the message beside the field in %s", (mode) => {
    const html = panel(mode, { status: "reason_required" });
    expect(text(html)).toContain("Tell us why so Kettle Ridge Mechanical Ltd. can respond.");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
  });

  test.each(["refuse", "request_changes"] as const)("C922: a reason over 2000 keeps the typed text and shows the count in %s", (mode) => {
    const typed = "x".repeat(2015);
    const html = panel(mode, { status: "reason_too_long" }, typed);
    expect(html).toContain(typed);
    expect(text(html)).toContain("2015 of 2000 characters");
    expect(text(html)).toContain("Keep it to 2000 characters or fewer. You typed 2015.");
  });

  test("C922: the count is shown while typing, before any error", () => {
    expect(text(panel("refuse", { status: "idle" }, "Too dear"))).toContain("8 of 2000 characters");
  });

  test("C923: a link that is no longer open says to reload", () => {
    expect(text(panel("choose", { status: "not_open", state: "decided" }))).toContain("Reload the page");
  });

  test("C919: a failed send says to try again", () => {
    expect(text(panel("accept", { status: "unavailable" }))).toContain("We couldn't send your answer. Try again.");
  });
});

describe("the view recorder", () => {
  beforeEach(() => {
    effects.length = 0;
  });

  test("C929: it calls the record action once, however many times the effect runs", () => {
    const record = vi.fn(async () => ({ status: "ok" }));
    ViewRecorder({ record });
    expect(effects).toHaveLength(1);
    effects[0]();
    effects[0]();
    expect(record).toHaveBeenCalledTimes(1);
  });

  test("C929: a rejected record is swallowed", async () => {
    const record = vi.fn(async () => {
      throw new Error("offline");
    });
    ViewRecorder({ record });
    expect(() => effects[0]()).not.toThrow();
    await Promise.resolve();
  });
});
