import { PLANS, type PlanKey } from "./index";

/** The roles that may open the billing portal: the ones `org_billing_select` admits (billing-portal Assumptions). */
export function canManageBilling(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** What the Billing section of Settings shows (billing-portal S1, S2). `unavailable`: a subscription exists but Stripe is not set up here. */
export type BillingSectionView = { kind: "hidden" } | { kind: "ready" | "unavailable"; planName: string };

/** Only a manager of an org that has a subscription sees a section; whether the button works depends on the configuration. */
export function billingSection(input: { role: string; plan: PlanKey | null; configured: boolean }): BillingSectionView {
  if (!canManageBilling(input.role) || input.plan === null) return { kind: "hidden" };
  const plan = PLANS.find((candidate) => candidate.key === input.plan);
  if (!plan) return { kind: "hidden" };
  return { kind: input.configured ? "ready" : "unavailable", planName: plan.name };
}
