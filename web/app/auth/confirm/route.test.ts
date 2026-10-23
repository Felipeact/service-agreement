import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { EmailLinkResult } from "@/application/ports";

const verifyEmailLink = vi.fn<(tokenHash: string) => Promise<EmailLinkResult>>();
vi.mock("@/composition", () => ({ getContainer: async () => ({ verifyEmailLink }) }));

const { GET } = await import("./route");

const confirm = (query: string) => GET(new NextRequest(`http://localhost:3000/auth/confirm${query}`));
const location = (response: Response) => new URL(response.headers.get("location") as string);

beforeEach(() => {
  verifyEmailLink.mockReset();
});

describe("GET /auth/confirm", () => {
  test("C8: a valid link signs in and lands on /pipeline", async () => {
    verifyEmailLink.mockResolvedValue({ ok: true });
    const response = await confirm("?token_hash=abc&type=email");

    expect(response.status).toBe(307);
    expect(location(response).pathname).toBe("/pipeline");
    expect(verifyEmailLink).toHaveBeenCalledTimes(1);
    expect(verifyEmailLink).toHaveBeenCalledWith("abc");
  });

  test.each([
    ["no token_hash", "?type=email"],
    ["type=magiclink", "?token_hash=abc&type=magiclink"],
    ["no type", "?token_hash=abc"],
  ])("C9: %s goes back to /login without verifying", async (_label, query) => {
    const response = await confirm(query);

    expect(response.status).toBe(307);
    expect(location(response).pathname).toBe("/login");
    expect(location(response).search).toBe("?error=link_invalid");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(verifyEmailLink).toHaveBeenCalledTimes(0);
  });

  test("C9: a link Supabase refuses goes back to /login", async () => {
    verifyEmailLink.mockResolvedValue({ ok: false, code: "invalid_link" });
    const response = await confirm("?token_hash=abc&type=email");

    expect(response.status).toBe(307);
    expect(location(response).pathname).toBe("/login");
    expect(location(response).search).toBe("?error=link_invalid");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test.each([
    ["verified", { ok: true } as const, "?token_hash=abc&type=email"],
    ["refused", { ok: false, code: "invalid_link" } as const, "?token_hash=abc&type=email"],
    ["no token_hash", { ok: true } as const, "?type=email"],
    ["type=magiclink", { ok: true } as const, "?token_hash=abc&type=magiclink"],
    ["no type", { ok: true } as const, "?token_hash=abc"],
  ])("C11: the redirect never carries token_hash (%s)", async (_label, result, query) => {
    verifyEmailLink.mockResolvedValue(result);
    const response = await confirm(query);
    expect(location(response).searchParams.has("token_hash")).toBe(false);
  });
});
