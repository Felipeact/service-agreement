import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AutomationCallbacks, ClaimResult, EmailSender, NotificationMessage } from "@/application/ports";
import { makeNotify } from "./notify";

const BASE = "https://agreements.northwind.ca";
const TOKEN = "U-FVzrQONnE0OeSkuG3mDhLni8aAqblTz4-KLseYCj4";
const EVENT = "11111111-1111-4111-8111-111111111111";
const KEY = `w1:${EVENT}:link`;
const CALLBACK = { body: JSON.stringify({ idempotencyKey: KEY, kind: "customer_link", eventId: EVENT, agreementId: "a1" }), timestamp: "1", signature: "sha256=x" };
const tenant = { legalName: "Northwind Mechanical Ltd.", phone: "604-555-0100", accent: null };

const link = (over: Partial<Extract<NotificationMessage, { tokenSealed: string }>> = {}): NotificationMessage => ({
  notificationId: "n1",
  kind: "customer_link",
  to: ["pat@customer.ca"],
  replyTo: "estimator@northwind.ca",
  tenant,
  agreement: { id: "a1", number: "AG-1052" },
  site: { name: "Harbourview Towers" },
  annualCents: 387000,
  tokenSealed: "sealed:" + TOKEN,
  reminder: null,
  ...over,
});

const claim = vi.fn<AutomationCallbacks["claim"]>();
const complete = vi.fn<AutomationCallbacks["complete"]>();
const send = vi.fn<EmailSender["send"]>();
const tokens = { unseal: (sealed: string) => sealed.replace(/^sealed:/, "") };
const notify = makeNotify({ claim, complete }, { send }, tokens, BASE);

const claimed = (result: ClaimResult) => claim.mockResolvedValue(result);

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({ ok: true, providerMessageId: "re_1" });
  complete.mockResolvedValue();
});

