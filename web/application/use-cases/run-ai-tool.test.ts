import { describe, expect, test, vi } from "vitest";
import type { AgreementStore, ToolAudit } from "@/application/ports";
import { makeRunAiTool, type ToolCaller } from "./run-ai-tool";

const SITE = "3f2b8a52-6c1e-4d52-9a1c-0b7d6e4f1a10";
const reader: ToolCaller = { userId: "u1", orgId: "org-1", email: "a@b.ca", orgName: "Acme HVAC", role: "viewer", canWrite: false, plan: "business" };
const estimator: ToolCaller = { ...reader, role: "estimator", canWrite: true };

const stores = {
  customerStore: { create: vi.fn(async () => ({ ok: true, id: "c-new" }) as const), update: vi.fn(), setActive: vi.fn() },
  contactStore: { create: vi.fn(async () => ({ ok: true, id: "ct-1" }) as const), update: vi.fn(), delete: vi.fn() },
  siteStore: { create: vi.fn(async () => ({ ok: true, id: "s-new" }) as const), update: vi.fn(), setActive: vi.fn() },
  assetStore: { create: vi.fn(async () => ({ ok: true, id: "a-new" }) as const), update: vi.fn(), setActive: vi.fn() },
  sites: { get: vi.fn(async () => null as unknown), asset: vi.fn() },
  resolveTypes: vi.fn(),
};

function setup({ writesEnabled = true, source = "mcp" as "mcp" | "api", create = vi.fn(async () => ({ ok: true, id: "ag-1" }) as const), detail = vi.fn(async () => null as unknown) } = {}) {
  const audit: ToolAudit = { record: vi.fn(async () => undefined) };
  const customers = { list: vi.fn(async () => [{ id: "c1", name: "Northside School", primaryContact: "Pat", primaryEmail: null, primaryPhone: null, agreementNumbers: ["AG-1001"], agreementCount: 1, active: true, siteCount: 1, assetCount: 2, annualCents: 123456, primaryContactId: null }]), detail, contact: vi.fn(async () => null) };
  const agreementStore = { create, setTemplate: vi.fn() } as unknown as AgreementStore;
  const tools = makeRunAiTool({
    agreements: { list: vi.fn(async () => []) },
    agreementReader: { get: vi.fn(async () => null) },
    agreementStore,
    customerStore: stores.customerStore,
    contactStore: stores.contactStore,
    siteStore: stores.siteStore,
    assetStore: stores.assetStore,
    sites: stores.sites as never,
    resolveTypes: stores.resolveTypes,
    customers: customers as never,
    records: { search: vi.fn() },
    reports: {} as never,
    generateServiceLines: vi.fn(async () => ({ ok: true, added: 2 }) as const),
    audit,
    today: () => "2026-11-27",
    writesEnabled,
    source,
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
    expect(tools.toolsFor(estimator).filter((tool) => tool.access === "write")).toHaveLength(5);
  });
});

