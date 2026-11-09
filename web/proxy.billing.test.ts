import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: null, error: null }) } }),
}));

const { proxy } = await import("./proxy");

const send = (path: string, method = "GET") => proxy(new NextRequest(new URL(path, "http://localhost:3000"), { method }));
const locationPath = (response: Response) => new URL(response.headers.get("location") as string).pathname;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the proxy on the billing paths", () => {
  test.each([
    ["GET", "/register/success"],
    ["POST", "/api/webhooks/stripe"],
  ])("C2530: a signed-out %s %s passes with no redirect", async (method, path) => {
    const response = await send(path, method);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test.each(["/register/success/x", "/register/successx"])("C2531: signed out, %s redirects to /login", async (path) => {
    const response = await send(path);
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/login");
  });
});
