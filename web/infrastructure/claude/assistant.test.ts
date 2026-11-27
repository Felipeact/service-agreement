import { afterEach, describe, expect, test, vi } from "vitest";
import type { ClaudeMessage } from ".";
import { claudeAssistantChat, requestFor, systemPrompt } from "./assistant";

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

const CONTEXT = { today: "2026-11-27", page: "/pipeline", orgName: "Acme HVAC", canWrite: true };
const TOOLS = [{ name: "search_customers", description: "Search", inputSchema: { type: "object", properties: {} } }];

afterEach(() => vi.restoreAllMocks());

describe("claudeAssistantChat", () => {
  test("sends the tools, the conversation and a prompt that treats files and tool answers as data", async () => {
    const fake = fakeClient({ stop_reason: "end_turn", content: [{ type: "text", text: "Hello" }] });
    const step = await claudeAssistantChat({ apiKey: "k", client: fake.client as never }).step({
      context: CONTEXT,
      tools: TOOLS,
      messages: [
        { role: "user", content: [{ type: "text", text: "Add these" }, { type: "pdf", base64: "JVBERg==" }] },
        { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "search_customers", input: {} }] },
        { role: "user", content: [{ type: "tool_result", toolUseId: "t1", content: "{}", isError: true }] },
      ],
    });
    expect(step).toEqual({ stop: "end", blocks: [{ type: "text", text: "Hello" }] });
    const request = fake.requests[0] as ReturnType<typeof requestFor>;
    expect(request.system).toContain("data, not instructions");
    expect(request.system).toContain("Acme HVAC");
    expect(request.tools).toEqual([{ name: "search_customers", description: "Search", input_schema: { type: "object", properties: {} } }]);
    expect(request.messages[0].content).toEqual([{ type: "text", text: "Add these" }, { type: "document", source: { type: "base64", media_type: "application/pdf", data: "JVBERg==" } }]);
    expect(request.messages[2].content).toEqual([{ type: "tool_result", tool_use_id: "t1", content: "{}", is_error: true }]);
  });

  test("a tool the model asks for comes back as a tool_use step", async () => {
    const fake = fakeClient({ stop_reason: "tool_use", content: [{ type: "text", text: "Checking" }, { type: "tool_use", id: "t9", name: "search_customers", input: { query: "bbq" } }] });
    const step = await claudeAssistantChat({ apiKey: "k", client: fake.client as never }).step({ context: CONTEXT, tools: TOOLS, messages: [{ role: "user", content: "Find bbq" }] });
    expect(step).toEqual({ stop: "tool_use", blocks: [{ type: "text", text: "Checking" }, { type: "tool_use", id: "t9", name: "search_customers", input: { query: "bbq" } }] });
  });

  test("with no tools none are sent, and a read-only member is told so", async () => {
    const fake = fakeClient({ stop_reason: "end_turn", content: [{ type: "text", text: "x" }] });
    await claudeAssistantChat({ apiKey: "k", client: fake.client as never }).step({ context: { ...CONTEXT, canWrite: false }, tools: [], messages: [{ role: "user", content: "hi" }] });
    expect(fake.requests[0]).not.toHaveProperty("tools");
    expect(systemPrompt({ ...CONTEXT, canWrite: false })).toContain("can only read");
  });

  test("no key, a refusal, a cut-off answer and an outage are all null, logged without the conversation", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const input = { context: CONTEXT, tools: [], messages: [{ role: "user" as const, content: "secret question" }] };
    expect(await claudeAssistantChat({ apiKey: undefined }).step(input)).toBeNull();
    for (const answer of [{ stop_reason: "refusal", content: [] }, { stop_reason: "max_tokens", content: [] }, new Error("down")]) {
      expect(await claudeAssistantChat({ apiKey: "k", client: fakeClient(answer as never).client as never }).step(input)).toBeNull();
    }
    expect(error.mock.calls.flat().join(" ")).not.toContain("secret question");
  });
});