describe("plan gating", () => {
  test("Starter gets no tools and every call is refused with the plan to choose", async () => {
    const { tools, create } = setup();
    const starter: ToolCaller = { ...estimator, plan: "starter" };
    expect(tools.toolsFor(starter)).toHaveLength(0);
    expect(await tools.runTool("search_customers", {}, starter)).toMatchObject({ ok: false, error: expect.stringContaining("Team plan and above") });
    expect((await tools.runTool("create_agreement_draft", { site_id: SITE }, starter)).ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  test("Team reads but cannot write, even as an estimator", async () => {
    const { tools, create } = setup();
    const team: ToolCaller = { ...estimator, plan: "team" };
    expect(tools.toolsFor(team).every((tool) => tool.access === "read")).toBe(true);
    expect((await tools.runTool("search_customers", { query: "north" }, team)).ok).toBe(true);
    expect(await tools.runTool("create_agreement_draft", { site_id: SITE }, team)).toMatchObject({ ok: false, error: expect.stringContaining("Business") });
    expect(create).not.toHaveBeenCalled();
    expect(await tools.runTool("who_am_i", {}, team)).toMatchObject({ data: { canCreateDrafts: false } });
  });

  test("a company with no plan gets nothing, and the API door follows the same rules", async () => {
    const api = setup({ source: "api" });
    expect(api.tools.toolsFor({ ...estimator, plan: null })).toHaveLength(0);
    expect((await api.tools.runTool("create_agreement_draft", { site_id: SITE }, estimator)).ok).toBe(true);
    expect(api.audit.record).toHaveBeenCalledWith({ tool: "create_agreement_draft", source: "api", ok: true });
  });
});

describe("customer, site and equipment tools", () => {
  const SITE_ID = "3f2b8a52-6c1e-4d52-9a1c-0b7d6e4f1a10";
  const CUSTOMER_ID = "9a2b8a52-6c1e-4d52-9a1c-0b7d6e4f1a99";
  const activeSite = (assets: { typeCode: string; unitNo: string | null; active: boolean }[] = []) => ({ id: SITE_ID, name: "Pender", active: true, customerActive: true, assets });
  const type = (name: string, created = false) => ({ typeId: `t-${name}`, code: name.toUpperCase().replace(/\W+/g, "_"), name, created });

  test("create_customer asks for a name when none is given and writes nothing", async () => {
    const { tools } = setup();
    stores.customerStore.create.mockClear();
    const result = await tools.runTool("create_customer", {}, estimator);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Ask the user") });
    expect(stores.customerStore.create).not.toHaveBeenCalled();
  });

  test("create_customer makes the customer and its contact in the caller's org, and reuses a customer of the same name", async () => {
    const { tools } = setup();
    stores.customerStore.create.mockClear();
    const made = await tools.runTool("create_customer", { name: "Chinatown BBQ", contact_name: "Lee", contact_email: "lee@bbq.ca" }, estimator);
    expect(stores.customerStore.create).toHaveBeenCalledWith("org-1", { name: "Chinatown BBQ" });
    expect(stores.contactStore.create).toHaveBeenCalledWith("org-1", "c-new", { name: "Lee", email: "lee@bbq.ca", phone: null });
    expect(made).toMatchObject({ ok: true, data: { customerId: "c-new", created: true, contact: { added: true } } });
    stores.customerStore.create.mockClear();
    const again = await tools.runTool("create_customer", { name: "northside school" }, estimator);
    expect(again).toMatchObject({ ok: true, data: { customerId: "c1", created: false } });
    expect(stores.customerStore.create).not.toHaveBeenCalled();
  });

  test("create_customer refuses a role that may not write", async () => {
    const { tools } = setup();
    expect((await tools.runTool("create_customer", { name: "X" }, reader)).ok).toBe(false);
  });

  test("create_site asks for the name and refuses an org or role argument", async () => {
    const { tools } = setup();
    expect(await tools.runTool("create_site", { customer_id: CUSTOMER_ID }, estimator)).toMatchObject({ ok: false, error: expect.stringContaining("Ask the user what to call this site") });
    expect((await tools.runTool("create_site", { customer_id: CUSTOMER_ID, name: "Pender", org_id: "other" }, estimator)).ok).toBe(false);
  });

  test("create_site creates the site under the customer, and reuses a site of the same name", async () => {
    const detail = vi.fn(async () => ({ id: CUSTOMER_ID, name: "BBQ", active: true, contacts: [], sites: [{ id: "s-old", name: "Main", address: "1 Main St", contactName: null, assetCount: 0, active: true }], agreements: [] }));
    const { tools } = setup({ detail });
    stores.siteStore.create.mockClear();
    const made = await tools.runTool("create_site", { customer_id: CUSTOMER_ID, name: "130 E Pender", address: "130 E Pender St, Vancouver" }, estimator);
    expect(stores.siteStore.create).toHaveBeenCalledWith("org-1", CUSTOMER_ID, { name: "130 E Pender", address: "130 E Pender St, Vancouver", siteContactId: null });
    expect(made).toMatchObject({ ok: true, data: { siteId: "s-new", created: true } });
    stores.siteStore.create.mockClear();
    expect(await tools.runTool("create_site", { customer_id: CUSTOMER_ID, name: "main" }, estimator)).toMatchObject({ ok: true, data: { siteId: "s-old", created: false } });
    expect(stores.siteStore.create).not.toHaveBeenCalled();
  });

  test("add_equipment resolves each wording to a type, creating new ones, and adds one asset per unit with serial folded into type/model", async () => {
    const { tools } = setup();
    stores.sites.get.mockResolvedValue(activeSite());
    stores.assetStore.create.mockClear();
    stores.resolveTypes.mockResolvedValue({
      byKey: new Map([
        ["make up air unit", type("Make-up air unit", true)],
        ["carrier rooftop unit", type("Rooftop unit")],
      ]),
      failed: [],
    });
    const result = await tools.runTool(
      "add_equipment",
      {
        site_id: SITE_ID,
        units: [
          { type: "Make-up air unit", make_model: "Captive Aire A2-D.500-G15", serial_number: "?", location: "Roof" },
          { type: "Carrier rooftop unit", make_model: "Carrier 48TCEA07C2A5A0F0A1", serial_number: "1514C89048", location: "Roof" },
        ],
      },
      estimator,
    );
    expect(stores.assetStore.create).toHaveBeenNthCalledWith(1, "org-1", SITE_ID, { assetTypeId: "t-Make-up air unit", unitNo: null, typeModel: "Captive Aire A2-D.500-G15", location: "Roof" });
    expect(stores.assetStore.create).toHaveBeenNthCalledWith(2, "org-1", SITE_ID, { assetTypeId: "t-Rooftop unit", unitNo: null, typeModel: "Carrier 48TCEA07C2A5A0F0A1 S/N 1514C89048", location: "Roof" });
    expect(result).toMatchObject({ ok: true, data: { added: 2, newEquipmentTypesCreated: ["Make-up air unit"], notAdded: [] } });
  });

  test("add_equipment skips a unit already on the site and a repeat in the same call, so it is safe to repeat", async () => {
    const { tools } = setup();
    stores.sites.get.mockResolvedValue(activeSite([{ typeCode: "ROOFTOP_UNIT", unitNo: "RTU-1", active: true }]));
    stores.assetStore.create.mockClear();
    stores.resolveTypes.mockResolvedValue({ byKey: new Map([["rooftop unit", type("Rooftop unit")]]), failed: [] });
    const result = await tools.runTool("add_equipment", { site_id: SITE_ID, units: [{ type: "Rooftop unit", unit_no: "RTU-1" }, { type: "Rooftop unit", unit_no: "RTU-2" }, { type: "Rooftop unit", unit_no: "rtu 2" }] }, estimator);
    expect(stores.assetStore.create).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, data: { added: 1, skippedAlreadyOnSite: 2 } });
  });

  test("add_equipment reports a type it could not make, and refuses an unknown or inactive site and a stray field", async () => {
    const { tools } = setup();
    stores.sites.get.mockResolvedValue(activeSite());
    stores.resolveTypes.mockResolvedValue({ byKey: new Map([["rooftop unit", type("Rooftop unit")]]), failed: ["Sump"] });
    const partial = await tools.runTool("add_equipment", { site_id: SITE_ID, units: [{ type: "Rooftop unit" }, { type: "Sump" }] }, estimator);
    expect(partial).toMatchObject({ ok: true, data: { added: 1, notAdded: ["Sump"] } });
    stores.sites.get.mockResolvedValue(null);
    expect(await tools.runTool("add_equipment", { site_id: SITE_ID, units: [{ type: "X" }] }, estimator)).toMatchObject({ ok: false, error: "No site with that id." });
    stores.sites.get.mockResolvedValue({ ...activeSite(), active: false });
    expect((await tools.runTool("add_equipment", { site_id: SITE_ID, units: [{ type: "X" }] }, estimator)).ok).toBe(false);
    expect(await tools.runTool("add_equipment", { site_id: SITE_ID, units: [{ type: "X", org_id: "other" }] }, estimator)).toMatchObject({ ok: false, error: expect.stringContaining("is not a field of a unit") });
    expect((await tools.runTool("add_equipment", { site_id: SITE_ID, units: [] }, estimator)).ok).toBe(false);
  });
});
