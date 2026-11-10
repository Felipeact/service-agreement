import { PLANS, monthlyTotalCents, seatsAfterPlanChange, type Plan, type PlanKey } from "./index";
import type { Cents } from "@/domain/money";

/** What a switch from one plan to another would mean for the seat count and the monthly total (plan-change AC 6). */
export type PlanChangeSummary = { plan: Plan; seats: number; extraSeats: number; monthlyCents: Cents; totalCents: Cents };

/** The seat count follows the sign-up rule (`seatsAfterPlanChange`); seats beyond the new plan's included ones are extra. */
export function planChangeSummary(from: PlanKey, to: PlanKey, seats: number): PlanChangeSummary {
  const plan = PLANS.find((candidate) => candidate.key === to)!;
  const newSeats = seatsAfterPlanChange(from, to, seats);
  return {
    plan,
    seats: newSeats,
    extraSeats: Math.max(0, newSeats - plan.includedSeats),
    monthlyCents: plan.monthlyCents,
    totalCents: monthlyTotalCents(plan, newSeats),
  };
}
