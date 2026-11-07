import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The session step is the only other thing the proxy calls; it answers a marker so a pass-through is visible.
vi.mock("@/infrastructure/supabase/session", () => ({
  updateSession: vi.fn(async () => new NextResponse("page", { status: 200, headers: { "x-session": "ran" } })),
}));

const { proxy } = await import("./proxy");

const TOKEN = "U-FVzrQONnE0OeSkuG3mDhLni8aAqblTz4-KLseYCj4";
const fetchMock = vi.fn<typeof fetch>();
const call = (path: string) => proxy(new NextRequest(new URL(path, "http://localhost:3000")));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ requestStatus: "open" }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the proxy handler on /sign/<token>", () => {
  test("C1701: the signing gate runs before the session step: a malformed token is a 404 and the session step never runs", async () => {
    const response = await call(`/sign/${"A".repeat(42)}`);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-session")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("C1701: an unknown well-formed token is a 404 before the session step", async () => {
    fetchMock.mockResolvedValue(Response.json(null));
    const response = await call(`/sign/${TOKEN}`);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-session")).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/rest/v1/rpc/signature_view");
  });

  test("C1701: a token with a page passes through to the session step", async () => {
    const response = await call(`/sign/${TOKEN}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-session")).toBe("ran");
  });

  test("C1701: the review gate still answers /review/<token> and reads portal_view, not signature_view", async () => {
    fetchMock.mockResolvedValue(Response.json(null));
    const response = await call(`/review/${TOKEN}`);
    expect(response.status).toBe(404);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/rest/v1/rpc/portal_view");
  });
});
