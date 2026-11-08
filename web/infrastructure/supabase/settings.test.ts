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
  defaultTermMonths: 12,
  renewalNoticeDays: 30,
  cpiRenegotiationThresholdPct: 5,
  renewalCpiPct: null,
  renewalCpiAsOf: null,
  proposalValidityDays: 30, itemSingular: "equipment", itemPlural: "equipment",
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

  test("C1169: save sends the CPI and its date, or both null", async () => {
    for (const [pct, asOf] of [[3.2, "2027-10-15"], [null, null]] as const) {
      const { typed, calls } = stubClient({ org_settings: { data: [{ org_id: ORG }], error: null } });
      await supabaseOrgSettingsStore(typed).save(ORG, { ...value, renewalCpiPct: pct, renewalCpiAsOf: asOf }, AT);
      expect(calls.find((call) => call.method === "update")?.args[0]).toMatchObject({ renewal_cpi_pct: pct, renewal_cpi_as_of: asOf });
    }
  });

  test("C1169: get maps the CPI to a number and the date as YYYY-MM-DD, or null", async () => {
    const row = (pct: string | number | null, asOf: string | null) => ({
      org_id: ORG, legal_name: "Acme Ltd.", address: null, phone: null, logo_path: null, accent_color: null,
      repair_discount_pct: 10, cpi_cap_pct: 5, cancellation_notice_days: null, payment_days: null, governing_province: null,
      tax_note: null, default_term_months: 12, renewal_notice_days: 30, cpi_renegotiation_threshold_pct: 5,
      renewal_cpi_pct: pct, renewal_cpi_as_of: asOf, updated_at: "2026-10-24T12:00:00Z",
    });
    const set = await supabaseOrgSettingsStore(stubClient({ org_settings: { data: row("3.20", "2027-10-15"), error: null } }).typed).get(ORG);
    expect(set).toMatchObject({ renewalCpiPct: 3.2, renewalCpiAsOf: "2027-10-15" });
    const unset = await supabaseOrgSettingsStore(stubClient({ org_settings: { data: row(null, null), error: null } }).typed).get(ORG);
    expect(unset).toMatchObject({ renewalCpiPct: null, renewalCpiAsOf: null });
  });

  test("C1225: get reads proposal_validity_days and save sends it", async () => {
    const row = {
      org_id: ORG, legal_name: "Acme Ltd.", address: null, phone: null, logo_path: null, accent_color: null,
      repair_discount_pct: 10, cpi_cap_pct: 5, cancellation_notice_days: null, payment_days: null, governing_province: null,
      tax_note: null, default_term_months: 12, renewal_notice_days: 30, cpi_renegotiation_threshold_pct: 5,
      renewal_cpi_pct: null, renewal_cpi_as_of: null, proposal_validity_days: 14, updated_at: "2026-10-24T12:00:00Z",
    };
    const read = await supabaseOrgSettingsStore(stubClient({ org_settings: { data: row, error: null } }).typed).get(ORG);
    expect(read?.proposalValidityDays).toBe(14);
    const { typed, calls } = stubClient({ org_settings: { data: [{ org_id: ORG }], error: null } });
    await supabaseOrgSettingsStore(typed).save(ORG, { ...value, proposalValidityDays: 14, itemSingular: "equipment", itemPlural: "equipment" }, AT);
    expect(calls.find((call) => call.method === "update")?.args[0]).toMatchObject({ proposal_validity_days: 14 });
  });
});

describe("org settings store, item words", () => {
  test("C2009: save writes both words and get reads them back, defaulting to equipment", async () => {
    const saving = stubClient({ org_settings: { data: [{ org_id: ORG }], error: null } });
    await supabaseOrgSettingsStore(saving.typed).save(ORG, { ...value, itemSingular: "station", itemPlural: "stations" }, AT);
    const update = saving.calls.find((call) => call.method === "update");
    expect(update?.args[0]).toMatchObject({ item_singular: "station", item_plural: "stations" });

    const row = (words: { item_singular: string; item_plural: string }) => ({
      org_id: ORG, legal_name: "Acme Ltd.", address: null, phone: null, logo_path: null, accent_color: null,
      repair_discount_pct: 0, cpi_cap_pct: 0, cancellation_notice_days: null, payment_days: null, governing_province: null,
      tax_note: null, default_term_months: 12, renewal_notice_days: 30, cpi_renegotiation_threshold_pct: 5,
      renewal_cpi_pct: null, renewal_cpi_as_of: null, proposal_validity_days: 30, ...words,
    });
    const set = await supabaseOrgSettingsStore(stubClient({ org_settings: { data: row({ item_singular: "station", item_plural: "stations" }), error: null } }).typed).get(ORG);
    expect([set?.itemSingular, set?.itemPlural]).toEqual(["station", "stations"]);
    const fresh = await supabaseOrgSettingsStore(stubClient({ org_settings: { data: row({ item_singular: "equipment", item_plural: "equipment" }), error: null } }).typed).get(ORG);
    expect([fresh?.itemSingular, fresh?.itemPlural]).toEqual(["equipment", "equipment"]);
  });
});

describe("org settings store, rows from before the words existed", () => {
  test("C2009: a row without the two columns reads equipment for both instead of failing", async () => {
    const row = {
      org_id: ORG, legal_name: "Acme Ltd.", address: null, phone: null, logo_path: null, accent_color: null,
      repair_discount_pct: 0, cpi_cap_pct: 0, cancellation_notice_days: null, payment_days: null, governing_province: null,
      tax_note: null, default_term_months: 12, renewal_notice_days: 30, cpi_renegotiation_threshold_pct: 5,
      renewal_cpi_pct: null, renewal_cpi_as_of: null, proposal_validity_days: 30,
    };
    const found = await supabaseOrgSettingsStore(stubClient({ org_settings: { data: row, error: null } }).typed).get(ORG);
    expect([found?.itemSingular, found?.itemPlural]).toEqual(["equipment", "equipment"]);
  });
});
