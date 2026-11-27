import { describe, expect, test, vi } from "vitest";
import type { AgreementStore, ToolAudit } from "@/application/ports";
import { makeRunAiTool, type ToolCaller } from "./run-ai-tool";

const SITE = "3f2b8a52-6c1e-4d52-9a1c-0b7d6e4f1a10";
const reader: ToolCaller = { userId: "u1", email: "a@b.ca", orgName: "Acme HVAC", role: "viewer", canWrite: false };
const estimator: ToolCaller = { ...reader, role: "estimator", canWrite: true };

function setup({ writesEnabled = true, create = vi.fn(async () => ({ ok: true, id: "ag-1" }) as const) } = {}) {
  const audit: ToolAudit = { record: vi.fn(async () => undefined) };
  const customers = { list: vi.fn(async () => [{ id: "c1", name: "Northside School", primaryContact: "Pat", primaryEmail: null, primaryPhone: null, agreementNumbers: ["AG-1001"], agreementCount: 1, active: true, siteCount: 1, assetCount: 2, annualCents: 123456, primaryContactId: null }]), detail: vi.fn(async () => null), contact: vi.fn(async () => null) };
  const agreementStore = { create, setTemplate: vi.fn() } as unknown as AgreementStore;
  const tools = makeRunAiTool({
    agreements: { list: vi.fn(async () => []) },
    agreementReader: { get: vi.fn(async () => null) },
    agreementStore,
    customers,
    records: { search: vi.fn() },
    reports: {} as never,
    generateServiceLines: vi.fn(async () => ({ ok: true, added: 2 }) as const),
    audit,
    today: () => "2026-11-27",
    writesEnabled,
    source: "mcp",
  });
  return { tools, audit, create };
}

describe("runTool", () => {
  test("a read runs for a viewer and answers dollars, not cents", async () => {
    const { tools } = setup();
    const result = await tools.runTool("search_customers", { query: "north" }, reader);
    expect(result).toMatchObject({ ok: true, data: { count: 1, customers: [{ name: "Northside School", yearlyValueCad: 1234.56 }] } });
  });

  test("a viewer cannot create a draft and the store is never called", async () => {
    const { tools, create } = setup();
    expect((await tools.runTool("create_agreement_draft", { site_id: SITE }, reader)).ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  test("an estimator can, unless the write switch is off", async () => {
    const on = setup();
    expect(await on.tools.runTool("create_agreement_draft", { site_id: SITE }, estimator)).toMatchObject({ ok: true, data: { agreementId: "ag-1", status: "draft" } });
    const off = setup({ writesEnabled: false });
    expect((await off.tools.runTool("create_agreement_draft", { site_id: SITE }, estimator)).ok).toBe(false);
    expect(off.create).not.toHaveBeenCalled();
  });

  test("a model-supplied org is refused before anything runs", async () => {
    const { tools, create } = setup();
    expect((await tools.runTool("create_agreement_draft", { site_id: SITE, org_id: "other" }, estimator)).ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  test("the plan limit and an existing live agreement come back as plain messages", async () => {
    const { tools } = setup({ create: vi.fn(async () => ({ ok: false, code: "plan_limit", plan: "starter", limit: 15, used: 15 }) as const) as never });
    expect(await tools.runTool("create_agreement_draft", { site_id: SITE }, estimator)).toEqual({ ok: false, error: "The starter plan's limit of 15 live agreements is reached." });
  });

  test("every call is audited by tool and outcome, never its arguments", async () => {
    const { tools, audit } = setup();
    await tools.runTool("search_customers", { query: "secret-name" }, reader);
    await tools.runTool("nope", {}, reader);
    expect(audit.record).toHaveBeenNthCalledWith(1, { tool: "search_customers", source: "mcp", ok: true });
    expect(audit.record).toHaveBeenNthCalledWith(2, { tool: "unknown", source: "mcp", ok: false });
  });

  test("a failing audit write does not fail the call, and a thrown read becomes a safe message", async () => {
    const { tools, audit } = setup();
    vi.mocked(audit.record).mockRejectedValueOnce(new Error("down"));
    expect((await tools.runTool("who_am_i", {}, reader)).ok).toBe(true);
    const failing = makeRunAiTool({
      agreements: {
        list: async () => {
          throw new Error("db");
        },
      },
      audit,
      today: () => "2026-11-27",
      writesEnabled: true,
      source: "mcp",
    } as never);
    expect(await failing.runTool("search_agreements", {}, reader)).toEqual({ ok: false, error: "That could not be read right now. Try again in a moment." });
  });

  test("a viewer is not shown the write tools", () => {
    const { tools } = setup();
    expect(tools.toolsFor(reader).some((tool) => tool.access === "write")).toBe(false);
    expect(tools.toolsFor(estimator).filter((tool) => tool.access === "write")).toHaveLength(2);
  });
});
