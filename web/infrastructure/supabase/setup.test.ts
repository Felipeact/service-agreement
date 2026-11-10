import { afterEach, describe, expect, test, vi } from "vitest";
import type { SetupProfileValue } from "@/domain/org-settings/setup";
import { supabaseOrgSetup } from "./setup";
import { stubClient } from "./stub-client";

const ORG = "00000000-0000-4000-8000-00000000f130";
const AT = new Date("2026-11-10T12:00:00Z");

const profile: SetupProfileValue = {
  legalName: "Flow Plumbing Ltd.",
  address: null,
  phone: "604-555-0123",
  accentColor: "#1f6f8b",
  governingProvince: "BC",
  itemSingular: "fixture",
  itemPlural: "fixtures",
};

afterEach(() => vi.restoreAllMocks());

describe("setup store", () => {
  test("C2809: saving updates exactly the seven profile columns and updated_at, then stamps setup_completed_at", async () => {
    const { typed, calls } = stubClient({ org_settings: { sequence: [{ data: [{ org_id: ORG }], error: null }, { data: null, error: null }] } });
    expect(await supabaseOrgSetup(typed).saveProfile(ORG, profile, AT)).toEqual({ ok: true });

    const updates = calls.filter((call) => call.method === "update");
    expect(updates).toHaveLength(2);
    expect(Object.keys(updates[0].args[0] as object).sort()).toEqual([
      "accent_color", "address", "governing_province", "item_plural", "item_singular", "legal_name", "phone", "updated_at",
    ]);
    expect(updates[0].args[0]).toMatchObject({ legal_name: "Flow Plumbing Ltd.", address: null, governing_province: "BC", updated_at: "2026-11-10T12:00:00.000Z" });
    expect(updates[1].args[0]).toEqual({ setup_completed_at: "2026-11-10T12:00:00.000Z" });
  });

  test("C2811: an update that changes no row is forbidden and nothing is stamped", async () => {
    const { typed, calls } = stubClient({ org_settings: { data: [], error: null } });
    expect(await supabaseOrgSetup(typed).saveProfile(ORG, profile, AT)).toEqual({ ok: false, code: "forbidden" });
    expect(calls.filter((call) => call.method === "update")).toHaveLength(1);
  });

  test("C2811: a database error on the profile update is unavailable, logged, and nothing is stamped", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { typed, calls } = stubClient({ org_settings: { data: null, error: { code: "XX000", message: "down" } } });
    expect(await supabaseOrgSetup(typed).saveProfile(ORG, profile, AT)).toEqual({ ok: false, code: "unavailable" });
    expect(calls.filter((call) => call.method === "update")).toHaveLength(1);
    expect(log).toHaveBeenCalledTimes(1);
  });

  test("C2812: skip is one update touching only setup_completed_at", async () => {
    const { typed, calls } = stubClient({ org_settings: { data: null, error: null } });
    expect(await supabaseOrgSetup(typed).skip(ORG, AT)).toEqual({ ok: true });
    const updates = calls.filter((call) => call.method === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].args[0]).toEqual({ setup_completed_at: "2026-11-10T12:00:00.000Z" });
  });

  test("C2813: the stamp is filtered to rows whose setup_completed_at is still null, and to the org", async () => {
    const { typed, calls } = stubClient({ org_settings: { data: null, error: null } });
    await supabaseOrgSetup(typed).skip(ORG, AT);
    expect(calls).toContainEqual({ table: "org_settings", method: "eq", args: ["org_id", ORG] });
    expect(calls).toContainEqual({ table: "org_settings", method: "is", args: ["setup_completed_at", null] });
  });

  test("C2800: pending means the org's settings row has a null setup_completed_at; done, and no row, are not pending", async () => {
    const read = (data: unknown) => supabaseOrgSetup(stubClient({ org_settings: { data, error: null } }).typed).isPending(ORG);
    expect(await read([{ setup_completed_at: null }])).toBe(true);
    expect(await read([{ setup_completed_at: "2026-11-10T00:00:00Z" }])).toBe(false);
    expect(await read(null)).toBe(false);
  });

  test("C2800: a read error throws so the caller can decide", async () => {
    const { typed } = stubClient({ org_settings: { data: null, error: { code: "XX000", message: "down" } } });
    await expect(supabaseOrgSetup(typed).isPending(ORG)).rejects.toThrow("XX000");
  });

  test("C2816: the catalog reads pack and name from asset_types ordered by name, with no org filter of its own", async () => {
    const { typed, calls } = stubClient({ asset_types: { data: [{ pack: "plumbing", name: "Sink" }, { pack: null, name: "Zed" }], error: null } });
    expect(await supabaseOrgSetup(typed).catalog()).toEqual([{ pack: "plumbing", name: "Sink" }, { pack: null, name: "Zed" }]);
    expect(calls).toContainEqual({ table: "asset_types", method: "select", args: ["pack, name"] });
    expect(calls).toContainEqual({ table: "asset_types", method: "order", args: ["name"] });
    expect(calls.filter((call) => call.method === "eq" || call.method === "in")).toHaveLength(0);
  });
});
