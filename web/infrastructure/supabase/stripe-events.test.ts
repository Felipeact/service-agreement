import { describe, expect, test, vi } from "vitest";
import { supabaseStripeEvents } from "./stripe-events";

function client(reply: { data: unknown; error: { code: string; message: string } | null }) {
  const rpc = vi.fn(async () => reply);
  return { rpc, typed: { rpc } as never };
}

const DELIVERY = { body: '{"id":"evt_1","type":"invoice.paid"}', signature: `t=1790000000,v1=${"a".repeat(64)}` };

describe("the Stripe events adapter", () => {
  test("C2516: it calls stripe_receive_event once with the body and the header as they are", async () => {
    const { rpc, typed } = client({ data: { outcome: "recorded" }, error: null });
    await supabaseStripeEvents(typed).receive(DELIVERY);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("stripe_receive_event", { p_body: DELIVERY.body, p_signature: DELIVERY.signature });
  });

  test.each(["recorded", "duplicate", "ignored"])("C2516: the answer %s is passed on", async (outcome) => {
    const { typed } = client({ data: { outcome }, error: null });
    expect(await supabaseStripeEvents(typed).receive(DELIVERY)).toEqual({ ok: true, outcome });
  });

  test.each([
    ["42501", "unauthorized"],
    ["22023", "malformed"],
    ["55000", "unconfigured"],
  ])("C2516: SQLSTATE %s is the value %s", async (code, mapped) => {
    const { typed } = client({ data: null, error: { code, message: DELIVERY.body } });
    expect(await supabaseStripeEvents(typed).receive(DELIVERY)).toEqual({ ok: false, code: mapped });
  });

  test("C2516: any other error is thrown with its code and none of the delivery", async () => {
    const { typed } = client({ data: null, error: { code: "57014", message: DELIVERY.body } });
    const failure = await supabaseStripeEvents(typed).receive(DELIVERY).catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("57014");
    expect((failure as Error).message).not.toContain("evt_1");
  });
});

describe("the Stripe events adapter and the owner's email", () => {
  test("C2718: a provisioned answer hands on the owner's email", async () => {
    const { typed } = client({ data: { outcome: "recorded", provisioned: { email: "owner.one@shop.test" } }, error: null });
    expect(await supabaseStripeEvents(typed).receive(DELIVERY)).toEqual({ ok: true, outcome: "recorded", provisionedEmail: "owner.one@shop.test" });
  });

  test.each([
    ["no provisioned key", { outcome: "recorded" }],
    ["provisioned without an email", { outcome: "recorded", provisioned: {} }],
    ["a non-string email", { outcome: "recorded", provisioned: { email: 7 } }],
    ["an empty email", { outcome: "recorded", provisioned: { email: "" } }],
    ["provisioned that is not an object", { outcome: "recorded", provisioned: "owner@shop.test" }],
  ])("C2718: %s leaves the email out", async (_name, data) => {
    const { typed } = client({ data, error: null });
    expect(await supabaseStripeEvents(typed).receive(DELIVERY)).toEqual({ ok: true, outcome: "recorded" });
  });
});
