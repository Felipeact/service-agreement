import { afterEach, describe, expect, test, vi } from "vitest";
import type { OrgSettingsValue } from "@/domain/org-settings";
import { fixedClock } from "@/infrastructure/clock";
import { supabaseOrgSettingsStore } from "./settings";
import { stubClient } from "./stub-client";

const ORG = "00000000-0000-4000-8000-00000000de30";
const AT = fixedClock(new Date("2026-10-24T12:00:00Z")).now();

const value: OrgSettingsValue = {
  legalName: "Acme Ltd.",
  address: null,
  phone: "604-555-0100",
  accentColor: "#1f6f8b",
  repairDiscountPct: 10,
  cpiCapPct: 5,
  cancellationNoticeDays: 30,
  paymentDays: null,
  governingProvince: "BC",
  taxNote: null,
};

afterEach(() => vi.restoreAllMocks());

describe("org settings store", () => {
  test("C146: no row returns null", async () => {
    expect(await supabaseOrgSettingsStore(stubClient({ org_settings: { data: null, error: null } }).typed).get(ORG)).toBeNull();
  });

  test("C149: save updates org_settings once, filtered by org, with updated_at from the clock and no rpc", async () => {
    const { typed, calls, client } = stubClient({ org_settings: { data: [{ org_id: ORG }], error: null } });
    expect(await supabaseOrgSettingsStore(typed).save(ORG, value, AT)).toEqual({ ok: true });

    const updates = calls.filter((call) => call.method === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("org_settings");
    expect(updates[0].args[0]).toMatchObject({
      legal_name: "Acme Ltd.",
      address: null,
      accent_color: "#1f6f8b",
      repair_discount_pct: 10,
      payment_days: null,
      governing_province: "BC",
      updated_at: "2026-10-24T12:00:00.000Z",
    });
    expect(calls).toContainEqual({ table: "org_settings", method: "eq", args: ["org_id", ORG] });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  test("C150: an update that changes no row is forbidden", async () => {
    const { typed } = stubClient({ org_settings: { data: [], error: null } });
    expect(await supabaseOrgSettingsStore(typed).save(ORG, value, AT)).toEqual({ ok: false, code: "forbidden" });
  });

  test("C151: a Supabase error is unavailable and logs its code", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { typed } = stubClient({ org_settings: { data: null, error: { code: "XX000", message: "boom" } } });
    expect(await supabaseOrgSettingsStore(typed).save(ORG, value, AT)).toEqual({ ok: false, code: "unavailable" });
    expect(spy.mock.calls[0][0]).toContain("XX000");
  });

  test("C151: a rejected request is unavailable and logs its message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { typed, client } = stubClient({});
    client.from = () => {
      throw new TypeError("fetch failed");
    };
    expect(await supabaseOrgSettingsStore(typed).save(ORG, value, AT)).toEqual({ ok: false, code: "unavailable" });
    expect(spy.mock.calls[0][0]).toContain("fetch failed");
  });
});
