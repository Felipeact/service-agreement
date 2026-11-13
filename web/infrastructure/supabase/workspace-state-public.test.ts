import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: null, error: null }) } }),
}));

const { proxy } = await import("../../proxy");

const send = (path: string, method = "GET") => proxy(new NextRequest(new URL(path, "http://localhost:3000"), { method }));
const locationPath = (response: Response) => new URL(response.headers.get("location") as string).pathname;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});
afterEach(() => vi.unstubAllEnvs());

describe("the success page stays the only public path it adds", () => {
  test.each([
    ["GET", "/register/success?session_id=cs_test_1"],
    ["POST", "/register/success?session_id=cs_test_1"],
  ])("C4223: a signed-out %s %s passes with no redirect (the page and its Server Action)", async (method, path) => {
    const response = await send(path, method);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test.each(["/register/success/status?session_id=cs_test_1", "/register/success/x", "/api/register/status?session_id=cs_test_1"])(
    "C4223: signed out, %s is not public and redirects to /login",
    async (path) => {
      const response = await send(path);
      expect(response.status).toBe(307);
      expect(locationPath(response)).toBe("/login");
    },
  );
});
