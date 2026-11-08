import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Signed out: the session client finds no claims.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: null, error: null }) } }),
}));

const { proxy } = await import("./proxy");

const call = (path: string, method = "POST") => proxy(new NextRequest(new URL(path, "http://localhost:3000"), { method }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the proxy on DocuSeal's webhook", () => {
  test("C1737: a signed-out POST /api/webhooks/docuseal passes through with no redirect", async () => {
    const response = await call("/api/webhooks/docuseal");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test.each(["/api/webhooks", "/api/other/docuseal", "/webhooks/docuseal"])("C1737: signed out, %s still redirects to /login", async (path) => {
    const response = await call(path);
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") as string).pathname).toBe("/login");
  });
});
