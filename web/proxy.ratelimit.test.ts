import { NextRequest, NextResponse } from "next/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/infrastructure/supabase/session", () => ({
  updateSession: vi.fn(async () => new NextResponse("page", { status: 200 })),
}));

const { proxy } = await import("./proxy");

const call = (path: string, address?: string) =>
  proxy(new NextRequest(new URL(path, "http://localhost:3000"), address ? { headers: { "x-forwarded-for": address } } : undefined));

describe("the proxy rate limit", () => {
  test("sign-in is refused with 429 and Retry-After after 20 requests a minute from one address", async () => {
    for (let i = 0; i < 20; i += 1) expect((await call("/login", "203.0.113.50")).status).toBe(200);
    const refused = await call("/login", "203.0.113.50");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(refused.headers.get("Cache-Control")).toBe("no-store");
  });

  test("another address is not affected", async () => {
    expect((await call("/login", "203.0.113.51")).status).toBe(200);
  });

  test("a request with no client address is never limited", async () => {
    for (let i = 0; i < 25; i += 1) expect((await call("/register")).status).toBe(200);
  });

  test("ordinary pages are not limited", async () => {
    for (let i = 0; i < 70; i += 1) expect((await call("/pricing", "203.0.113.52")).status).toBe(200);
  });
});
