import { describe, expect, test } from "vitest";
import { cents } from "@/domain/money";
import { PLAN_KEYS, PLANS, TRADE_CODES, TRADES, formatPlanPrice, knownTrades, parseCheckoutSelection } from "./index";

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
    [4900, "$49"],
    [9900, "$99"],
    [19900, "$199"],
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

describe("parseCheckoutSelection accepts", () => {
  test.each(ORDERED)("C2414: $name", ({ plan, trades, expected }) => {
    expect(parseCheckoutSelection(plan, trades)).toEqual({ ok: true, value: { plan, trades: expected } });
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

describe("parseCheckoutSelection refuses", () => {
  test.each(FORGED)("C2417: $name is invalid_choice", ({ plan, trades }) => {
    expect(parseCheckoutSelection(plan, trades)).toEqual({ ok: false, code: "invalid_choice" });
  });

  test("C2417: a bad plan with no trades is invalid_choice, not no_trade", () => {
    expect(parseCheckoutSelection("enterprise", [])).toEqual({ ok: false, code: "invalid_choice" });
    expect(parseCheckoutSelection(null, [])).toEqual({ ok: false, code: "invalid_choice" });
  });

  test("C2416: a valid plan with no trades is no_trade", () => {
    expect(parseCheckoutSelection("team", [])).toEqual({ ok: false, code: "no_trade" });
  });
});

describe("knownTrades", () => {
  test("C2420: keeps the known trades, once each and in order, and leaves a forged value out", () => {
    expect(knownTrades(["other", "fire", "hvac", "hvac", file()])).toEqual(["hvac", "other"]);
    expect(knownTrades([])).toEqual([]);
  });
});
