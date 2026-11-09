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

describe("the proxy on the pricing page", () => {
  test("C2401: a signed-out GET /pricing passes through with no redirect", async () => {
    const response = await get("/pricing");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test("C2402: a signed-in GET /pricing passes through, not sent to /pipeline", async () => {
    claims = { sub: "11111111-1111-4111-8111-111111111111" };
    const response = await get("/pricing");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test("C2403: a query string does not change the path, so /pricing?plan=team still passes", async () => {
    const response = await get("/pricing?plan=team");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test.each(["/pricing/x", "/pricingx", "/pricing/x/y"])("C2403: signed out, %s still redirects to /login", async (path) => {
    const response = await get(path);
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/login");
  });
});
