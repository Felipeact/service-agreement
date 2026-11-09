import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { StripeEventCall, StripeEvents } from "@/application/ports";
import { makeReceiveStripeEvent } from "./stripe-webhook";

const DELIVERY = { body: '{"id":"evt_1","type":"invoice.paid"}', signature: `t=1790000000,v1=${"a".repeat(64)}` };

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorLog.mockRestore();
});

const run = (answer: StripeEventCall | Error) => {
  const receive = vi.fn<StripeEvents["receive"]>(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return { receive, result: makeReceiveStripeEvent({ receive })(DELIVERY) };
};

describe("receiving a Stripe event", () => {
  test.each([
    ["recorded", { ok: true, outcome: "recorded" } as StripeEventCall, { ok: true, outcome: "recorded" }],
    ["duplicate", { ok: true, outcome: "duplicate" } as StripeEventCall, { ok: true, outcome: "duplicate" }],
    ["ignored", { ok: true, outcome: "ignored" } as StripeEventCall, { ok: true, outcome: "ignored" }],
    ["unauthorized", { ok: false, code: "unauthorized" } as StripeEventCall, { ok: false, code: "unauthorized" }],
    ["malformed", { ok: false, code: "malformed" } as StripeEventCall, { ok: false, code: "malformed" }],
    ["unconfigured secret", { ok: false, code: "unconfigured" } as StripeEventCall, { ok: false, code: "unavailable" }],
    ["an outcome it does not know", { ok: true, outcome: "applied" } as StripeEventCall, { ok: false, code: "unavailable" }],
  ])("C2516: %s", async (_name, answer, expected) => {
    const { receive, result } = run(answer);
    expect(await result).toEqual(expected);
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledWith(DELIVERY);
  });

  test("C2516: any thrown error is unavailable and the log has the error name only", async () => {
    const { result } = run(new Error(`stripe_receive_event failed: XX000 ${DELIVERY.body}`));
    expect(await result).toEqual({ ok: false, code: "unavailable" });
    const line = String(errorLog.mock.calls.flat().join(" "));
    expect(line).not.toContain("evt_1");
    expect(line).not.toContain("XX000");
  });
});
