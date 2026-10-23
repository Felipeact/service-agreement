import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Database } from "./database.types";
import { supabaseAuthGateway, supabaseMemberDirectory } from "./auth";

type AuthError = { status: number; code: string; message: string } | null;

function stubAuth(auth: Record<string, unknown>, rows: unknown[] = []) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: rows, error: null })),
  };
  const client = { auth, from: vi.fn(() => query) };
  return { client, query, typed: client as unknown as SupabaseClient<Database> };
}

const otpReply = (error: AuthError) => vi.fn(async () => ({ data: { user: null, session: null }, error }));
const claimsReply = (claims: Record<string, unknown> | null) =>
  vi.fn(async () =>
    claims ? { data: { claims, header: {}, signature: new Uint8Array() }, error: null } : { data: null, error: null },
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("supabaseAuthGateway", () => {
  test("C1: asks Supabase for a link without creating a user", async () => {
    const signInWithOtp = otpReply(null);
    const { typed } = stubAuth({ signInWithOtp });

    expect(await supabaseAuthGateway(typed).requestMagicLink("owner@example.com")).toEqual({ ok: true });
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "owner@example.com", options: { shouldCreateUser: false } });
  });

  test("C3: an unknown email (422 otp_disabled) answers like a sent link", async () => {
    const { typed } = stubAuth({
      signInWithOtp: otpReply({ status: 422, code: "otp_disabled", message: "Signups not allowed for otp" }),
    });
    expect(await supabaseAuthGateway(typed).requestMagicLink("nobody@example.com")).toEqual({ ok: true });
  });

  test("C5: a 429 is rate_limited", async () => {
    const { typed } = stubAuth({
      signInWithOtp: otpReply({ status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" }),
    });
    expect(await supabaseAuthGateway(typed).requestMagicLink("owner@example.com")).toEqual({
      ok: false,
      code: "rate_limited",
    });
  });

  test("C6: any other error is unavailable and logs the code", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { typed } = stubAuth({ signInWithOtp: otpReply({ status: 500, code: "unexpected_failure", message: "boom" }) });

    expect(await supabaseAuthGateway(typed).requestMagicLink("owner@example.com")).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain("unexpected_failure");
  });

  test("C6: a failed request is unavailable and logs the cause", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const signInWithOtp = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const { typed } = stubAuth({ signInWithOtp });

    expect(await supabaseAuthGateway(typed).requestMagicLink("owner@example.com")).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(String(log.mock.calls[0][0])).toContain("fetch failed");
  });

  test("C8: verifies the token hash as an email link", async () => {
    const verifyOtp = otpReply(null);
    const { typed } = stubAuth({ verifyOtp });

    expect(await supabaseAuthGateway(typed).verifyEmailLink("abc")).toEqual({ ok: true });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "email" });
  });

  test("C9: an expired or used link (403 otp_expired) is invalid_link", async () => {
    const { typed } = stubAuth({
      verifyOtp: otpReply({ status: 403, code: "otp_expired", message: "Email link is invalid or has expired" }),
    });
    expect(await supabaseAuthGateway(typed).verifyEmailLink("abc")).toEqual({ ok: false, code: "invalid_link" });
  });

  test("C21: signs out this browser only", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const { typed } = stubAuth({ signOut });

    await supabaseAuthGateway(typed).signOut();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("supabaseMemberDirectory", () => {
  const claims = { sub: "u1", email: "owner@example.com" };

  test("C17: no claims is signed_out, without reading any table", async () => {
    const { typed, client } = stubAuth({ getClaims: claimsReply(null) });

    expect(await supabaseMemberDirectory(typed).currentMember()).toEqual({ status: "signed_out" });
    expect(client.from).toHaveBeenCalledTimes(0);
  });

  test("C17: the membership is looked up by the sub claim", async () => {
    const { typed, client, query } = stubAuth({ getClaims: claimsReply(claims) });

    await supabaseMemberDirectory(typed).currentMember();
    expect(client.from).toHaveBeenCalledWith("memberships");
    expect(query.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  test("C18: a membership row becomes the member", async () => {
    const { typed } = stubAuth({ getClaims: claimsReply(claims) }, [
      { org_id: "o1", role: "owner", orgs: { name: "Kettle Ridge Mechanical Ltd." } },
    ]);

    expect(await supabaseMemberDirectory(typed).currentMember()).toEqual({
      status: "member",
      userId: "u1",
      email: "owner@example.com",
      orgId: "o1",
      orgName: "Kettle Ridge Mechanical Ltd.",
      role: "owner",
    });
  });

  test("C19: no membership row is no_membership", async () => {
    const { typed } = stubAuth({ getClaims: claimsReply(claims) }, []);
    expect(await supabaseMemberDirectory(typed).currentMember()).toEqual({
      status: "no_membership",
      email: "owner@example.com",
    });
  });

  test("C20: the earliest membership wins", async () => {
    const { typed, query } = stubAuth({ getClaims: claimsReply(claims) }, []);

    await supabaseMemberDirectory(typed).currentMember();
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(query.limit).toHaveBeenCalledWith(1);
  });
});
