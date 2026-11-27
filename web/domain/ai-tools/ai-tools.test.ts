import { describe, expect, test } from "vitest";
import { AI_TOOLS, mayRunTool, parseToolCall } from "./index";

const ID = "3f2b8a52-6c1e-4d52-9a1c-0b7d6e4f1a10";

describe("tool catalogue", () => {
  test("every tool has a strict schema and a unique name", () => {
    expect(new Set(AI_TOOLS.map((tool) => tool.name)).size).toBe(AI_TOOLS.length);
    for (const tool of AI_TOOLS) expect(tool.inputSchema.additionalProperties).toBe(false);
  });

  test("only the two draft tools write; nothing sends or cancels", () => {
    expect(AI_TOOLS.filter((tool) => tool.access === "write").map((tool) => tool.name)).toEqual(["create_agreement_draft", "generate_service_lines"]);
    expect(AI_TOOLS.some((tool) => /send|cancel|price/.test(tool.name))).toBe(false);
  });
});

describe("parseToolCall", () => {
  test.each(["org_id", "organization_id", "user_id", "role", "is_admin"])("refuses %s as an argument, so a model cannot name its own authority", (key) => {
    const parsed = parseToolCall("search_customers", { [key]: "x" });
    expect(parsed.ok).toBe(false);
  });

  test("refuses an unknown tool, a non-object and an array", () => {
    expect(parseToolCall("drop_table", {}).ok).toBe(false);
    expect(parseToolCall("who_am_i", "x").ok).toBe(false);
    expect(parseToolCall("who_am_i", []).ok).toBe(false);
  });

  test("defaults and bounds the result count", () => {
    expect(parseToolCall("search_customers", {})).toEqual({ ok: true, call: { tool: "search_customers", query: "", limit: 10 } });
    expect(parseToolCall("search_customers", { limit: 26 }).ok).toBe(false);
    expect(parseToolCall("search_customers", { limit: 1.5 }).ok).toBe(false);
  });

  test("refuses an over-long query and a malformed id", () => {
    expect(parseToolCall("search_customers", { query: "a".repeat(101) }).ok).toBe(false);
    expect(parseToolCall("get_customer", { customer_id: "1; drop table customers" }).ok).toBe(false);
    expect(parseToolCall("get_customer", { customer_id: ID })).toEqual({ ok: true, call: { tool: "get_customer", customerId: ID } });
  });

  test("checks the status filter, the expiry window and the date range", () => {
    expect(parseToolCall("search_agreements", { status: "nonsense" }).ok).toBe(false);
    expect(parseToolCall("search_agreements", { status: "sent", expiring_soon: "yes" }).ok).toBe(false);
    expect(parseToolCall("get_expiring_agreements", { within_days: 45 }).ok).toBe(false);
    expect(parseToolCall("get_expiring_agreements", {})).toEqual({ ok: true, call: { tool: "get_expiring_agreements", withinDays: 90 } });
    expect(parseToolCall("get_revenue_summary", { from: "2026-02-30" }).ok).toBe(false);
    expect(parseToolCall("get_revenue_summary", { from: "2026-05-02", to: "2026-05-01" }).ok).toBe(false);
  });
});

describe("mayRunTool", () => {
  test("reads are open to every role; writes need the role and the switch", () => {
    expect(mayRunTool("read", false, false)).toBe(true);
    expect(mayRunTool("write", false, true)).toBe(false);
    expect(mayRunTool("write", true, false)).toBe(false);
    expect(mayRunTool("write", true, true)).toBe(true);
  });
});
