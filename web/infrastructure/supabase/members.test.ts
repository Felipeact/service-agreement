import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, test, vi } from "vitest";
import { stubClient, type Reply } from "./stub-client";
import { supabaseInvitationAcceptor, supabaseInvitationLinkSender, supabaseMemberAdmin, supabaseMemberRoster } from "./members";
import type { Database } from "./database.types";

/** `list_members` is awaited after `.limit()`, so the rpc mock returns something with a `limit` that records its argument. */
function chainedRpc(reply: Reply) {
  const limit = vi.fn(async () => reply);
  const { client, typed } = stubClient({});
  client.rpc.mockImplementation((() => ({ limit })) as never);
  return { client, typed, limit };
}

const error = (code: string, hint: string | null = null, message = "boom"): Reply => ({ data: null, error: { code, message, hint } });

describe("MemberRoster", () => {
  test("C1499: members map to userId, email, role and a Date, in the order read, with one rpc call capped at 500", async () => {
    const { client, typed, limit } = chainedRpc({
      data: [
        { user_id: "u-1", email: "owner@example.com", role: "owner", joined_at: "2026-10-01T10:00:00Z" },
        { user_id: "u-2", email: "view@example.com", role: "viewer", joined_at: "2026-10-02T10:00:00Z" },
      ],
      error: null,
    });
    const members = await supabaseMemberRoster(typed).members();

    expect(members).toEqual([
      { userId: "u-1", email: "owner@example.com", role: "owner", joinedAt: new Date("2026-10-01T10:00:00Z") },
      { userId: "u-2", email: "view@example.com", role: "viewer", joinedAt: new Date("2026-10-02T10:00:00Z") },
    ]);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("list_members");
    expect(limit).toHaveBeenCalledWith(500);
  });

  test("C1499: invitations map to id, email, role and two Dates, in the order read, with one rpc call capped at 500", async () => {
    const { client, typed, limit } = chainedRpc({
      data: [{ id: "i-1", email: "new@x.test", role: "estimator", created_at: "2026-11-04T10:00:00Z", expires_at: "2026-11-18T10:00:00Z" }],
      error: null,
    });
    const invitations = await supabaseMemberRoster(typed).invitations();

    expect(invitations).toEqual([
      { id: "i-1", email: "new@x.test", role: "estimator", invitedAt: new Date("2026-11-04T10:00:00Z"), expiresAt: new Date("2026-11-18T10:00:00Z") },
    ]);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("list_invitations");
    expect(limit).toHaveBeenCalledWith(500);
  });

  test("C1499: an unexpected database error makes either read reject", async () => {
    const { typed } = chainedRpc(error("XX000"));
    await expect(supabaseMemberRoster(typed).members()).rejects.toThrow("XX000");
    await expect(supabaseMemberRoster(typed).invitations()).rejects.toThrow("XX000");
  });
});

describe("InvitationLinkSender", () => {
  function auth(reply: () => Promise<{ error: { status?: number; code?: string; message: string } | null }>) {
    const signInWithOtp = vi.fn(reply);
    return { signInWithOtp, typed: { auth: { signInWithOtp } } as unknown as SupabaseClient<Database> };
  }

  afterEach(() => vi.restoreAllMocks());

  test("C1516: asks once for a link that creates the login, and answers ok", async () => {
    const { signInWithOtp, typed } = auth(async () => ({ error: null }));
    expect(await supabaseInvitationLinkSender(typed).send("pat@example.com")).toEqual({ ok: true });
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "pat@example.com", options: { shouldCreateUser: true } });
  });

  test("C1516: a 429 is rate_limited", async () => {
    const { typed } = auth(async () => ({ error: { status: 429, code: "over_email_send_rate_limit", message: "slow down" } }));
    expect(await supabaseInvitationLinkSender(typed).send("pat@example.com")).toEqual({ ok: false, code: "rate_limited" });
  });

  test("C1516: any other error is unavailable and logs the code", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { typed } = auth(async () => ({ error: { status: 500, code: "unexpected_failure", message: "down" } }));
    expect(await supabaseInvitationLinkSender(typed).send("pat@example.com")).toEqual({ ok: false, code: "unavailable" });
    expect(String(log.mock.calls[0]?.[0])).toContain("unexpected_failure");
  });

  test("C1516: a thrown error is unavailable and logs the cause", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { typed } = auth(async () => {
      throw new Error("socket hang up");
    });
    expect(await supabaseInvitationLinkSender(typed).send("pat@example.com")).toEqual({ ok: false, code: "unavailable" });
    expect(String(log.mock.calls[0]?.[0])).toContain("socket hang up");
  });
});

