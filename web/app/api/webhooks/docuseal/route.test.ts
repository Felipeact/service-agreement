import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReceiveSignatureEventResult } from "@/application/ports";

const receive = vi.fn<(delivery: { body: string; signature: string }) => Promise<ReceiveSignatureEventResult>>();
const getWebhookContainer = vi.fn(async () => ({ receive }));
vi.mock("@/composition", () => ({ getWebhookContainer }));

const { POST } = await import("./route");

const SIGNATURE = `1790000000.${"a".repeat(64)}`;
const BODY = JSON.stringify({ event_type: "form.viewed", a: "é" });

const call = (headers: Record<string, string> | undefined, body = BODY) =>
  POST(new NextRequest("http://localhost:3000/api/webhooks/docuseal", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body }));

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  receive.mockResolvedValue({ ok: true, outcome: "applied" });
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorLog.mockRestore();
});

describe("POST /api/webhooks/docuseal", () => {
  test("C1727: the use case gets the exact raw body and the exact header", async () => {
    const response = await call({ "X-Docuseal-Signature": SIGNATURE });
    expect(response.status).toBe(200);
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledWith({ body: '{"event_type":"form.viewed","a":"é"}', signature: SIGNATURE });
  });

  test.each([
    ["no header", undefined],
    ["abc", "abc"],
    ["no dot", "1790000000"],
    ["no seconds", `.${"a".repeat(64)}`],
    ["63 hex", `1790000000.${"a".repeat(63)}`],
    ["upper-case hex", `1790000000.${"A".repeat(64)}`],
    ["13-digit seconds", `1790000000000.${"a".repeat(64)}`],
  ])("C1728: %s is 401 and calls nothing", async (_label, header) => {
    const response = await call(header === undefined ? undefined : { "X-Docuseal-Signature": header });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(receive).not.toHaveBeenCalled();
    expect(getWebhookContainer).not.toHaveBeenCalled();
  });

  test.each<[string, ReceiveSignatureEventResult, number, unknown]>([
    ["applied", { ok: true, outcome: "applied" }, 200, { outcome: "applied" }],
    ["duplicate", { ok: true, outcome: "duplicate" }, 200, { outcome: "duplicate" }],
    ["ignored", { ok: true, outcome: "ignored", reason: "unknown_submission" }, 200, { outcome: "ignored", reason: "unknown_submission" }],
    ["unauthorized", { ok: false, code: "unauthorized" }, 401, { error: "unauthorized" }],
    ["malformed", { ok: false, code: "malformed" }, 400, { error: "malformed" }],
    ["unavailable", { ok: false, code: "unavailable" }, 503, { error: "unavailable" }],
  ])("C1734: the use case result %s is answered as %i", async (_label, result, status, body) => {
    receive.mockResolvedValue(result);
    const response = await call({ "X-Docuseal-Signature": SIGNATURE });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
  });

  test("C1735: a thrown error is 503 and the log holds neither the body nor the header", async () => {
    receive.mockRejectedValue(new Error("db down"));
    const response = await call({ "X-Docuseal-Signature": SIGNATURE }, '{"secret":"BODY-MARKER"}');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(errorLog).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).not.toContain("BODY-MARKER");
    expect(logged).not.toContain(SIGNATURE);
  });

  test("C1735: a container that cannot be built is 503 too", async () => {
    getWebhookContainer.mockRejectedValueOnce(new Error("Missing environment variable NEXT_PUBLIC_SUPABASE_URL"));
    const response = await call({ "X-Docuseal-Signature": SIGNATURE });
    expect(response.status).toBe(503);
  });

  test("C1736: 200, 400, 401 and 503 each carry Cache-Control: no-store", async () => {
    const statuses: number[] = [];
    for (const result of [{ ok: true, outcome: "applied" }, { ok: false, code: "malformed" }, { ok: false, code: "unauthorized" }, { ok: false, code: "unavailable" }] as ReceiveSignatureEventResult[]) {
      receive.mockResolvedValue(result);
      const response = await call({ "X-Docuseal-Signature": SIGNATURE });
      statuses.push(response.status);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    const unsigned = await call(undefined);
    statuses.push(unsigned.status);
    expect(unsigned.headers.get("cache-control")).toBe("no-store");
    expect(statuses).toEqual([200, 400, 401, 503, 401]);
  });
});
