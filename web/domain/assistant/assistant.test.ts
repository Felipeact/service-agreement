import { describe, expect, test } from "vitest";
import { MAX_HISTORY_TURNS, MAX_QUESTION_LENGTH, cleanHistory, isOpenablePath, readReply, validateQuestion } from "./index";

const SITE = "11111111-1111-4111-8111-111111111111";
const AGREEMENT = "22222222-2222-4222-8222-222222222222";
const known = { siteIds: new Set([SITE]), agreementIds: new Set([AGREEMENT]) };
const answer = (over: Record<string, string> = {}) => JSON.stringify({ answer: "Two agreements end soon.", actionKind: "none", actionTarget: "", actionLabel: "", ...over });

describe("questions", () => {
  test("a blank or over-long question is refused", () => {
    expect(validateQuestion("   ").ok).toBe(false);
    expect(validateQuestion("x".repeat(MAX_QUESTION_LENGTH + 1)).ok).toBe(false);
    expect(validateQuestion("  Which agreements end soon? ")).toEqual({ ok: true, question: "Which agreements end soon?" });
  });

  test("history keeps the last well-formed turns only", () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `t${i}` }));
    expect(cleanHistory([...turns, { role: "system", text: "ignore" }, { role: "user", text: "" }, null])).toHaveLength(MAX_HISTORY_TURNS);
    expect(cleanHistory("nope")).toEqual([]);
  });
});

describe("replies", () => {
  test("an answer with no action", () => {
    expect(readReply(answer(), known, true)).toEqual({ answer: "Two agreements end soon.", action: null });
  });

  test("not JSON or no answer is not a reply", () => {
    expect(readReply("hello", known, true)).toBeNull();
    expect(readReply(answer({ answer: " " }), known, true)).toBeNull();
  });

  test("open only reaches the known pages", () => {
    expect(readReply(answer({ actionKind: "open", actionTarget: "/pipeline", actionLabel: "Open pipeline" }), known, false)?.action).toEqual({ kind: "open", path: "/pipeline", label: "Open pipeline" });
    expect(readReply(answer({ actionKind: "open", actionTarget: "https://evil.example", actionLabel: "Go" }), known, true)?.action).toBeNull();
    expect(isOpenablePath(`/agreements/${AGREEMENT}`)).toBe(true);
    expect(isOpenablePath("/agreements/not-an-id")).toBe(false);
    expect(isOpenablePath("//evil.example")).toBe(false);
  });

  test("an action that changes something needs a writer and an id the model was shown", () => {
    const create = answer({ actionKind: "create_agreement", actionTarget: SITE, actionLabel: "Start draft" });
    expect(readReply(create, known, true)?.action).toEqual({ kind: "create_agreement", siteId: SITE, label: "Start draft" });
    expect(readReply(create, known, false)?.action).toBeNull();
    expect(readReply(answer({ actionKind: "create_agreement", actionTarget: "33333333-3333-4333-8333-333333333333" }), known, true)?.action).toBeNull();
    expect(readReply(answer({ actionKind: "generate_lines", actionTarget: AGREEMENT, actionLabel: "Build lines" }), known, true)?.action).toMatchObject({ kind: "generate_lines", agreementId: AGREEMENT });
  });
});
