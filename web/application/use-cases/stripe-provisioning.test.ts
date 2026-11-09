import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { InvitationLinkSender, StripeEventCall, StripeEvents } from "@/application/ports";
import { makeReceiveStripeEvent } from "./stripe-webhook";

const DELIVERY = { body: '{"id":"evt_1","type":"checkout.session.completed"}', signature: `t=1790000000,v1=${"a".repeat(64)}` };
const EMAIL = "owner.one@shop.test";

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorLog.mockRestore();
});

const run = async (answer: StripeEventCall, send: InvitationLinkSender["send"] = async () => ({ ok: true })) => {
  const links = { send: vi.fn(send) };
  const events: StripeEvents = { receive: vi.fn(async () => answer) };
  const result = await makeReceiveStripeEvent(events, links)(DELIVERY);
  return { links, result };
};

const loggedText = () => String(errorLog.mock.calls.flat().join(" "));

describe("sending the owner's sign-in link after a workspace is created", () => {
  test.each([
    ["recorded", { ok: true, outcome: "recorded", provisionedEmail: EMAIL } as StripeEventCall, "recorded"],
    ["a duplicate that provisioned", { ok: true, outcome: "duplicate", provisionedEmail: EMAIL } as StripeEventCall, "duplicate"],
  ])("C2718: %s calls the sender exactly once with the owner's email", async (_name, answer, outcome) => {
    const { links, result } = await run(answer);
    expect(links.send).toHaveBeenCalledTimes(1);
    expect(links.send).toHaveBeenCalledWith(EMAIL);
    expect(result).toEqual({ ok: true, outcome });
  });

  test.each([
    ["a plain duplicate", { ok: true, outcome: "duplicate" } as StripeEventCall],
    ["ignored", { ok: true, outcome: "ignored" } as StripeEventCall],
    ["recorded without provisioned", { ok: true, outcome: "recorded" } as StripeEventCall],
  ])("C2711: %s never calls the sender", async (_name, answer) => {
    const { links } = await run(answer);
    expect(links.send).not.toHaveBeenCalled();
  });

  test.each([
    ["answers not ok (rate limited)", async () => ({ ok: false as const, code: "rate_limited" as const }), "rate_limited"],
    ["answers not ok (unavailable)", async () => ({ ok: false as const, code: "unavailable" as const }), "unavailable"],
    [
      "throws",
      async (): Promise<never> => {
        throw new TypeError(`network down for ${EMAIL}`);
      },
      "TypeError",
    ],
  ])("C2720: a sender that %s still gives recorded, and one log line without the email", async (_name, send, expectedInLog) => {
    const { result } = await run({ ok: true, outcome: "recorded", provisionedEmail: EMAIL }, send);
    expect(result).toEqual({ ok: true, outcome: "recorded" });
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(loggedText()).toContain(expectedInLog);
    expect(loggedText()).not.toContain(EMAIL);
    expect(loggedText()).not.toContain("shop.test");
  });

  test("C2720: with the sender failing, a provisioned duplicate is still a duplicate", async () => {
    const { result } = await run({ ok: true, outcome: "duplicate", provisionedEmail: EMAIL }, async () => ({ ok: false, code: "unavailable" }));
    expect(result).toEqual({ ok: true, outcome: "duplicate" });
  });
});
