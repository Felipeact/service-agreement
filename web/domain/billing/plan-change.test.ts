import { describe, expect, test } from "vitest";
import { PLAN_KEYS, PLANS, type PlanKey } from "./index";
import { formatInvoiceAmount } from "./overview";
import { planChangeSummary } from "./plan-change";

const included = (key: PlanKey) => PLANS.find((plan) => plan.key === key)!.includedSeats;
const money = (cents: number) => formatInvoiceAmount(cents, "cad");

describe("the plan change summary", () => {
  test.each([
    ["starter", "team", 2, 5, 0, "$99.00"],
    ["team", "starter", 5, 2, 0, "$49.00"],
    ["team", "starter", 7, 7, 5, "$124.00"],
    ["starter", "business", 4, 10, 0, "$199.00"],
  ] as const)("C3200: %s to %s with %i seats gives %i seats, %i extra, %s a month", (from, to, seats, newSeats, extra, total) => {
    const summary = planChangeSummary(from, to, seats);
    expect(summary.seats).toBe(newSeats);
    expect(summary.extraSeats).toBe(extra);
    expect(money(summary.totalCents)).toBe(total);
    expect(summary.plan.key).toBe(to);
  });

  const pairs = PLAN_KEYS.flatMap((from) => PLAN_KEYS.filter((to) => to !== from).map((to) => [from, to] as const));

  test.each(pairs)("C3200: %s to %s with exactly the included seats moves to the new included count with no extra seats", (from, to) => {
    const summary = planChangeSummary(from, to, included(from));
    expect(summary.seats).toBe(included(to));
    expect(summary.extraSeats).toBe(0);
    expect(summary.totalCents).toBe(summary.plan.monthlyCents);
  });

  test("C3200: seats above the new included count stay, and seats below it are raised to it", () => {
    expect(planChangeSummary("starter", "business", 12).seats).toBe(12);
    expect(planChangeSummary("starter", "business", 3).seats).toBe(10);
    expect(planChangeSummary("starter", "business", 12).extraSeats).toBe(2);
  });

  test("C3200: the extra seats are charged at 15 dollars each on top of the plan price", () => {
    const summary = planChangeSummary("team", "starter", 7);
    expect(summary.totalCents).toBe(4900 + 5 * 1500);
  });
});
