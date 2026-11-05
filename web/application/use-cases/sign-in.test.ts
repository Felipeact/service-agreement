import { describe, expect, test, vi } from "vitest";
import type { AuthGateway, MagicLinkResult } from "@/application/ports";
import { makeRequestSignInLink } from "./sign-in";

function fakeGateway(result: MagicLinkResult = { ok: true }) {
  const gateway: AuthGateway = {
    requestMagicLink: vi.fn(async () => result),
    verifyEmailLink: vi.fn(async () => ({ ok: true as const })),
    signOut: vi.fn(async () => {}),
  };
  return gateway;
}

describe("requestSignInLink", () => {
  test("C1: trims and lowercases the email before asking for a link", async () => {
    const gateway = fakeGateway();
    const result = await makeRequestSignInLink(gateway)("  Owner@Example.COM ");

    expect(result).toEqual({ ok: true, email: "owner@example.com" });
    expect(gateway.requestMagicLink).toHaveBeenCalledTimes(1);
    expect(gateway.requestMagicLink).toHaveBeenCalledWith("owner@example.com");
  });

  test.each([
    ["empty", ""],
    ["blank", "   "],
    ["no TLD", "owner@example"],
    ["no @", "owner.example.com"],
    ["a space", "own er@example.com"],
    ["255 characters", `${"a".repeat(243)}@example.com`],
  ])("C4: rejects %s without calling Supabase", async (_label, value) => {
    const gateway = fakeGateway();
    const result = await makeRequestSignInLink(gateway)(value);

    expect(result).toEqual({ ok: false, code: "invalid_email" });
    expect(gateway.requestMagicLink).toHaveBeenCalledTimes(0);
  });

  test("C4: accepts a 254-character address", async () => {
    const email = `${"a".repeat(242)}@example.com`;
    expect(email).toHaveLength(254);
    const gateway = fakeGateway();

    expect(await makeRequestSignInLink(gateway)(email)).toEqual({ ok: true, email });
  });
});
