import { describe, expect, test } from "vitest";
import { cents } from "@/domain/money";
import { PLAN_KEYS, PLANS, TRADE_CODES, TRADES, formatPlanPrice, knownTrades, parseChoice, parseCheckoutSelection, seatsAfterPlanChange, EXTRA_SEAT_CENTS, MAX_SEATS } from "./index";

const file = () => new File(["x"], "x.txt");

describe("the plan and trade identifiers", () => {
  test("C2424: PLAN_KEYS and TRADE_CODES are exactly the identifiers Stripe metadata and org rows will carry", () => {
    expect([...PLAN_KEYS]).toEqual(["starter", "team", "business"]);
    expect([...TRADE_CODES]).toEqual(["hvac", "plumbing", "electrical", "other"]);
  });

  test("C2424: PLANS has one entry per key in that order, each with a display name that is not its key", () => {
    expect(PLANS.map((plan) => plan.key)).toEqual(["starter", "team", "business"]);
    for (const plan of PLANS) expect(plan.name).not.toBe(plan.key);
  });

  test("C2424: TRADES has one entry per code in that order, each with a label that is not its code", () => {
    expect(TRADES.map((trade) => trade.code)).toEqual(["hvac", "plumbing", "electrical", "other"]);
    for (const trade of TRADES) expect(trade.label).not.toBe(trade.code);
  });
});

describe("the price shown", () => {
  test.each([
    [7900, "$79"],
    [14900, "$149"],
    [29900, "$299"],
    [12300, "$123"],
  ])("C2404: %i cents is %s a month, in whole dollars", (amount, shown) => {
    expect(formatPlanPrice(cents(amount))).toBe(shown);
  });
});

const ORDERED = [
  { name: "all four, shuffled", plan: "team", trades: ["other", "electrical", "plumbing", "hvac"], expected: ["hvac", "plumbing", "electrical", "other"] },
  { name: "one trade stays one", plan: "starter", trades: ["plumbing"], expected: ["plumbing"] },
  { name: "repeats collapse, in order", plan: "business", trades: ["other", "hvac", "hvac", "plumbing"], expected: ["hvac", "plumbing", "other"] },
  { name: "five values with repeats", plan: "team", trades: ["other", "other", "other", "hvac", "hvac"], expected: ["hvac", "other"] },
  { name: "all four, already ordered", plan: "starter", trades: ["hvac", "plumbing", "electrical", "other"], expected: ["hvac", "plumbing", "electrical", "other"] },
] as const;

describe("parseChoice accepts", () => {
  test.each(ORDERED)("C2414: $name", ({ plan, trades, expected }) => {
    expect(parseChoice(plan, trades)).toEqual({ ok: true, value: { plan, trades: expected } });
  });
});

const FORGED: { name: string; plan: unknown; trades: unknown[] }[] = [
  { name: "plan missing", plan: null, trades: ["hvac"] },
  { name: "plan enterprise", plan: "enterprise", trades: ["hvac"] },
  { name: "plan Team in the wrong case", plan: "Team", trades: ["hvac"] },
  { name: "plan sent as a File", plan: file(), trades: ["hvac"] },
  { name: "trade fire", plan: "team", trades: ["fire"] },
  { name: "trade empty", plan: "team", trades: [""] },
  { name: "trade HVAC in the wrong case", plan: "team", trades: ["HVAC"] },
  { name: "a valid trade beside an unknown one", plan: "team", trades: ["hvac", "fire"] },
  { name: "trade sent as a File", plan: "team", trades: [file()] },
];

describe("parseChoice refuses", () => {
  test.each(FORGED)("C2417: $name is invalid_choice", ({ plan, trades }) => {
    expect(parseChoice(plan, trades)).toEqual({ ok: false, code: "invalid_choice" });
  });

  test("C2417: a bad plan with no trades is invalid_choice, not no_trade", () => {
    expect(parseChoice("enterprise", [])).toEqual({ ok: false, code: "invalid_choice" });
    expect(parseChoice(null, [])).toEqual({ ok: false, code: "invalid_choice" });
  });

  test("C2416: a valid plan with no trades is no_trade", () => {
    expect(parseChoice("team", [])).toEqual({ ok: false, code: "no_trade" });
  });
});

describe("knownTrades", () => {
  test("C2420: keeps the known trades, once each and in order, and leaves a forged value out", () => {
    expect(knownTrades(["other", "fire", "hvac", "hvac", file()])).toEqual(["hvac", "other"]);
    expect(knownTrades([])).toEqual([]);
  });
});

