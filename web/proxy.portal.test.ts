import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The session step is the only other thing the proxy calls; it answers a marker so a pass-through is visible.
vi.mock("@/infrastructure/supabase/session", () => ({
  updateSession: vi.fn(async () => new NextResponse("page", { status: 200, headers: { "x-session": "ran" } })),
}));

const { proxy } = await import("./proxy");

const TOKEN = "U-FVzrQONnE0OeSkuG3mDhLni8aAqblTz4-KLseYCj4";
const COPY = "This link doesn&#39;t work. Ask the company that sent it for a new one.";
const fetchMock = vi.fn<typeof fetch>();
const call = (path: string, method = "GET") => proxy(new NextRequest(new URL(path, "http://localhost:3000"), { method }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ link: {} }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const expect404 = async (response: Response, method: string) => {
  expect(response.status).toBe(404);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  expect(response.headers.get("x-session")).toBeNull();
  if (method === "GET") {
    const html = await response.text();
    expect(html).toContain(COPY);
    expect(html).not.toContain("AG-");
  }
};

describe("the proxy handler on /review/<token>", () => {
  test.each(["GET", "HEAD"])("C910: %s of a malformed token is a 404 with the copy and the three headers", async (method) => {
    await expect404(await call(`/review/${"A".repeat(42)}`, method), method);
    await expect404(await call(`/review/${"A".repeat(42)}+`, method), method);
  });

  test.each(["GET", "HEAD"])("C910: %s of an unknown well-formed token is a 404 with the copy and the three headers", async (method) => {
    fetchMock.mockResolvedValue(Response.json(null));
    await expect404(await call(`/review/${TOKEN}`, method), method);
  });

  test("C910: a well-formed token with a link passes through to the page", async () => {
    const response = await call(`/review/${TOKEN}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-session")).toBe("ran");
  });

  test("C910: an empty token is not a page the proxy answers; the framework has no route for it and answers 404", async () => {
    // Existing C944 proof pins "/review/" as not a review page; Next also redirects it to "/review", which has no page.
    const response = await call("/review/");
    expect(response.headers.get("x-session")).toBe("ran");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("C910: other paths are untouched and make no database read", async () => {
    for (const path of ["/pipeline", "/login", `/review/${TOKEN}/pdf`, "/reviews/abc"]) {
      expect((await call(path)).headers.get("x-session")).toBe("ran");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
