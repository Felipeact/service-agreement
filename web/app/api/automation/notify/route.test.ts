import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AutomationCallbacks, EmailSender, NotificationMessage } from "@/application/ports";
import { makeNotify } from "@/application/use-cases";

const EVENT = "11111111-1111-4111-8111-111111111111";
const AGR = "22222222-2222-4222-8222-222222222222";

const claim = vi.fn<AutomationCallbacks["claim"]>();
const complete = vi.fn<AutomationCallbacks["complete"]>();
const send = vi.fn<EmailSender["send"]>();
const getAutomationContainer = vi.fn(async () => ({
  notify: makeNotify({ claim, complete }, { send }, { unseal: (sealed: string) => sealed }, "https://agreements.northwind.ca"),
}));
vi.mock("@/composition", () => ({ getAutomationContainer }));

const { POST } = await import("./route");

const BODY = JSON.stringify({ idempotencyKey: `w1:${EVENT}:link`, kind: "customer_link", eventId: EVENT, agreementId: AGR, executionId: "exec-1" });

function signed(body = BODY, at = Math.floor(Date.now() / 1000)) {
  const timestamp = String(at);
  return { "X-SA-Timestamp": timestamp, "X-SA-Signature": `sha256=${createHmac("sha256", "test-secret").update(`${timestamp}.${body}`).digest("hex")}` };
}

const call = (headers: Record<string, string>, body = BODY) =>
  POST(new NextRequest("http://localhost:3000/api/automation/notify", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body }));

const message: NotificationMessage = {
  notificationId: "n1",
  kind: "customer_link",
  to: ["pat@customer.ca"],
  replyTo: null,
  tenant: { legalName: "Northwind Mechanical Ltd.", phone: null, accent: null },
  agreement: { id: AGR, number: "AG-1052" },
  site: { name: "Harbourview Towers" },
  annualCents: 387000,
  tokenSealed: "U-FVzrQONnE0OeSkuG3mDhLni8aAqblTz4-KLseYCj4",
  reminder: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  claim.mockResolvedValue({ ok: true, decision: "send", messages: [message] });
  complete.mockResolvedValue();
  send.mockResolvedValue({ ok: true, providerMessageId: "re_1" });
});

describe("POST /api/automation/notify", () => {
  const { "X-SA-Timestamp": ts, "X-SA-Signature": sig } = signed();
  test.each([
    ["no X-SA-Timestamp", { "X-SA-Signature": sig }],
    ["no X-SA-Signature", { "X-SA-Timestamp": ts }],
    ["a timestamp that is not 1 to 12 digits", { "X-SA-Timestamp": "12a", "X-SA-Signature": sig }],
    ["a signature with bad hex", { "X-SA-Timestamp": ts, "X-SA-Signature": "sha256=XYZ" }],
    ["a signature with another prefix", { "X-SA-Timestamp": ts, "X-SA-Signature": `md5=${"a".repeat(64)}` }],
  ])("C1010: %s is 401 without calling claim", async (_label, headers) => {
    const response = await call(headers);
    expect(response.status).toBe(401);
    expect(claim).toHaveBeenCalledTimes(0);
    expect(getAutomationContainer).toHaveBeenCalledTimes(0);
  });

  test("C1011: a claim refused as unauthorized (42501) is 401", async () => {
    claim.mockResolvedValue({ ok: false, code: "unauthorized" });
    expect((await call(signed())).status).toBe(401);
    expect(send).toHaveBeenCalledTimes(0);
  });

  test("C1011: the raw body and both headers reach claim unchanged", async () => {
    const headers = signed();
    await call(headers);
    expect(claim).toHaveBeenCalledWith({ body: BODY, timestamp: headers["X-SA-Timestamp"], signature: headers["X-SA-Signature"] });
  });

  test("C1012: a claim refused as malformed (22023) is 400", async () => {
    claim.mockResolvedValue({ ok: false, code: "malformed" });
    expect((await call(signed("not json"), "not json")).status).toBe(400);
    expect(send).toHaveBeenCalledTimes(0);
  });

  test("C1014: a duplicate is 200 with outcome duplicate and nothing is sent", async () => {
    claim.mockResolvedValue({ ok: true, decision: "duplicate" });
    const response = await call(signed());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "duplicate" });
    expect(send).toHaveBeenCalledTimes(0);
  });

  test("C1015: a claim in flight is 409 and nothing is sent", async () => {
    claim.mockResolvedValue({ ok: true, decision: "in_flight" });
    expect((await call(signed())).status).toBe(409);
    expect(send).toHaveBeenCalledTimes(0);
  });

  test.each(["unavailable", "rejected"] as const)("C1016: a provider %s is 503 after completing failed", async (code) => {
    send.mockResolvedValue({ ok: false, code });
    expect((await call(signed())).status).toBe(503);
    expect(complete.mock.calls[0][1]).toEqual([{ id: "n1", outcome: "failed", error: code }]);
  });

  test("C1017: an unknown event (P0002) is 404", async () => {
    claim.mockResolvedValue({ ok: false, code: "not_found" });
    expect((await call(signed())).status).toBe(404);
  });

  test("C1017: an unexpected claim error is 503 and its cause is logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = new Error("automation_claim failed: XX000 boom");
    claim.mockRejectedValue(cause);
    expect((await call(signed())).status).toBe(503);
    expect(log).toHaveBeenCalledWith(expect.any(String), cause);
    log.mockRestore();
  });

  test("C1043: a successful complete answers 200 with outcome sent", async () => {
    const response = await call(signed());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "sent" });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ body: BODY }), [{ id: "n1", outcome: "sent", providerMessageId: "re_1" }]);
  });

  test("C1038: every answer carries Cache-Control: no-store", async () => {
    const answers = [await call({}), await call(signed())];
    claim.mockResolvedValue({ ok: false, code: "malformed" });
    answers.push(await call(signed()));
    claim.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    answers.push(await call(signed()));
    for (const response of answers) expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
