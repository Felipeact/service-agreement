import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import type { OrgSettingsValue } from "@/domain/org-settings";
import { supabaseAgreementReader, supabaseAgreementTermStore } from "./agreements";
import type { Database } from "./database.types";
import { supabaseAgreementSender, supabasePortalReader } from "./portal";
import { supabaseOrgSettingsStore } from "./settings";
import { stubClient, type Reply } from "./stub-client";

const AGR = "11111111-1111-4111-8111-111111111111";
const ORG = "00000000-0000-4000-8000-00000000de30";
const HASH = "a".repeat(64);
const VERSION = "66666666-6666-4666-8666-666666666666";
const EVENT = { type: "agreement.sent", entityType: "agreement" as const, from: "draft" as const, to: "sent" as const, data: {} };

const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (code: string, hint?: string): Reply =>
  ({ data: null, error: { code, message: `boom ${code}`, ...(hint === undefined ? {} : { hint }) } }) as Reply;

afterEach(() => vi.restoreAllMocks());

const SETTINGS: OrgSettingsValue = {
  legalName: "Acme Ltd.",
  address: null,
  phone: null,
  accentColor: null,
  repairDiscountPct: 10,
  cpiCapPct: 3,
  cancellationNoticeDays: null,
  paymentDays: null,
  governingProvince: null,
  taxNote: null,
  defaultTermMonths: 24,
  renewalNoticeDays: 45,
  cpiRenegotiationThresholdPct: 4.75,
  renewalCpiPct: null,
  renewalCpiAsOf: null,
};

describe("renewal settings in the settings store", () => {
  test("C1133: save sends the three renewal columns with the validated values", async () => {
    const { typed, calls } = stubClient({ org_settings: ok([{ org_id: ORG }]) });
    await supabaseOrgSettingsStore(typed).save(ORG, SETTINGS, new Date("2026-11-02T12:00:00Z"));
    const update = calls.find((call) => call.method === "update");
    expect(update?.args[0]).toMatchObject({ default_term_months: 24, renewal_notice_days: 45, cpi_renegotiation_threshold_pct: 4.75 });
  });

  test("C1133: get maps the three renewal columns back", async () => {
    const row = {
      legal_name: "Acme Ltd.",
      address: null,
      phone: null,
      accent_color: null,
      repair_discount_pct: "10.00",
      cpi_cap_pct: "3.00",
      cancellation_notice_days: null,
      payment_days: null,
      governing_province: null,
      tax_note: null,
      default_term_months: 24,
      renewal_notice_days: 45,
      cpi_renegotiation_threshold_pct: "4.75",
    };
    const { typed } = stubClient({ org_settings: ok(row) });
    expect(await supabaseOrgSettingsStore(typed).get(ORG)).toMatchObject({
      defaultTermMonths: 24,
      renewalNoticeDays: 45,
      cpiRenegotiationThresholdPct: 4.75,
      renewalCpiPct: null,
      renewalCpiAsOf: null,
    });
  });
});

describe("the term store", () => {
  test("C1142: save calls save_agreement_term with the agreement, start and months", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(ok(VERSION));
    await supabaseAgreementTermStore(typed).save(AGR, { start: "2027-01-01", months: 12 });
    expect(client.rpc).toHaveBeenCalledWith("save_agreement_term", { p_agreement_id: AGR, p_term_start: "2027-01-01", p_term_months: 12 });
  });

  test.each([
    ["55000", "locked"],
    ["42501", "forbidden"],
    ["P0002", "not_found"],
    ["23514", "invalid"],
    ["XX000", "unavailable"],
  ])("C1142: SQLSTATE %s is %s", async (code, expected) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail(code));
    expect(await supabaseAgreementTermStore(typed).save(AGR, { start: "2027-01-01", months: 12 })).toEqual({ ok: false, code: expected });
  });

  test("C1165: a uuid back from save_agreement_term is ok", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(ok(VERSION));
    expect(await supabaseAgreementTermStore(typed).save(AGR, { start: "2027-01-01", months: 12 })).toEqual({ ok: true });
  });
});