describe("InvitationAcceptor", () => {
  afterEach(() => vi.restoreAllMocks());

  test("C1528: one rpc call with no arguments, and the number it answers", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: 1, error: null });
    expect(await supabaseInvitationAcceptor(typed).acceptInvitations()).toBe(1);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("accept_invitations");
  });

  test("C1528: an rpc error is logged and answers 0, and so does a thrown one", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(error("XX000"));
    expect(await supabaseInvitationAcceptor(typed).acceptInvitations()).toBe(0);
    expect(String(log.mock.calls[0]?.[0])).toContain("XX000");

    client.rpc.mockRejectedValue(new Error("network down"));
    expect(await supabaseInvitationAcceptor(typed).acceptInvitations()).toBe(0);
    expect(String(log.mock.calls[1]?.[0])).toContain("network down");
  });
});

describe("MemberAdmin", () => {
  afterEach(() => vi.restoreAllMocks());

  function admin(reply: Reply) {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(reply);
    return { client, admin: supabaseMemberAdmin(typed) };
  }

  test("C1542: each operation calls the rpc named for it with the p_ arguments and writes no table", async () => {
    const { client, admin: members } = admin({ data: "inv-1", error: null });
    expect(await members.invite("pat@example.com", "estimator")).toEqual({ ok: true, id: "inv-1" });
    expect(await members.revoke("inv-1")).toEqual({ ok: true });
    expect(await members.setRole("u-2", "admin")).toEqual({ ok: true });
    expect(await members.remove("u-3")).toEqual({ ok: true });

    expect(client.rpc.mock.calls).toEqual([
      ["create_invitation", { p_email: "pat@example.com", p_role: "estimator" }],
      ["revoke_invitation", { p_invitation_id: "inv-1" }],
      ["set_member_role", { p_user_id: "u-2", p_role: "admin" }],
      ["remove_member", { p_user_id: "u-3" }],
    ]);
  });

  const MAPPED = [
    ["23505", "already_member", "already_member"],
    ["23514", "invalid_email", "invalid"],
    ["55000", "owner_only", "owner_only"],
    ["55000", "last_owner", "last_owner"],
    ["55000", "self", "self"],
    ["42501", null, "forbidden"],
    ["P0002", null, "not_found"],
  ] as const;

  /** What each operation can meet: a code outside its own list is a bug or an outage, so it reads unavailable. */
  const REACHABLE = {
    invite: ["already_member", "invalid", "owner_only", "forbidden"],
    revoke: ["not_found", "forbidden"],
    setRole: ["owner_only", "last_owner", "self", "not_found", "forbidden"],
    remove: ["owner_only", "last_owner", "self", "not_found", "forbidden"],
  } as const;

  const call = (members: ReturnType<typeof supabaseMemberAdmin>, op: keyof typeof REACHABLE) => {
    if (op === "invite") return members.invite("pat@example.com", "viewer");
    if (op === "revoke") return members.revoke("inv-1");
    if (op === "setRole") return members.setRole("u-2", "viewer");
    return members.remove("u-2");
  };

  test.each(Object.keys(REACHABLE) as (keyof typeof REACHABLE)[])("C1542: %s maps each database refusal it can meet and reads the rest as unavailable", async (op) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [code, hint, state] of MAPPED) {
      const result = await call(admin(error(code, hint)).admin, op);
      const reachable = (REACHABLE[op] as readonly string[]).includes(state);
      expect(result).toEqual({ ok: false, code: reachable ? state : "unavailable" });
    }
  });

  test.each([
    ["a 55000 with another hint", "55000", "something_else"],
    ["a 23505 with another hint", "23505", "something_else"],
    ["a 23505 with no hint", "23505", null],
    ["any other code", "XX000", null],
  ])("C1542: %s is unavailable and is logged", async (_label, code, hint) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const op of Object.keys(REACHABLE) as (keyof typeof REACHABLE)[]) {
      expect(await call(admin(error(code, hint)).admin, op)).toEqual({ ok: false, code: "unavailable" });
    }
    expect(log).toHaveBeenCalledTimes(4);
    expect(String(log.mock.calls[0]?.[0])).toContain(code);
  });
});
