import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };
type CookieAdapter = { getAll(): unknown; setAll(cookies: CookieToSet[], headers: Record<string, string>): void };

/** What the mocked client's getClaims does: optionally refresh cookies, then answer with or without claims. */
let scenario: { claims: Record<string, unknown> | null; refresh?: CookieToSet[] };

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: CookieAdapter }) => ({
    auth: {
      getClaims: async () => {
        if (scenario.refresh) options.cookies.setAll(scenario.refresh, { "Cache-Control": "private, no-store" });
        return scenario.claims
          ? { data: { claims: scenario.claims, header: {}, signature: new Uint8Array() }, error: null }
          : { data: null, error: null };
      },
    },
  }),
}));

const { updateSession } = await import("./session");

const request = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));
const locationPath = (response: Response) => new URL(response.headers.get("location") as string).pathname;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("updateSession", () => {
  test.each(["/pipeline", "/", "/customers/abc"])("C12: signed out, %s redirects to /login", async (path) => {
    scenario = { claims: null };
    const response = await updateSession(request(path));

    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/login");
  });

  test.each(["/login", "/auth/confirm"])("C12: signed out, %s passes through", async (path) => {
    scenario = { claims: null };
    const response = await updateSession(request(path));

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  test("C13: signed in, /login redirects to /pipeline", async () => {
    scenario = { claims: { sub: "u1" } };
    const response = await updateSession(request("/login"));

    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/pipeline");
  });

  test("C13: signed in, /pipeline passes through", async () => {
    scenario = { claims: { sub: "u1" } };
    const response = await updateSession(request("/pipeline"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  const refreshed: CookieToSet = {
    name: "sb-test-auth-token",
    value: "refreshed",
    options: { path: "/", maxAge: 3600, sameSite: "lax" },
  };

  test.each([
    ["passes through", { sub: "u1" }],
    ["redirects", null],
  ])("C14: refreshed cookies reach the response when it %s", async (_label, claims) => {
    scenario = { claims, refresh: [refreshed] };
    const response = await updateSession(request("/pipeline"));

    const cookie = response.cookies.get("sb-test-auth-token");
    expect(cookie?.value).toBe("refreshed");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(3600);
    expect(cookie?.sameSite).toBe("lax");
  });

  test.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"])(
    "C28: an unset %s is named in the error",
    async (name) => {
      scenario = { claims: null };
      vi.stubEnv(name, "");
      await expect(updateSession(request("/pipeline"))).rejects.toThrow(name);
    },
  );
});
