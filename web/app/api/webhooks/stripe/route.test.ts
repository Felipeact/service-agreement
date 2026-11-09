import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReceiveStripeEventResult } from "@/application/ports";

const receiveStripe = vi.fn<(delivery: { body: string; signature: string }) => Promise<ReceiveStripeEventResult>>();
const getWebhookContainer = vi.fn(async () => ({ receiveStripe }));
vi.mock("@/composition", () => ({ getWebhookContainer }));

const { POST } = await import("./route");

const V1 = "a".repeat(64);
const SIGNATURE = `t=1790000000,v1=${V1}`;
const BODY = JSON.stringify({ id: "evt_1", type: "invoice.paid", note: "é  x" });

const call = (signature: string | undefined, body = BODY) =>
  POST(
    new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(signature === undefined ? {} : { "Stripe-Signature": signature }) },
      body,
    }),
  );

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  receiveStripe.mockResolvedValue({ ok: true, outcome: "recorded" });
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorLog.mockRestore();
});

describe("POST /api/webhooks/stripe", () => {
  test.each([
    ["no header", undefined],
    ["no t", `v1=${V1}`],
    ["no v1", "t=1790000000"],
    ["a v1 of 63 hex characters", `t=1790000000,v1=${"a".repeat(63)}`],
    ["only v0", `t=1790000000,v0=${V1}`],
  ])("C2513: %s answers 401 unauthorized and never builds the container", async (_name, header) => {
    const response = await call(header);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(getWebhookContainer).not.toHaveBeenCalled();
    expect(receiveStripe).not.toHaveBeenCalled();
  });

  test("C2514: the use case gets the exact raw body and the exact header", async () => {
    const body = '{"id":"evt_2",  "type":"invoice.paid","name":"é"}';
    await call(`t=1790000000,v1=${V1},v0=${V1}`, body);
    expect(receiveStripe).toHaveBeenCalledTimes(1);
    expect(receiveStripe).toHaveBeenCalledWith({ body, signature: `t=1790000000,v1=${V1},v0=${V1}` });
  });

  test.each<[string, ReceiveStripeEventResult, number, unknown]>([
    ["recorded", { ok: true, outcome: "recorded" }, 200, { outcome: "recorded" }],
    ["duplicate", { ok: true, outcome: "duplicate" }, 200, { outcome: "duplicate" }],
    ["ignored", { ok: true, outcome: "ignored" }, 200, { outcome: "ignored" }],
    ["unauthorized", { ok: false, code: "unauthorized" }, 401, { error: "unauthorized" }],
    ["malformed", { ok: false, code: "malformed" }, 400, { error: "malformed" }],
    ["unavailable", { ok: false, code: "unavailable" }, 503, { error: "unavailable" }],
  ])("C2515: %s answers %i with %j and no-store", async (_name, result, status, json) => {
    receiveStripe.mockResolvedValue(result);
    const response = await call(SIGNATURE);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(json);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("C2515: a thrown error answers 503 and the log carries neither the body nor the header", async () => {
    receiveStripe.mockRejectedValue(new Error(`boom ${BODY} ${SIGNATURE}`));
    const response = await call(SIGNATURE);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(errorLog).toHaveBeenCalledTimes(1);
    const line = String(errorLog.mock.calls[0].join(" "));
    expect(line).not.toContain("evt_1");
    expect(line).not.toContain(V1);
    expect(line).not.toContain("1790000000");
  });
});

describe("a delivery that created a workspace", () => {
  test("C2721: the body is exactly the outcome, with no provisioned key and no email", async () => {
    receiveStripe.mockResolvedValue({ ok: true, outcome: "recorded" });
    const response = await call(SIGNATURE);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe('{"outcome":"recorded"}');
    expect(text).not.toContain("provisioned");
    expect(text).not.toContain("@");
  });

  test.each([
    [{ ok: true, outcome: "recorded" } as ReceiveStripeEventResult, 200],
    [{ ok: false, code: "unauthorized" } as ReceiveStripeEventResult, 401],
    [{ ok: false, code: "malformed" } as ReceiveStripeEventResult, 400],
    [{ ok: false, code: "unavailable" } as ReceiveStripeEventResult, 503],
  ])("C2721: the use case answer %# keeps its status %i", async (answer, status) => {
    receiveStripe.mockResolvedValue(answer);
    expect((await call(SIGNATURE)).status).toBe(status);
  });
});