const OK = { plan: "team", trades: ["hvac"], seats: "5", email: "owner@shop.ca", company: "Shop Ltd", phone: "604-555-0199" };
const fieldsOf = (input: Record<string, unknown>) => {
  const result = parseCheckoutSelection({ ...OK, ...input });
  return result.ok ? null : result.fields;
};
const accepts = (input: Record<string, unknown>) => parseCheckoutSelection({ ...OK, ...input }).ok;

describe("parseCheckoutSelection on the email", () => {
  test.each(["", "x".repeat(243) + "@example.com", "a", "a@b", "a b@c.d", "a@b c.d"])("C2601: %j is refused with the field error email", (email) => {
    expect(fieldsOf({ email })).toEqual({ email: true });
  });

  test("C2601: an address of exactly 254 characters is accepted", () => {
    const email = "a".repeat(254 - "@example.com".length) + "@example.com";
    expect(email).toHaveLength(254);
    expect(accepts({ email })).toBe(true);
  });
});

describe("parseCheckoutSelection on the company", () => {
  test.each([["empty", ""], ["spaces only", "   "], ["121 characters", "c".repeat(121)]])("C2602: %s is refused with the field error company", (_name, company) => {
    expect(fieldsOf({ company })).toEqual({ company: true });
  });

  test("C2602: 120 characters are accepted", () => {
    expect(accepts({ company: "c".repeat(120) })).toBe(true);
  });
});

describe("parseCheckoutSelection on the phone", () => {
  test.each([
    ["6 characters", "604555"],
    ["21 characters", "6045550199604555019" + "99"],
    ["letters", "555-CALL-NOW"],
    ["extension text", "604 555 0199 ext 4"],
  ])("C2603: %s is refused with the field error phone", (_name, phone) => {
    expect(fieldsOf({ phone })).toEqual({ phone: true });
  });

  test.each([
    ["a dashed number", "604-555-0199"],
    ["brackets and dots", "+1 (604) 555.0199"],
    ["7 characters", "5550199"],
    ["20 characters", "+1 604 555 0199 1234".slice(0, 20)],
  ])("C2603: %s is accepted", (_name, phone) => {
    expect(accepts({ phone })).toBe(true);
  });
});

describe("the seats", () => {
  test("C2608: Starter, Team and Business include 2, 5 and 10 seats, an extra seat is 1900 cents and the ceiling is 50", () => {
    expect(PLANS.map((plan) => [plan.key, plan.includedSeats])).toEqual([["starter", 2], ["team", 5], ["business", 10]]);
    expect(EXTRA_SEAT_CENTS).toBe(1900);
    expect(MAX_SEATS).toBe(50);
  });

  const PER_PLAN = [
    { plan: "starter", included: 2, middle: "20" },
    { plan: "team", included: 5, middle: "20" },
    { plan: "business", included: 10, middle: "20" },
  ] as const;

  test.each(PER_PLAN)("C2609: $plan refuses counts below $included, 0, empty, abc, 2.5 and 51, and accepts $included, 50 and 20", ({ plan, included, middle }) => {
    const refused = [String(included - 1), "0", "", "abc", "2.5", "51"];
    for (const seats of refused) expect(fieldsOf({ plan, seats }), `seats ${JSON.stringify(seats)}`).toEqual({ seats: true });
    for (const seats of [String(included), "50", middle]) expect(accepts({ plan, seats }), `seats ${seats}`).toBe(true);
  });

  test("C2609: a valid form is returned normalised, with the seats as a number", () => {
    expect(parseCheckoutSelection({ ...OK, seats: "8", email: "  Owner@Shop.CA " })).toEqual({
      ok: true,
      value: { plan: "team", trades: ["hvac"], seats: 8, email: "owner@shop.ca", company: "Shop Ltd", phone: "604-555-0199" },
    });
  });

  test.each([
    ["starter", "team", 2, 5],
    ["team", "business", 5, 10],
    ["business", "starter", 10, 2],
    ["starter", "team", 8, 8],
    ["business", "starter", 20, 20],
    ["starter", "business", 3, 10],
  ] as const)("C2612: %s to %s with %i seats gives %i", (from, to, seats, expected) => {
    expect(seatsAfterPlanChange(from, to, seats)).toBe(expected);
  });
});

describe("seat text the form can post", () => {
  test("a leading zero or surrounding spaces are read as the number they spell", () => {
    expect(parseCheckoutSelection({ ...OK, seats: "08" })).toMatchObject({ ok: true, value: { seats: 8 } });
    expect(parseCheckoutSelection({ ...OK, seats: " 5 " })).toMatchObject({ ok: true, value: { seats: 5 } });
  });
});
