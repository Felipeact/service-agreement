import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("EMAIL_FROM", "agreements@felipeviana.com");
  vi.stubEnv("PORTAL_LINK_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the automation container", () => {
  test("C1018: with RESEND_API_KEY unset a valid signed request is 503, logs email not configured, and makes no fetch", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("@/app/api/automation/notify/route");
    const body = JSON.stringify({ idempotencyKey: "w5:2026-10-29", kind: "staff_stale", executionId: "exec-1" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `sha256=${createHmac("sha256", "test-secret").update(`${timestamp}.${body}`).digest("hex")}`;
    const response = await POST(
      new NextRequest("http://localhost:3000/api/automation/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-SA-Timestamp": timestamp, "X-SA-Signature": signature },
        body,
      }),
    );
    expect(response.status).toBe(503);
    expect(log.mock.calls.some((args) => args.some((arg) => String(arg).includes("email not configured")))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  test("with RESEND_API_KEY and EMAIL_FROM set it wires the callback use case", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const { getAutomationContainer } = await import("./index");
    expect(typeof (await getAutomationContainer("http://localhost:3000")).notify).toBe("function");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
