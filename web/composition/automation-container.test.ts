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

  test("C1817: the signing link is opened with SIGNING_LINK_KEY, and a link sealed with PORTAL_LINK_KEY does not open", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("SIGNING_LINK_KEY", Buffer.alloc(32, 9).toString("base64"));
    vi.stubEnv("APP_BASE_URL", "https://agreements.northwind.ca");
    const { makePortalTokens } = await import("@/infrastructure/portal-tokens");
    const sealedWithSigning = makePortalTokens(process.env.SIGNING_LINK_KEY).seal("tok-signing");
    const sealedWithPortal = makePortalTokens(process.env.PORTAL_LINK_KEY).seal("tok-portal");
    const message = (sealed: string) => ({
      decision: "send",
      messages: [
        { notificationId: "11111111-1111-4111-8111-111111111111", kind: "customer_signing_link", to: ["pat@customer.ca"], tenant: { legalName: "Northwind", phone: null, accent: null }, agreement: { id: "a1", number: "AG-1" }, site: { name: "S" }, signerName: "Pat", linkSealed: sealed },
      ],
    });
    const answers: unknown[] = [message(sealedWithSigning), message(sealedWithPortal)];
    const sentBodies: string[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/rpc/automation_claim")) return Response.json(answers.shift());
      if (url.includes("/rpc/automation_complete")) return new Response(null, { status: 204 });
      sentBodies.push(String(init?.body));
      return Response.json({ id: "re_1" });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getAutomationContainer } = await import("./index");
    const { notify } = await getAutomationContainer("http://localhost:3000");
    const callback = { body: JSON.stringify({ idempotencyKey: "w2:e:link" }), timestamp: "1", signature: `sha256=${"a".repeat(64)}` };
    expect(await notify(callback)).toEqual({ ok: true, outcome: "sent" });
    expect(sentBodies).toHaveLength(1);
    expect(sentBodies[0]).toContain("https://agreements.northwind.ca/sign/tok-signing");
    expect(await notify(callback)).toEqual({ ok: false, code: "unavailable" });
    expect(sentBodies).toHaveLength(1);
  });
});