describe("the term on the agreement reader", () => {
  const row = (term: { term_start: string | null; term_months: number; term_end: string | null }) => ({
    id: AGR,
    number: "AG-1052",
    status: "sent",
    sites: { id: "s1", name: "Harbourview Towers", customers: { id: "c1", name: "Harbourview Strata" } },
    agreement_versions: [{ id: "v1", version_no: 1, created_at: "2026-10-27T17:00:00Z", contracts: [], ...term }],
  });

  test("C1145: the shown version's start, months and end become AgreementDetail.term", async () => {
    const { typed } = stubClient({
      agreements: ok(row({ term_start: "2027-01-01", term_months: 12, term_end: "2027-12-31" })),
      service_lines: ok([]),
    });
    expect((await supabaseAgreementReader(typed).get(AGR))?.term).toEqual({ start: "2027-01-01", months: 12, end: "2027-12-31" });
  });

  test("C1145: no start gives null start and end", async () => {
    const { typed } = stubClient({ agreements: ok(row({ term_start: null, term_months: 12, term_end: null })), service_lines: ok([]) });
    expect((await supabaseAgreementReader(typed).get(AGR))?.term).toEqual({ start: null, months: 12, end: null });
  });
});

describe("the send refusals", () => {
  test("C1150: 23514 with hint no_term_start is no_term_start", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail("23514", "no_term_start"));
    expect(await supabaseAgreementSender(typed).send(AGR, HASH, EVENT)).toEqual({ ok: false, code: "no_term_start" });
  });

  test("C1150: 23514 with no hint is still no_lines", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail("23514"));
    expect(await supabaseAgreementSender(typed).send(AGR, HASH, EVENT)).toEqual({ ok: false, code: "no_lines" });
  });
});

describe("the term on the portal view", () => {
  const document = (term: unknown) => ({
    link: { versionNo: 1, current: true, revoked: false, revokedAt: null, firstViewedAt: null },
    agreement: { number: "AG-1052", status: "sent" },
    tenant: { name: "Acme Ltd.", address: null, phone: null, accent: null },
    customer: { name: "Fernwood Dental" },
    site: { name: "Main" },
    lines: [],
    annualCents: 0,
    scope: null,
    terms: null,
    term,
    decision: null,
  });

  test("C1159: portal_view's term maps to PortalView.term unchanged", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(ok(document({ start: "2027-01-01", months: 12, end: "2027-12-31" })));
    expect((await supabasePortalReader(typed).view(HASH))?.term).toEqual({ start: "2027-01-01", months: 12, end: "2027-12-31" });
  });

  test("C1159: a term with no start keeps start and end null", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(ok(document({ start: null, months: 6, end: null })));
    expect((await supabasePortalReader(typed).view(HASH))?.term).toEqual({ start: null, months: 6, end: null });
  });
});

describe("the generated types", () => {
  test("C1160: agreement_versions and org_settings rows carry the term and renewal columns", () => {
    type Version = Database["public"]["Tables"]["agreement_versions"]["Row"];
    type Settings = Database["public"]["Tables"]["org_settings"]["Row"];
    expectTypeOf<Version["term_start"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Version["term_months"]>().toEqualTypeOf<number>();
    expectTypeOf<Version["term_end"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Settings["default_term_months"]>().toEqualTypeOf<number>();
    expectTypeOf<Settings["renewal_notice_days"]>().toEqualTypeOf<number>();
    expectTypeOf<Settings["cpi_renegotiation_threshold_pct"]>().toEqualTypeOf<number>();
    expectTypeOf<Database["public"]["Functions"]["save_agreement_term"]["Args"]>().toEqualTypeOf<{
      p_agreement_id: string;
      p_term_months: number;
      p_term_start: string;
    }>();
  });
});
