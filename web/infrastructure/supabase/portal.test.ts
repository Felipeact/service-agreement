import { describe, expect, test } from "vitest";
import { supabaseAgreementSender, supabasePortalLinkStore } from "./portal";
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
