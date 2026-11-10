import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The session client finds claims or not, per test.
let claims: { sub: string } | null = null;
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: claims ? { claims } : null, error: null }) } }),
}));

const { proxy } = await import("./proxy");

const get = (path: string) => proxy(new NextRequest(new URL(path, "http://localhost:3000"), { method: "GET" }));
const locationPath = (response: Response) => new URL(response.headers.get("location") as string).pathname;

beforeEach(() => {
  claims = null;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the proxy on the setup page", () => {
  test("C2807: a signed-out GET /setup is sent to /login", async () => {
    const response = await get("/setup");
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(locationPath(response)).toBe("/login");
  });

  test("C2807: a signed-in GET /setup passes through to the page", async () => {
    claims = { sub: "11111111-1111-4111-8111-111111111111" };
    const response = await get("/setup");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
