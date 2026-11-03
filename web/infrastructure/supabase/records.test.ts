import { afterEach, describe, expect, test, vi } from "vitest";
import type { AssetValue, SiteValue } from "@/domain/records";
import { supabaseAssetStore, supabaseContactStore, supabaseCustomerStore, supabaseSiteStore } from "./records";
import { stubClient, type Reply } from "./stub-client";

const ORG = "00000000-0000-4000-8000-00000000de30";
const ID = "00000000-0000-4000-8000-000000000001";
const PARENT = "00000000-0000-4000-8000-000000000002";

const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (code: string): Reply => ({ data: null, error: { code, message: `boom ${code}` } });

const site: SiteValue = { name: "Tower A", address: null, siteContactId: PARENT };
const asset: AssetValue = { assetTypeId: PARENT, unitNo: "1", typeModel: null, location: "Roof" };

afterEach(() => vi.restoreAllMocks());

describe("record stores", () => {
  test("C320: a site update sends exactly name, address and site_contact_id for that id", async () => {
    const { typed, calls } = stubClient({ sites: ok([{ id: ID }]) });
    expect(await supabaseSiteStore(typed).update(ID, site)).toEqual({ ok: true });

    const update = calls.find((call) => call.method === "update");
    expect(update?.table).toBe("sites");
    expect(update?.args[0]).toEqual({ name: "Tower A", address: null, site_contact_id: PARENT });
    expect(calls).toContainEqual({ table: "sites", method: "eq", args: ["id", ID] });
  });

  test("C325: an asset insert carries source manual and the org and site it was given", async () => {
    const { typed, calls } = stubClient({ assets: ok([{ id: ID }]) });
    expect(await supabaseAssetStore(typed).create(ORG, PARENT, asset)).toEqual({ ok: true, id: ID });

    const insert = calls.find((call) => call.method === "insert");
    expect(insert?.table).toBe("assets");
    expect(insert?.args[0]).toEqual({
      org_id: ORG,
      site_id: PARENT,
      asset_type_id: PARENT,
      unit_no: "1",
      type_model: null,
      location: "Roof",
      source: "manual",
    });
  });

  test("C326: an asset update sends exactly asset_type_id, unit_no, type_model and location", async () => {
    const { typed, calls } = stubClient({ assets: ok([{ id: ID }]) });
    expect(await supabaseAssetStore(typed).update(ID, asset)).toEqual({ ok: true });

    const update = calls.find((call) => call.method === "update");
    expect(Object.keys(update?.args[0] as object).sort()).toEqual(["asset_type_id", "location", "type_model", "unit_no"]);
    expect(calls).toContainEqual({ table: "assets", method: "eq", args: ["id", ID] });
  });

  test("creates return the new id for customers, contacts and sites", async () => {
    const reply = { customers: ok([{ id: ID }]), contacts: ok([{ id: ID }]), sites: ok([{ id: ID }]) };
    const { typed, calls } = stubClient(reply);
    expect(await supabaseCustomerStore(typed).create(ORG, { name: "Acme" })).toEqual({ ok: true, id: ID });
    expect(await supabaseContactStore(typed).create(ORG, PARENT, { name: "Dana", email: null, phone: null })).toEqual({ ok: true, id: ID });
    expect(await supabaseSiteStore(typed).create(ORG, PARENT, site)).toEqual({ ok: true, id: ID });

    const inserts = calls.filter((call) => call.method === "insert");
    expect(inserts.map((call) => call.args[0])).toEqual([
      { org_id: ORG, name: "Acme" },
      { org_id: ORG, customer_id: PARENT, name: "Dana", email: null, phone: null },
      { org_id: ORG, customer_id: PARENT, name: "Tower A", address: null, site_contact_id: PARENT },
    ]);
  });

  test("deletes filter by id and succeed when a row is returned", async () => {
    const { typed, calls } = stubClient({ contacts: ok([{ id: ID }]) });
    expect(await supabaseContactStore(typed).delete(ID)).toEqual({ ok: true });
    expect(calls.filter((call) => call.method === "delete").map((call) => call.table)).toEqual(["contacts"]);
    expect(calls).toContainEqual({ table: "contacts", method: "eq", args: ["id", ID] });
  });

  test("C334: insert error 42501 is forbidden", async () => {
    const { typed } = stubClient({ customers: fail("42501") });
    expect(await supabaseCustomerStore(typed).create(ORG, { name: "Acme" })).toEqual({ ok: false, code: "forbidden" });
  });

  test("C334: error 23503 on create or update is not_found", async () => {
    const { typed } = stubClient({ contacts: fail("23503"), sites: fail("23503") });
    expect(await supabaseContactStore(typed).create(ORG, PARENT, { name: "Dana", email: null, phone: null })).toEqual({
      ok: false,
      code: "not_found",
    });
    expect(await supabaseSiteStore(typed).update(ID, site)).toEqual({ ok: false, code: "not_found" });
  });

  test("C334: error 23503 on delete is in_use", async () => {
    const { typed } = stubClient({ contacts: fail("23503") });
    expect(await supabaseContactStore(typed).delete(ID)).toEqual({ ok: false, code: "in_use" });
  });

  test("C334: an update or delete returning no row is not_found", async () => {
    const { typed } = stubClient({ customers: ok([]), assets: ok([]) });
    expect(await supabaseCustomerStore(typed).update(ID, { name: "Acme" })).toEqual({ ok: false, code: "not_found" });
    expect(await supabaseAssetStore(typed).update(ID, asset)).toEqual({ ok: false, code: "not_found" });
  });

  test("C334: any other error code is unavailable and logs the code", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { typed } = stubClient({ assets: fail("XX000") });
    expect(await supabaseAssetStore(typed).update(ID, asset)).toEqual({ ok: false, code: "unavailable" });
    expect(spy.mock.calls[0][0]).toContain("XX000");
  });

  test("C334: a thrown request is unavailable and logs its message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { typed, client } = stubClient({});
    client.from = () => {
      throw new TypeError("fetch failed");
    };
    expect(await supabaseCustomerStore(typed).create(ORG, { name: "Acme" })).toEqual({ ok: false, code: "unavailable" });
    expect(spy.mock.calls[0][0]).toContain("fetch failed");
  });
});

