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

const SITE_PATHS = ["/", "/product", "/demo", "/trades", "/pricing", "/about", "/faq", "/contact", "/register", "/concepts/a"];

beforeEach(() => {
  claims = null;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the proxy on the public site", () => {
  test.each(SITE_PATHS)("public-site: a signed-out GET %s passes through with no redirect", async (path) => {
    const response = await get(path);
    expect(response.headers.get("location")).toBeNull();
  });

  test.each(SITE_PATHS)("public-site: a signed-in GET %s passes through, not sent to /pipeline", async (path) => {
    claims = { sub: "u1" };
    const response = await get(path);
    expect(response.headers.get("location")).toBeNull();
  });

  test.each(["/product/x", "/demox", "/about/team", "/register/done", "/concepts"])("public-site: signed out, %s still redirects to /login", async (path) => {
    const response = await get(path);
    expect(locationPath(response)).toBe("/login");
  });

  test("public-site: a signed-out visitor to an app page is still sent to /login", async () => {
    expect(locationPath(await get("/pipeline"))).toBe("/login");
  });
});
