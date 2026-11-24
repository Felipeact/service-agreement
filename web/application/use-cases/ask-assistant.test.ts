import { describe, expect, test, vi } from "vitest";
import { DAILY_QUESTION_LIMIT, LIMIT_MESSAGE } from "@/domain/assistant";
import { makeAskAssistant } from "./ask-assistant";

function setup(over: { asked?: number; text?: string | null } = {}) {
  const ask = vi.fn(async () => (over.text === undefined ? JSON.stringify({ answer: "Fine.", actionKind: "none", actionTarget: "", actionLabel: "" }) : over.text));
  const record = vi.fn(async () => undefined);
  const list = vi.fn(async () => [{ id: "a1", number: "SA-1", status: "draft", stage: null, site: "Main", customer: "Maple", versionNo: 1, annualCents: 1000, updatedAt: "", termEnd: null }]);
  const listActive = vi.fn(async () => [{ id: "s1", name: "Main", customerId: "c1", customer: "Maple", liveAgreement: null }]);
  const run = makeAskAssistant({
    agreements: { list } as never,
    sites: { listActive } as never,
    model: { ask },
    usage: { countSince: async () => over.asked ?? 0, record },
    now: () => new Date("2026-11-24T12:00:00Z"),
    today: () => "2026-11-24",
  });
  return { run, ask, record };
}
const input = { question: "How many drafts?", page: "/pipeline", history: [], orgId: "org", canAct: true };

describe("Ask AI use case", () => {
  test("answers from the member's facts and counts the question", async () => {
    const { run, ask, record } = setup();
    const result = await run(input);
    expect(result).toMatchObject({ ok: true, left: DAILY_QUESTION_LIMIT - 1 });
    expect(record).toHaveBeenCalledWith("org");
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ page: "/pipeline", today: "2026-11-24", question: "How many drafts?" }));
  });

  test("past the daily limit the model is never asked", async () => {
    const { run, ask, record } = setup({ asked: DAILY_QUESTION_LIMIT });
    expect(await run(input)).toEqual({ ok: false, error: LIMIT_MESSAGE });
    expect(ask).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  test("a model that fails or answers badly is unavailable, and still costs a question", async () => {
    const failed = setup({ text: null });
    expect((await failed.run(input)).ok).toBe(false);
    expect(failed.record).toHaveBeenCalled();
    expect((await setup({ text: "not json" }).run(input)).ok).toBe(false);
  });

  test("a blank question asks nothing", async () => {
    const { run, ask } = setup();
    expect((await run({ ...input, question: " " })).ok).toBe(false);
    expect(ask).not.toHaveBeenCalled();
  });
});