const failWith = (code: string, hint: string | null = null, details: unknown = null): Reply => ({
  data: null,
  error: { code, message: `boom ${code}`, hint, details: details === null ? null : JSON.stringify(details) },
});

describe("status writers", () => {
  test("C1276: removing an asset calls set_asset_active with the replacement, or null", async () => {
    const { typed, client } = stubClient({});
    expect(await supabaseAssetStore(typed).setActive(ID, false, PARENT)).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenLastCalledWith("set_asset_active", { p_asset_id: ID, p_active: false, p_replaced_by: PARENT });
    await supabaseAssetStore(typed).setActive(ID, false);
    expect(client.rpc).toHaveBeenLastCalledWith("set_asset_active", { p_asset_id: ID, p_active: false, p_replaced_by: null });
  });

  test.each([
    [failWith("23514", "replacement_invalid"), { ok: false, code: "invalid_replacement" }],
    [failWith("55000", "site_inactive", { site: "Tower A" }), { ok: false, code: "parent_inactive", parent: "Tower A" }],
    [failWith("42501"), { ok: false, code: "forbidden" }],
    [failWith("P0002"), { ok: false, code: "not_found" }],
    [failWith("XX000"), { ok: false, code: "unavailable" }],
  ])("C1276: an asset refusal maps to its code (%#)", async (reply, expected) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { typed, client } = stubClient({});
    client.rpc.mockResolvedValue(reply);
    expect(await supabaseAssetStore(typed).setActive(ID, true)).toEqual(expected);
  });

  test("C1292: a site calls set_site_active and maps each refusal from its hint and detail", async () => {
    const { typed, client } = stubClient({});
    expect(await supabaseSiteStore(typed).setActive(ID, false)).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenLastCalledWith("set_site_active", { p_site_id: ID, p_active: false });

    client.rpc.mockResolvedValue(failWith("55000", "in_term", { site: "Tower A", number: "AG-1004", termEnd: "2027-12-31" }));
    expect(await supabaseSiteStore(typed).setActive(ID, false)).toEqual({ ok: false, code: "in_term", site: "Tower A", number: "AG-1004", termEnd: "2027-12-31" });
    client.rpc.mockResolvedValue(failWith("55000", "in_term", { site: "Tower A", number: "AG-1004", termEnd: null }));
    expect(await supabaseSiteStore(typed).setActive(ID, false)).toEqual({ ok: false, code: "in_term", site: "Tower A", number: "AG-1004", termEnd: null });
    client.rpc.mockResolvedValue(failWith("55000", "changes_requested", { site: "Tower A", number: "AG-1004" }));
    expect(await supabaseSiteStore(typed).setActive(ID, false)).toEqual({ ok: false, code: "changes_requested", site: "Tower A", number: "AG-1004" });
    client.rpc.mockResolvedValue(failWith("55000", "customer_inactive", { customer: "Kettle Test" }));
    expect(await supabaseSiteStore(typed).setActive(ID, true)).toEqual({ ok: false, code: "parent_inactive", parent: "Kettle Test" });
    client.rpc.mockResolvedValue(failWith("42501"));
    expect(await supabaseSiteStore(typed).setActive(ID, false)).toEqual({ ok: false, code: "forbidden" });
    client.rpc.mockResolvedValue(failWith("P0002"));
    expect(await supabaseSiteStore(typed).setActive(ID, false)).toEqual({ ok: false, code: "not_found" });
  });

  test("C1298: a customer calls set_customer_active and its refusal names the blocking site", async () => {
    const { typed, client } = stubClient({});
    expect(await supabaseCustomerStore(typed).setActive(ID, false)).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenLastCalledWith("set_customer_active", { p_customer_id: ID, p_active: false });
    client.rpc.mockResolvedValue(failWith("55000", "in_term", { site: "Tower A", number: "AG-1004", termEnd: "2027-12-31" }));
    expect(await supabaseCustomerStore(typed).setActive(ID, false)).toEqual({ ok: false, code: "in_term", site: "Tower A", number: "AG-1004", termEnd: "2027-12-31" });
    client.rpc.mockResolvedValue(failWith("55000", "changes_requested", { site: "Tower B", number: "AG-1005" }));
    expect(await supabaseCustomerStore(typed).setActive(ID, false)).toEqual({ ok: false, code: "changes_requested", site: "Tower B", number: "AG-1005" });
  });
});
