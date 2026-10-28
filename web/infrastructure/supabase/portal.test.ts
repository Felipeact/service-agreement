import { describe, expect, test } from "vitest";
import { supabaseAgreementSender, supabasePortalDecider, supabasePortalLinkStore, supabasePortalReader, supabasePortalViewRecorder } from "./portal";
import { stubClient, type Reply } from "./stub-client";

const AGR = "11111111-1111-4111-8111-111111111111";
const HASH = "a".repeat(64);
const EVENT = { type: "agreement.sent", entityType: "agreement" as const, from: "draft" as const, to: "sent" as const, data: {} };

const fail = (code: string): Reply => ({ data: null, error: { code, message: `boom ${code}` } });

describe("agreement sender", () => {
  test("C901: send calls send_agreement with the hash, the event type and the from/to payload", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: "evt", error: null });
    expect(await supabaseAgreementSender(typed).send(AGR, HASH, EVENT)).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith("send_agreement", {
      p_agreement_id: AGR,
      p_token_hash: HASH,
      p_event_type: "agreement.sent",
      p_payload: { from: "draft", to: "sent" },
    });
  });

  test.each([
    ["23514", "no_lines"],
    ["40001", "conflict"],
    ["23505", "conflict"],
    ["P0002", "not_found"],
    ["42501", "forbidden"],
  ])("C902/C903/C906: SQLSTATE %s is %s", async (code, expected) => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail(code));
    expect(await supabaseAgreementSender(typed).send(AGR, HASH, EVENT)).toEqual({ ok: false, code: expected });
  });

  test("an unexpected error is thrown", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail("XX000"));
    await expect(supabaseAgreementSender(typed).send(AGR, HASH, EVENT)).rejects.toThrow("XX000");
  });
});

describe("portal link store", () => {
  test("C904: reissue calls reissue_portal_link with the new hash", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: "link", error: null });
    expect(await supabasePortalLinkStore(typed).reissue(AGR, HASH)).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith("reissue_portal_link", { p_agreement_id: AGR, p_token_hash: HASH });
  });

  test.each([
    ["40001", "conflict"],
    ["23505", "conflict"],
    ["P0002", "not_found"],
    ["42501", "forbidden"],
  ])("C904/C906: SQLSTATE %s is %s", async (code, expected) => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail(code));
    expect(await supabasePortalLinkStore(typed).reissue(AGR, HASH)).toEqual({ ok: false, code: expected });
  });

  test("a 23514 or any other error from a reissue is thrown", async () => {
    for (const code of ["23514", "XX000"]) {
      const { client, typed } = stubClient({});
      client.rpc.mockResolvedValue(fail(code));
      await expect(supabasePortalLinkStore(typed).reissue(AGR, HASH)).rejects.toThrow(code);
    }
  });
});

const DOCUMENT = {
  link: { versionNo: 2, current: true, revoked: false, revokedAt: null, firstViewedAt: "2026-10-21T10:00:00+00:00" },
  agreement: { number: "AG-1052", status: "accepted" },
  tenant: { name: "Kettle Ridge Mechanical Ltd.", address: null, phone: "604-555-0100", accent: "#1f6f8b" },
  customer: { name: "Fernwood Dental" },
  site: { name: "Fernwood Dental, Main" },
  lines: [{ description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 }],
  annualCents: 180000,
  scope: { schema: 1, takenAt: "2026-10-20T15:00:00Z", types: [] },
  terms: { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: 30, paymentDays: null, governingProvince: "BC", taxNote: null },
  decision: { status: "accepted", decidedAt: "2026-10-22T09:30:00+00:00", reason: null },
};

describe("portal reader", () => {
  test("C925: view calls only portal_view with the hash", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: DOCUMENT, error: null });
    await supabasePortalReader(typed).view(HASH);
    expect(client.rpc.mock.calls).toEqual([["portal_view", { p_token_hash: HASH }]]);
  });

  test("C909: the document becomes a PortalView with dates, terms and the decision", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: DOCUMENT, error: null });
    const view = await supabasePortalReader(typed).view(HASH);
    expect(view).toMatchObject({
      link: { versionNo: 2, current: true, revoked: false, revokedAt: null },
      agreement: { number: "AG-1052", status: "accepted" },
      tenant: { name: "Kettle Ridge Mechanical Ltd.", address: null, phone: "604-555-0100", accent: "#1f6f8b" },
      customer: { name: "Fernwood Dental" },
      annualCents: 180000,
      terms: { repairDiscountPct: 10, paymentDays: null, governingProvince: "BC" },
      decision: { status: "accepted", reason: null },
    });
    expect(view?.link.firstViewedAt).toEqual(new Date("2026-10-21T10:00:00+00:00"));
    expect(view?.decision?.decidedAt).toEqual(new Date("2026-10-22T09:30:00+00:00"));
  });

  test("C910: an unknown link (null) and a missing tenant or terms are values, not errors", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await supabasePortalReader(typed).view(HASH)).toBeNull();
    client.rpc.mockResolvedValueOnce({ data: { ...DOCUMENT, tenant: null, terms: null, scope: null, decision: null }, error: null });
    expect(await supabasePortalReader(typed).view(HASH)).toMatchObject({ tenant: null, terms: null, scope: null, decision: null });
  });

  test("C932: a database error is thrown", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail("XX000"));
    await expect(supabasePortalReader(typed).view(HASH)).rejects.toThrow("XX000");
  });
});

describe("portal decider and recorder", () => {
  const ACCEPT = { type: "agreement.accepted", entityType: "agreement" as const, from: "sent" as const, to: "accepted" as const, data: {} };
  const REFUSE = { type: "agreement.refused", entityType: "agreement" as const, from: "sent" as const, to: "refused" as const, data: { reason: "Too dear" } };

  test("C919/C920: decide calls portal_decide with the status, the event type and the reason", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: "evt", error: null });
    expect(await supabasePortalDecider(typed).decide(HASH, REFUSE)).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith("portal_decide", {
      p_token_hash: HASH,
      p_to_status: "refused",
      p_event_type: "agreement.refused",
      p_payload: { reason: "Too dear" },
    });
  });

  test.each(["40001", "P0002"])("C923: SQLSTATE %s is not_open", async (code) => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail(code));
    expect(await supabasePortalDecider(typed).decide(HASH, ACCEPT)).toEqual({ ok: false, code: "not_open" });
  });

  test.each(["42501", "23514", "XX000"])("C919: SQLSTATE %s is unexpected and thrown", async (code) => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail(code));
    await expect(supabasePortalDecider(typed).decide(HASH, ACCEPT)).rejects.toThrow(code);
  });

  test("C929: record calls portal_record_view with the hash, and throws on an error", async () => {
    const { client, typed } = stubClient({});
    await supabasePortalViewRecorder(typed).record(HASH);
    expect(client.rpc).toHaveBeenCalledWith("portal_record_view", { p_token_hash: HASH });
    client.rpc.mockResolvedValue(fail("XX000"));
    await expect(supabasePortalViewRecorder(typed).record(HASH)).rejects.toThrow("XX000");
  });
});
