import { describe, expect, test } from "vitest";
import { AI_TOOLS, mayRunTool, parseToolCall } from "./index";

const ID = "3f2b8a52-6c1e-4d52-9a1c-0b7d6e4f1a10";

describe("tool catalogue", () => {
  test("every tool has a strict schema and a unique name", () => {
    expect(new Set(AI_TOOLS.map((tool) => tool.name)).size).toBe(AI_TOOLS.length);
    for (const tool of AI_TOOLS) expect(tool.inputSchema.additionalProperties).toBe(false);
  });

  test("the writes only add records and start drafts; nothing sends or cancels", () => {
    expect(AI_TOOLS.filter((tool) => tool.access === "write").map((tool) => tool.name)).toEqual(["create_customer", "create_site", "add_equipment", "create_agreement_draft", "generate_service_lines"]);
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

describe("customer, site and equipment tools", () => {
  const SITE = "3f2b8a52-6c1e-4d52-9a1c-0b7d6e4f1a10";
  test("create_customer needs a name and tells the model to ask the user for it", () => {
    expect(parseToolCall("create_customer", {})).toMatchObject({ ok: false, error: expect.stringContaining("Ask the user") });
    expect(parseToolCall("create_customer", { name: "Chinatown BBQ", contact_email: "nope" })).toMatchObject({ ok: false });
    expect(parseToolCall("create_customer", { name: " Chinatown BBQ ", contact_name: "Lee", contact_email: "lee@bbq.ca" })).toEqual({
      ok: true,
      call: { tool: "create_customer", name: "Chinatown BBQ", contactName: "Lee", contactEmail: "lee@bbq.ca", contactPhone: null },
    });
  });

  test("create_site needs a customer id and a name, and says to ask the user for the name", () => {
    expect(parseToolCall("create_site", { customer_id: SITE })).toMatchObject({ ok: false, error: expect.stringContaining("Ask the user what to call this site") });
    expect(parseToolCall("create_site", { name: "Pender" })).toMatchObject({ ok: false });
    expect(parseToolCall("create_site", { customer_id: SITE, name: "Pender", address: "130 E Pender St", org_id: "x" })).toMatchObject({ ok: false });
    expect(parseToolCall("create_site", { customer_id: SITE, name: "Pender", address: "130 E Pender St" })).toEqual({ ok: true, call: { tool: "create_site", customerId: SITE, name: "Pender", address: "130 E Pender St" } });
  });

  test("add_equipment folds make, model and serial into type/model and leaves placeholders empty", () => {
    const parsed = parseToolCall("add_equipment", {
      site_id: SITE,
      units: [
        { type: "Carrier rooftop unit", make_model: "Carrier 48TCEA07C2A5A0F0A1", serial_number: "1514C89048", location: "Roof" },
        { type: "Make-up air unit", make_model: "Captive Aire A2-D.500-G15", serial_number: "?", unit_no: "N/A" },
      ],
    });
    expect(parsed).toEqual({
      ok: true,
      call: {
        tool: "add_equipment",
        siteId: SITE,
        units: [
          { type: "Carrier rooftop unit", unitNo: null, typeModel: "Carrier 48TCEA07C2A5A0F0A1 S/N 1514C89048", location: "Roof" },
          { type: "Make-up air unit", unitNo: null, typeModel: "Captive Aire A2-D.500-G15", location: null },
        ],
      },
    });
  });

  test("add_equipment refuses no units, too many, a unit without a type, and a stray or org field inside a unit", () => {
    expect(parseToolCall("add_equipment", { site_id: SITE, units: [] }).ok).toBe(false);
    expect(parseToolCall("add_equipment", { site_id: SITE, units: Array.from({ length: 61 }, () => ({ type: "Fan" })) })).toMatchObject({ ok: false, error: expect.stringContaining("at most 60") });
    expect(parseToolCall("add_equipment", { site_id: SITE, units: [{ unit_no: "1" }] })).toMatchObject({ ok: false, error: expect.stringContaining("type is required") });
    expect(parseToolCall("add_equipment", { site_id: SITE, units: [{ type: "Fan", org_id: "other" }] })).toMatchObject({ ok: false });
    expect(parseToolCall("add_equipment", { site_id: "nope", units: [{ type: "Fan" }] }).ok).toBe(false);
  });

  test("the write tools tell the model to ask the user and name the next step", () => {
    const text = (name: string) => AI_TOOLS.find((tool) => tool.name === name)?.description ?? "";
    expect(text("create_site")).toMatch(/ASK the user/);
    expect(text("create_customer")).toMatch(/ASK/);
    expect(text("add_equipment")).toMatch(/CREATES a new type/);
    expect(text("add_equipment")).toMatch(/generate_service_lines/);
  });
});
