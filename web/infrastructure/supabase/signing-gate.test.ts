import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { signingGate } from "./signing-gate";

const TOKEN = "U-FVzrQONnE0OeSkuG3mDhLni8aAqblTz4-KLseYCj4";
const fetchMock = vi.fn<typeof fetch>();
const request = (path: string, method = "GET") => new NextRequest(new URL(path, "http://localhost:3000"), { method });

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

const expect404 = async (response: Response | null, method: string) => {
  expect(response?.status).toBe(404);
  expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response?.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(response?.headers.get("X-Robots-Tag")).toBe("noindex");
  if (method === "GET") {
    const html = (await response!.text()).toLowerCase();
    expect(html).toContain("doesn&#39;t work");
    expect(html).not.toContain("ag-");
  }
};

describe("signingGate", () => {
  test.each(["GET", "HEAD"])("C1698: a malformed token is a %s 404 with the three headers and no database read", async (method) => {
    await expect404(await signingGate(request(`/sign/${"A".repeat(42)}`, method)), method);
    await expect404(await signingGate(request(`/sign/${"A".repeat(42)}+`, method)), method);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(["GET", "HEAD"])("C1698: a well-formed token whose signature_view answer is null is a %s 404 with the three headers", async (method) => {
    fetchMock.mockResolvedValue(Response.json(null));
    await expect404(await signingGate(request(`/sign/${TOKEN}`, method)), method);
  });

  test("C1699: a token with a page passes through, and the call posts the lowercase hex SHA-256 of the token to signature_view", async () => {
    expect(await signingGate(request(`/sign/${TOKEN}`))).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/signature_view");
    expect(JSON.parse(String(init?.body))).toEqual({ p_token_hash: createHash("sha256").update(TOKEN, "utf8").digest("hex") });
    expect(new Headers(init?.headers).get("apikey")).toBe("sb_publishable_test");
  });

  test("C1699: a failed call and a non-2xx answer let the request on, so a good link is never turned away", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await signingGate(request(`/sign/${TOKEN}`))).toBeNull();
    fetchMock.mockReset().mockResolvedValue(new Response("boom", { status: 500 }));
    expect(await signingGate(request(`/sign/${TOKEN}`))).toBeNull();
  });

  test.each(["POST", "PUT", "DELETE"])("C1699: a %s is not a page and passes through without a read", async (method) => {
    expect(await signingGate(request(`/sign/${"A".repeat(42)}`, method))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("C1699: a path that is not a signing page passes through without a read", async () => {
    for (const path of ["/sign", "/sign/", `/sign/${TOKEN}/extra`, `/review/${TOKEN}`, "/pipeline"]) {
      expect(await signingGate(request(path)), path).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