describe("notify", () => {
  test("C1044: send - one claim message is sent once with its key, completed once with sent, and answered sent", async () => {
    claimed({ ok: true, decision: "send", messages: [link()] });
    expect(await notify(CALLBACK)).toEqual({ ok: true, outcome: "sent" });
    expect(claim).toHaveBeenCalledWith(CALLBACK);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: ["pat@customer.ca"],
      fromName: "Northwind Mechanical Ltd.",
      subject: "Service agreement AG-1052 from Northwind Mechanical Ltd.",
      idempotencyKey: KEY,
    });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(CALLBACK, [{ id: "n1", outcome: "sent", providerMessageId: "re_1" }]);
  });

  test("C1044: skip - nothing is sent or completed, and the reason is answered", async () => {
    claimed({ ok: true, decision: "skip", reason: "viewed" });
    expect(await notify(CALLBACK)).toEqual({ ok: true, outcome: "skipped", reason: "viewed" });
    expect(send).toHaveBeenCalledTimes(0);
    expect(complete).toHaveBeenCalledTimes(0);
  });

  test("C1044: send with 2 messages (W5) - 2 sends, each with its org's key, and 1 complete carrying 2 results", async () => {
    const stale = (id: string, orgId: string): NotificationMessage => ({
      notificationId: id,
      kind: "staff_stale",
      orgId,
      to: [`owner@${orgId}.ca`, `admin@${orgId}.ca`],
      tenant,
      agreements: [{ id: "a1", number: "AG-1039", customerName: "Harbourview Strata", sentAt: new Date("2026-10-21T17:00:00Z") }],
    });
    const body = { ...CALLBACK, body: JSON.stringify({ idempotencyKey: "w5:2026-10-29", kind: "staff_stale" }) };
    claimed({ ok: true, decision: "send", messages: [stale("n1", "orga"), stale("n2", "orgb")] });
    send.mockResolvedValueOnce({ ok: true, providerMessageId: "re_1" }).mockResolvedValueOnce({ ok: true, providerMessageId: "re_2" });
    expect(await notify(body)).toEqual({ ok: true, outcome: "sent" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map(([email]) => [email.idempotencyKey, email.to])).toEqual([
      ["w5:2026-10-29:orga", ["owner@orga.ca", "admin@orga.ca"]],
      ["w5:2026-10-29:orgb", ["owner@orgb.ca", "admin@orgb.ca"]],
    ]);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0][1]).toEqual([
      { id: "n1", outcome: "sent", providerMessageId: "re_1" },
      { id: "n2", outcome: "sent", providerMessageId: "re_2" },
    ]);
  });

  test.each(["unavailable", "rejected"] as const)("C1016: a provider %s completes failed with the error and answers unavailable", async (code) => {
    claimed({ ok: true, decision: "send", messages: [link()] });
    send.mockResolvedValue({ ok: false, code });
    expect(await notify(CALLBACK)).toEqual({ ok: false, code: "unavailable" });
    expect(complete).toHaveBeenCalledWith(CALLBACK, [{ id: "n1", outcome: "failed", error: code }]);
  });

  test("C1016: a failed key claimed again is sent on the retry", async () => {
    claimed({ ok: true, decision: "send", messages: [link()] });
    send.mockResolvedValueOnce({ ok: false, code: "unavailable" });
    expect(await notify(CALLBACK)).toEqual({ ok: false, code: "unavailable" });
    expect(await notify(CALLBACK)).toEqual({ ok: true, outcome: "sent" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1][1]).toEqual([{ id: "n1", outcome: "sent", providerMessageId: "re_1" }]);
  });

  test("C1019: the built email links to <APP_BASE_URL>/review/<unsealed token> and carries the claim's facts", async () => {
    claimed({ ok: true, decision: "send", messages: [link()] });
    await notify(CALLBACK);
    const email = send.mock.calls[0][0];
    expect(email.html).toContain(`href="${BASE}/review/${TOKEN}"`);
    expect(email.text).toContain(`${BASE}/review/${TOKEN}`);
    expect(email.html).toContain("Harbourview Towers");
    expect(email.html).toContain("$3,870.00 per year before tax");
    expect(email.html).toContain("604-555-0100");
  });

  test.each(["a@example.com", "a@example.org", "a@example.net", "a@shop.test", "a@x.invalid"])(
    "C1024: %s is skipped as reserved_domain, completed so, and never handed to the sender",
    async (address) => {
      claimed({ ok: true, decision: "send", messages: [link({ to: [address] })] });
      expect(await notify(CALLBACK)).toEqual({ ok: true, outcome: "skipped", reason: "reserved_domain" });
      expect(send).toHaveBeenCalledTimes(0);
      expect(complete).toHaveBeenCalledWith(CALLBACK, [{ id: "n1", outcome: "skipped", reason: "reserved_domain" }]);
    },
  );

  test.each(["a@felipeviana.com", "a@notexample.com", "a@example.community"])("C1024: %s is sent", async (address) => {
    claimed({ ok: true, decision: "send", messages: [link({ to: [address] })] });
    expect(await notify(CALLBACK)).toEqual({ ok: true, outcome: "sent" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("C1025: the sender's email is the Reply-To, and with none there is no Reply-To", async () => {
    claimed({ ok: true, decision: "send", messages: [link()] });
    await notify(CALLBACK);
    expect(send.mock.calls[0][0].replyTo).toBe("estimator@northwind.ca");
    claimed({ ok: true, decision: "send", messages: [link({ replyTo: null })] });
    await notify(CALLBACK);
    expect(send.mock.calls[1][0]).not.toHaveProperty("replyTo");
  });

  test("a token that cannot be unsealed is completed failed and answered unavailable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = makeNotify({ claim, complete }, { send }, { unseal: () => { throw new Error("bad key"); } }, BASE);
    claimed({ ok: true, decision: "send", messages: [link()] });
    expect(await broken(CALLBACK)).toEqual({ ok: false, code: "unavailable" });
    expect(send).toHaveBeenCalledTimes(0);
    expect(complete).toHaveBeenCalledWith(CALLBACK, [{ id: "n1", outcome: "failed", error: "could not build the email" }]);
    log.mockRestore();
  });

  test("duplicate, in flight and refusals are answered without sending or completing", async () => {
    claimed({ ok: true, decision: "duplicate" });
    expect(await notify(CALLBACK)).toEqual({ ok: true, outcome: "duplicate" });
    claimed({ ok: true, decision: "in_flight" });
    expect(await notify(CALLBACK)).toEqual({ ok: false, code: "in_flight" });
    claimed({ ok: false, code: "unauthorized" });
    expect(await notify(CALLBACK)).toEqual({ ok: false, code: "unauthorized" });
    expect(send).toHaveBeenCalledTimes(0);
    expect(complete).toHaveBeenCalledTimes(0);
  });
});
