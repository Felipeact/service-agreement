import { describe, expect, test, vi } from "vitest";
import { AI_TOOLS } from "@/domain/ai-tools";
import { handleMcpMessage, serverIcons, type McpTools } from "./protocol";

const tools = (): McpTools => ({ list: () => [...AI_TOOLS], call: vi.fn(async () => ({ ok: true, data: { hello: "world" } }) as const) });

describe("handleMcpMessage", () => {
  test("initialize agrees a version it speaks and falls back to the newest", async () => {
    const asked = await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, tools());
    expect(asked).toMatchObject({ id: 1, result: { protocolVersion: "2025-03-26", serverInfo: { name: "service-pacts" } } });
    const other = await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }, tools());
    expect(other).toMatchObject({ result: { protocolVersion: "2025-06-18" } });
  });

  test("a notification gets no answer", async () => {
    expect(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, tools())).toBeNull();
  });

  test("tools/list marks reads read-only", async () => {
    const answer = (await handleMcpMessage({ jsonrpc: "2.0", id: 3, method: "tools/list" }, tools())) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] } };
    expect(answer.result.tools.find((tool) => tool.name === "search_customers")?.annotations.readOnlyHint).toBe(true);
    expect(answer.result.tools.find((tool) => tool.name === "create_agreement_draft")?.annotations.readOnlyHint).toBe(false);
  });

  test("tools/call returns the result as text, and a failure as isError", async () => {
    const ok = await handleMcpMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "who_am_i" } }, tools());
    expect(ok).toMatchObject({ result: { isError: false, content: [{ type: "text", text: '{"hello":"world"}' }] } });
    const failing: McpTools = { list: () => [], call: async () => ({ ok: false, error: "nope" }) };
    expect(await handleMcpMessage({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "x" } }, failing)).toMatchObject({ result: { isError: true } });
  });

  test("malformed and unknown messages are JSON-RPC errors, not throws", async () => {
    expect(await handleMcpMessage([], tools())).toMatchObject({ error: { code: -32600 } });
    expect(await handleMcpMessage({ jsonrpc: "2.0", id: 6, method: "tools/call", params: {} }, tools())).toMatchObject({ error: { code: -32602 } });
    expect(await handleMcpMessage({ jsonrpc: "2.0", id: 7, method: "resources/list" }, tools())).toMatchObject({ error: { code: -32601 } });
  });
});

describe("the server's icon", () => {
  const tools = { list: () => [], call: async () => ({ ok: true as const, data: {} }) };

  test("initialize carries the icons and the website when the endpoint provides them", async () => {
    const answer = (await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, { ...tools, icons: serverIcons("https://servicepacts.com/"), websiteUrl: "https://servicepacts.com" })) as { result: { serverInfo: Record<string, unknown> } };
    expect(answer.result.serverInfo).toMatchObject({ name: "service-pacts", title: "Service Pacts", websiteUrl: "https://servicepacts.com" });
    expect(answer.result.serverInfo.icons).toEqual([
      { src: "https://servicepacts.com/brand/mcp-icon-512.png", mimeType: "image/png", sizes: ["512x512"] },
      { src: "https://servicepacts.com/brand/mcp-icon-192.png", mimeType: "image/png", sizes: ["192x192"] },
      { src: "https://servicepacts.com/brand/mark.svg", mimeType: "image/svg+xml", sizes: ["any"] },
    ]);
  });

  test("without icons the server info is what it was", async () => {
    const answer = (await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, tools)) as { result: { serverInfo: Record<string, unknown> } };
    expect(answer.result.serverInfo).toEqual({ name: "service-pacts", title: "Service Pacts", version: "1.0.0" });
  });
});
