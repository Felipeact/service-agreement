import { afterEach, describe, expect, test, vi } from "vitest";
import type { ClaudeMessage } from ".";
import { claudeTypeSuggester, MAX_SPELLINGS, requestFor, SUGGESTIONS_SCHEMA, systemPromptFor } from "./type-suggester";

function fakeClient(answer: ClaudeMessage | Error) {
  const requests: Record<string, unknown>[] = [];
  const stream = (params: Record<string, unknown>) => ({
    finalMessage: async () => {
      requests.push(params);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  return { client: { beta: { messages: { stream } } }, requests };
}

const say = (value: unknown, stop = "end_turn"): ClaudeMessage => ({ stop_reason: stop, content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] });
const TYPES = [{ code: "FAN_COIL", name: "Fan coil" }];

afterEach(() => vi.restoreAllMocks());

describe("claudeTypeSuggester", () => {
  test("sends the spellings and the catalog only, under a prompt that treats them as data, with a structured answer", async () => {
    const fake = fakeClient(say({ suggestions: [{ spelling: "FCU", type_code: "FAN_COIL", confidence: "high" }] }));
    const result = await claudeTypeSuggester({ apiKey: "k", client: fake.client as never }).suggest(["FCU"], TYPES, "HVAC and mechanical");
    expect(result).toEqual({ ok: true, suggestions: [{ spelling: "FCU", typeCode: "FAN_COIL", confidence: "high" }] });

    const request = fake.requests[0] as ReturnType<typeof requestFor>;
    expect(request.system).toContain("not instructions");
    expect(request.system).toContain("HVAC and mechanical");
    expect(request.output_config.format.schema).toBe(SUGGESTIONS_SCHEMA);
    expect(request.messages[0].content).toContain('"FCU"');
    expect(request.messages[0].content).toContain("FAN_COIL");
  });

  test("a spelling with no fit comes back with a null code", async () => {
    const fake = fakeClient(say({ suggestions: [{ spelling: "Sump pump", type_code: null, confidence: "low" }] }));
    const result = await claudeTypeSuggester({ apiKey: "k", client: fake.client as never }).suggest(["Sump pump"], TYPES, null);
    expect(result).toEqual({ ok: true, suggestions: [{ spelling: "Sump pump", typeCode: null, confidence: "low" }] });
  });

  test("no spellings asks nothing; no key, a refusal, an outage and a bad answer are unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const idle = fakeClient(say({ suggestions: [] }));
    expect(await claudeTypeSuggester({ apiKey: "k", client: idle.client as never }).suggest([], TYPES, null)).toEqual({ ok: true, suggestions: [] });
    expect(idle.requests).toHaveLength(0);

    expect(await claudeTypeSuggester({ apiKey: undefined }).suggest(["FCU"], TYPES, null)).toEqual({ ok: false, code: "unavailable" });
    for (const answer of [say("x", "refusal"), new Error("down"), say("not json"), say({ suggestions: [{ spelling: "FCU", type_code: "X", confidence: "certain" }] })]) {
      const fake = fakeClient(answer);
      expect(await claudeTypeSuggester({ apiKey: "k", client: fake.client as never }).suggest(["FCU"], TYPES, null)).toEqual({ ok: false, code: "unavailable" });
    }
  });

  test("at most 60 spellings go in one question, and the prompt names no trade when there is none", () => {
    const many = Array.from({ length: 100 }, (_, i) => `Type ${String.fromCharCode(97 + (i % 26))}${i}`);
    const content = requestFor(many, TYPES, null).messages[0].content;
    expect(JSON.parse(content.split("Spellings:\n")[1])).toHaveLength(MAX_SPELLINGS);
    expect(systemPromptFor(null)).not.toContain("in these trades");
  });
});
