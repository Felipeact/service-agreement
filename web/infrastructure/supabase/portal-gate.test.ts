import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { portalGate } from "./portal-gate";

const TOKEN = "U-FVzrQONnE0OeSkuG3mDhLni8aAqblTz4-KLseYCj4";
const HASH = createHash("sha256").update(TOKEN).digest("hex");

const request = (path: string, method = "GET") => new NextRequest(new URL(path, "http://localhost:3000"), { method });
const fetchMock = vi.fn<typeof fetch>();

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

const is404 = async (response: Response | null) => {
  if (response === null || response.status !== 404) return false;
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  const html = await response.text();
  expect(html).toContain("This link doesn&#39;t work. Ask the company that sent it for a new one.");
  expect(html).not.toContain("AG-");
  return true;
};

describe("portalGate", () => {
  test.each([
    ["42 characters", "A".repeat(42)],
    ["44 characters", "A".repeat(44)],
    ["a plus sign", `${"A".repeat(42)}+`],
    ["a dot", `${"A".repeat(42)}.`],
    ["short", "short"],
  ])("C910: %s is a 404 with no database read", async (_name, token) => {
    expect(await is404(await portalGate(request(`/review/${token}`)))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("C910: a well-formed token with no link is a 404", async () => {
    fetchMock.mockResolvedValue(Response.json(null));
    expect(await is404(await portalGate(request(`/review/${TOKEN}`)))).toBe(true);
  });

  test("C910: a token with a link goes on to the page", async () => {
    expect(await portalGate(request(`/review/${TOKEN}`))).toBeNull();
  });

  test("C910: it asks portal_view with the hash and the publishable key, never the token", async () => {
    await portalGate(request(`/review/${TOKEN}`));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/portal_view");
    expect(init?.body).toBe(JSON.stringify({ p_token_hash: HASH }));
    expect(JSON.stringify(init)).not.toContain(TOKEN);
    expect(init?.headers).toMatchObject({ apikey: "sb_publishable_test" });
  });

  test.each([
    ["a rejected request", () => fetchMock.mockRejectedValue(new Error("offline"))],
    ["an error status", () => fetchMock.mockResolvedValue(new Response("boom", { status: 500 }))],
  ])("C932: %s lets the request on, so the page shows its own error", async (_name, arrange) => {
    arrange();
    expect(await portalGate(request(`/review/${TOKEN}`))).toBeNull();
  });

  test.each(["/review/abc/pdf", "/review", "/review/", "/pipeline", "/login", "/reviews/abc"])("C944: %s is not a review page", async (path) => {
    expect(await portalGate(request(path))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("C910: a HEAD (curl -I) gets the same 404", async () => {
    expect((await portalGate(request("/review/short", "HEAD")))?.status).toBe(404);
  });

  test("C925: only a GET is checked, so a Server Action post is left alone", async () => {
    expect(await portalGate(request(`/review/${"A".repeat(42)}`, "POST"))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
