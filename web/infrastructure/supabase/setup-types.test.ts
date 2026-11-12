import { afterEach, describe, expect, test, vi } from "vitest";
import type { DraftType } from "@/domain/task-library/draft";
import { supabaseOrgSetup } from "./setup";
import { stubClient } from "./stub-client";

const ORG = "00000000-0000-4000-8000-00000000f130";
const TYPES: DraftType[] = [
  { name: "Pool pump", defaultVisitMonths: [4, 10], synonyms: ["pool pumps"], tasks: [{ description: "Check seals" }, { description: "Clean the basket" }] },
  { name: "Sprinkler head", defaultVisitMonths: [5], synonyms: [], tasks: [{ description: "Test spray" }] },
];

afterEach(() => vi.restoreAllMocks());

describe("setup store: adding a drafted catalog", () => {
  test("C3426: one rpc add_catalog_types with the org and the camel-cased door 1 shape", async () => {
    const { typed, client } = stubClient({});
    client.rpc.mockResolvedValue({ data: ["POOL_PUMP", "SPRINKLER_HEAD"], error: null });
    expect(await supabaseOrgSetup(typed).addTypes(ORG, TYPES)).toEqual({ ok: true, codes: ["POOL_PUMP", "SPRINKLER_HEAD"] });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("add_catalog_types", {
      p_org_id: ORG,
      p_types: [
        { name: "Pool pump", defaultVisitMonths: [4, 10], synonyms: ["pool pumps"], tasks: [{ description: "Check seals" }, { description: "Clean the basket" }] },
        { name: "Sprinkler head", defaultVisitMonths: [5], synonyms: [], tasks: [{ description: "Test spray" }] },
      ],
    });
  });

  test("C3426: 42501 is forbidden, 23505 is a duplicate naming the type from the hint, 23514 is invalid, anything else is unavailable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const answer = async (error: { code: string; message: string; hint?: string | null }) => {
      const { typed, client } = stubClient({});
      client.rpc.mockResolvedValue({ data: null, error });
      return supabaseOrgSetup(typed).addTypes(ORG, TYPES);
    };
    expect(await answer({ code: "42501", message: "not allowed" })).toEqual({ ok: false, code: "forbidden" });
    expect(await answer({ code: "23505", message: "a type named Pool pump already exists", hint: "Pool pump" })).toEqual({ ok: false, code: "duplicate", name: "Pool pump" });
    expect(await answer({ code: "23505", message: "duplicate key value" })).toEqual({ ok: false, code: "duplicate", name: null });
    expect(await answer({ code: "23514", message: "bad month" })).toEqual({ ok: false, code: "invalid" });
    expect(await answer({ code: "XX000", message: "down" })).toEqual({ ok: false, code: "unavailable" });

    const thrown = stubClient({});
    thrown.client.rpc.mockRejectedValue(new Error("network down"));
    expect(await supabaseOrgSetup(thrown.typed).addTypes(ORG, TYPES)).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalled();
  });
});

describe("setup store: members are handed out detached", () => {
  test("C3427: draftAllowed works when called without its object, as the container calls it", async () => {
    const { typed } = stubClient({ org_settings: { data: [{ setup_completed_at: null }], error: null }, org_billing: { data: [{ other_trade: true }], error: null } });
    const { draftAllowed, isPending } = supabaseOrgSetup(typed);
    expect(await isPending(ORG)).toBe(true);
    expect(await draftAllowed(ORG)).toBe(true);
  });
});

describe("setup store: whether a draft is allowed", () => {
  const allowed = async (settings: unknown, billing: unknown) => {
    const { typed } = stubClient({
      org_settings: { data: settings, error: null },
      org_billing: { data: billing, error: null },
    });
    return supabaseOrgSetup(typed).draftAllowed(ORG);
  };

  test("C3427: true only while setup is pending and the org chose Other", async () => {
    expect(await allowed([{ setup_completed_at: null }], [{ other_trade: true }])).toBe(true);
  });

  test("C3427: false when setup is done, when Other was not chosen, and when there is no billing row", async () => {
    expect(await allowed([{ setup_completed_at: "2026-11-10T12:00:00Z" }], [{ other_trade: true }])).toBe(false);
    expect(await allowed([{ setup_completed_at: null }], [{ other_trade: false }])).toBe(false);
    expect(await allowed([{ setup_completed_at: null }], [])).toBe(false);
    expect(await allowed([], [{ other_trade: true }])).toBe(false);
  });

  test("C3427: a database error throws", async () => {
    const fail = stubClient({ org_settings: { data: null, error: { code: "XX000", message: "down" } }, org_billing: { data: [], error: null } });
    await expect(supabaseOrgSetup(fail.typed).draftAllowed(ORG)).rejects.toThrow(/XX000/);
    const failBilling = stubClient({ org_settings: { data: [{ setup_completed_at: null }], error: null }, org_billing: { data: null, error: { code: "XX001", message: "down" } } });
    await expect(supabaseOrgSetup(failBilling.typed).draftAllowed(ORG)).rejects.toThrow(/XX001/);
  });
});
