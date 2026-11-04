import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { EmailLinkResult } from "@/application/ports";

const verifyEmailLink = vi.fn<(tokenHash: string) => Promise<EmailLinkResult>>();
const acceptInvitations = vi.fn<() => Promise<number>>();
vi.mock("@/composition", () => ({ getContainer: async () => ({ verifyEmailLink, acceptInvitations }) }));

const { GET } = await import("./route");

const confirm = (query: string) => GET(new NextRequest(`http://localhost:3000/auth/confirm${query}`));
const location = (response: Response) => new URL(response.headers.get("location") as string);

beforeEach(() => {
  verifyEmailLink.mockReset();
  acceptInvitations.mockReset();
  acceptInvitations.mockResolvedValue(0);
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
    ["verified", { ok: true } as const, "/pipeline"],
    ["refused", { ok: false, code: "invalid_link" } as const, "/login"],
  ])("C12: behind a proxy the redirect (%s) stays on the public host, not the container's", async (_label, result, pathname) => {
    vi.stubEnv("APP_BASE_URL", "");
    verifyEmailLink.mockResolvedValue(result);
    const request = new NextRequest("http://localhost:8080/auth/confirm?token_hash=abc&type=email", {
      headers: { "x-forwarded-host": "web.up.railway.app", "x-forwarded-proto": "https" },
    });
    const next = location(await GET(request));

    expect(next.origin).toBe("https://web.up.railway.app");
    expect(next.pathname).toBe(pathname);
    vi.unstubAllEnvs();
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

  test("C1527: a valid link verifies, then accepts invitations once, then lands on /pipeline", async () => {
    const order: string[] = [];
    verifyEmailLink.mockImplementation(async () => {
      order.push("verify");
      return { ok: true };
    });
    acceptInvitations.mockImplementation(async () => {
      order.push("accept");
      return 1;
    });
    const response = await confirm("?token_hash=abc&type=email");

    expect(order).toEqual(["verify", "accept"]);
    expect(acceptInvitations).toHaveBeenCalledTimes(1);
    expect(location(response).pathname).toBe("/pipeline");
  });

  test.each([
    ["a refused link", "?token_hash=abc&type=email", { ok: false, code: "invalid_link" } as const],
    ["no token_hash", "?type=email", { ok: true } as const],
    ["type=magiclink", "?token_hash=abc&type=magiclink", { ok: true } as const],
  ])("C1527: %s never accepts anything and goes to /login", async (_label, query, result) => {
    verifyEmailLink.mockResolvedValue(result);
    const response = await confirm(query);

    expect(acceptInvitations).not.toHaveBeenCalled();
    expect(location(response).pathname).toBe("/login");
  });

  test.each([
    ["answers 0", async () => 0],
    ["throws", async () => Promise.reject(new Error("rpc down"))],
  ])("C1527: when accepting %s the person still lands on /pipeline", async (_label, accept) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    verifyEmailLink.mockResolvedValue({ ok: true });
    acceptInvitations.mockImplementation(accept);
    const response = await confirm("?token_hash=abc&type=email");

    expect(location(response).pathname).toBe("/pipeline");
    expect(location(response).searchParams.has("token_hash")).toBe(false);
    log.mockRestore();
  });
});
