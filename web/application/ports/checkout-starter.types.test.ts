import { describe, expect, test } from "vitest";
import type { CheckoutStarter } from "@/application/ports";

/** Door 3 (pricing-page, widened by register-seats): the port takes `{ plan, trades, seats, email, company, phone }` and answers exactly three shapes. `tsc --noEmit` is the proof. */
const FULL = { seats: 5, email: "owner@shop.ca", company: "Shop Ltd", phone: "604-555-0199" };
const answersOk: CheckoutStarter = { start: async () => ({ ok: true, url: "https://checkout.example.com/c/1" }) };
const answersNotConfigured: CheckoutStarter = { start: async () => ({ ok: false, code: "not_configured" }) };
const answersUnavailable: CheckoutStarter = { start: async () => ({ ok: false, code: "unavailable" }) };

// @ts-expect-error a code the port does not have
const answersRejected: CheckoutStarter = { start: async () => ({ ok: false, code: "rejected" }) };

// @ts-expect-error a vendor object the port does not carry
const answersSession: CheckoutStarter = { start: async () => ({ id: "cs_test_1", url: "https://checkout.example.com/c/1" }) };

/** Never called: it exists so tsc proves the input side. A port widened to `start(selection: unknown)` makes both lines compile, and the unused directives then fail tsc. */
const inputSide = () => {
  // @ts-expect-error a plan the catalog does not have
  void answersOk.start({ plan: "enterprise", trades: ["hvac"], ...FULL });
  // @ts-expect-error a trade the catalog does not have
  void answersOk.start({ plan: "team", trades: ["fire"], ...FULL });
  // @ts-expect-error trades are required
  void answersOk.start({ plan: "team", ...FULL });
  // @ts-expect-error seats are required
  void answersOk.start({ plan: "team", trades: ["hvac"], email: FULL.email, company: FULL.company, phone: FULL.phone });
  // @ts-expect-error email is required
  void answersOk.start({ plan: "team", trades: ["hvac"], seats: FULL.seats, company: FULL.company, phone: FULL.phone });
  // @ts-expect-error company is required
  void answersOk.start({ plan: "team", trades: ["hvac"], seats: FULL.seats, email: FULL.email, phone: FULL.phone });
  // @ts-expect-error phone is required
  void answersOk.start({ plan: "team", trades: ["hvac"], seats: FULL.seats, email: FULL.email, company: FULL.company });
};

describe("the CheckoutStarter port", () => {
  test("C2621: C2426: the three accepted fakes answer the three shapes", async () => {
    const selection = { plan: "team", trades: ["hvac"] } as const;
    expect(await answersOk.start({ plan: selection.plan, trades: ["hvac"], ...FULL })).toEqual({ ok: true, url: "https://checkout.example.com/c/1" });
    expect(await answersNotConfigured.start({ plan: "team", trades: ["hvac"], ...FULL })).toEqual({ ok: false, code: "not_configured" });
    expect(await answersUnavailable.start({ plan: "team", trades: ["hvac"], ...FULL })).toEqual({ ok: false, code: "unavailable" });
    // The two rejected fakes exist only so tsc proves they do not compile; referencing them keeps lint quiet.
    expect([answersRejected, answersSession]).toHaveLength(2);
    expect(typeof inputSide).toBe("function");
  });
});
