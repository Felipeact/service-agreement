import { describe, expect, test } from "vitest";
import { supabaseAutomationCallbacks } from "./automation";
import { stubClient } from "./stub-client";

const CALLBACK = { body: '{"kind":"customer_link"}', timestamp: "1700000000", signature: `sha256=${"a".repeat(64)}` };
const fail = (code: string) => ({ data: null, error: { code, message: `boom ${code}` } });

describe("the automation callbacks adapter", () => {
  test("C1019: claim forwards the raw body and both headers to automation_claim and reads a customer_link message", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({
      data: {
        decision: "send",
        messages: [
          {
            notificationId: "n1",
            kind: "customer_link",
            to: ["pat@customer.ca"],
            replyTo: "estimator@northwind.ca",
            tenant: { legalName: "Northwind Mechanical Ltd.", phone: "604-555-0100", accent: "#0f766e" },
            agreement: { id: "a1", number: "AG-1052" },
            customer: { name: "Harbourview Strata" },
            site: { name: "Harbourview Towers" },
            annualCents: 387000,
            tokenSealed: "v1.sealed",
            reminder: null,
          },
        ],
      },
      error: null,
    });
    const result = await supabaseAutomationCallbacks(typed).claim(CALLBACK);
    expect(client.rpc).toHaveBeenCalledWith("automation_claim", { p_body: CALLBACK.body, p_timestamp: "1700000000", p_signature: CALLBACK.signature });
    expect(result).toEqual({
      ok: true,
      decision: "send",
      messages: [
        {
          notificationId: "n1",
          kind: "customer_link",
          to: ["pat@customer.ca"],
          replyTo: "estimator@northwind.ca",
          tenant: { legalName: "Northwind Mechanical Ltd.", phone: "604-555-0100", accent: "#0f766e" },
          agreement: { id: "a1", number: "AG-1052" },
          site: { name: "Harbourview Towers" },
          annualCents: 387000,
          tokenSealed: "v1.sealed",
          reminder: null,
        },
      ],
    });
  });

  test("C1029: a staff_stale message carries its org and the agreements with Date send dates", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({
      data: {
        decision: "send",
        messages: [
          {
            notificationId: "n1",
            kind: "staff_stale",
            orgId: "o1",
            to: ["owner@a.ca", "admin@a.ca"],
            tenant: { legalName: "A", phone: null, accent: null },
            agreements: [{ id: "a1", number: "AG-1", customerName: "C", sentAt: "2026-10-21T16:00:00+00:00" }],
          },
        ],
      },
      error: null,
    });
    const result = await supabaseAutomationCallbacks(typed).claim(CALLBACK);
    expect(result.ok && result.decision === "send" && result.messages[0]).toEqual({
      notificationId: "n1",
      kind: "staff_stale",
      orgId: "o1",
      to: ["owner@a.ca", "admin@a.ca"],
      tenant: { legalName: "A", phone: null, accent: null },
      agreements: [{ id: "a1", number: "AG-1", customerName: "C", sentAt: new Date("2026-10-21T16:00:00Z") }],
    });
  });

  test.each([
    [{ decision: "skip", reason: "viewed", messages: [] }, { ok: true, decision: "skip", reason: "viewed" }],
    [{ decision: "duplicate", messages: [] }, { ok: true, decision: "duplicate" }],
    [{ decision: "in_flight", messages: [] }, { ok: true, decision: "in_flight" }],
  ])("C1014/C1015/C1021: decision %j is read as it is", async (data, expected) => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data, error: null });
    expect(await supabaseAutomationCallbacks(typed).claim(CALLBACK)).toEqual(expected);
  });

  test.each([
    ["C1011", "42501", "unauthorized"],
    ["C1012", "22023", "malformed"],
    ["C1017", "P0002", "not_found"],
  ])("%s: SQLSTATE %s from claim is %s", async (_id, code, expected) => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail(code));
    expect(await supabaseAutomationCallbacks(typed).claim(CALLBACK)).toEqual({ ok: false, code: expected });
  });

  test("C1017: any other claim error is thrown", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail("XX000"));
    await expect(supabaseAutomationCallbacks(typed).claim(CALLBACK)).rejects.toThrow("XX000");
  });

  test("C1043: complete forwards the signed body and the results, and throws on an error", async () => {
    const { client, typed } = stubClient({});
    const results = [{ id: "n1", outcome: "sent" as const, providerMessageId: "re_1" }];
    await supabaseAutomationCallbacks(typed).complete(CALLBACK, results);
    expect(client.rpc).toHaveBeenCalledWith("automation_complete", {
      p_body: CALLBACK.body,
      p_timestamp: "1700000000",
      p_signature: CALLBACK.signature,
      p_results: results,
    });
    client.rpc.mockResolvedValue(fail("P0002"));
    await expect(supabaseAutomationCallbacks(typed).complete(CALLBACK, results)).rejects.toThrow("P0002");
  });
});
