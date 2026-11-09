import { describe, expect, test } from "vitest";
import type { CheckoutStarter } from "@/application/ports";

/** Door 3 (pricing-page): the port takes `{ plan, trades }` and answers exactly three shapes. `tsc --noEmit` is the proof. */
const answersOk: CheckoutStarter = { start: async () => ({ ok: true, url: "https://checkout.example.com/c/1" }) };
const answersNotConfigured: CheckoutStarter = { start: async () => ({ ok: false, code: "not_configured" }) };
const answersUnavailable: CheckoutStarter = { start: async () => ({ ok: false, code: "unavailable" }) };

// @ts-expect-error a code the port does not have
const answersRejected: CheckoutStarter = { start: async () => ({ ok: false, code: "rejected" }) };

// @ts-expect-error a vendor object the port does not carry
const answersSession: CheckoutStarter = { start: async () => ({ id: "cs_test_1", url: "https://checkout.example.com/c/1" }) };

describe("the CheckoutStarter port", () => {
  test("C2426: the three accepted fakes answer the three shapes", async () => {
    const selection = { plan: "team", trades: ["hvac"] } as const;
    expect(await answersOk.start({ plan: selection.plan, trades: ["hvac"] })).toEqual({ ok: true, url: "https://checkout.example.com/c/1" });
    expect(await answersNotConfigured.start({ plan: "team", trades: ["hvac"] })).toEqual({ ok: false, code: "not_configured" });
    expect(await answersUnavailable.start({ plan: "team", trades: ["hvac"] })).toEqual({ ok: false, code: "unavailable" });
    // The two rejected fakes exist only so tsc proves they do not compile; referencing them keeps lint quiet.
    expect([answersRejected, answersSession]).toHaveLength(2);
  });
});
