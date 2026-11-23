import { ANNUAL_DISCOUNT_PERCENT, PLANS, formatPlanPrice, intervalCents, perMonthCents, type BillingInterval, type PlanKey } from "@/domain/billing";

const planOf = (key: PlanKey) => PLANS.find((plan) => plan.key === key)!;

/** The big figure on a plan card: the monthly price, or a twelfth of the yearly one. */
export const priceOf = (key: PlanKey, interval: BillingInterval) => formatPlanPrice(perMonthCents(planOf(key).monthlyCents, interval));

/** The line under it: the mockup's own copy when monthly; the yearly total and the saving when annual. */
export const billedNote = (key: PlanKey, interval: BillingInterval) =>
  interval === "year"
    ? `Billed ${formatPlanPrice(intervalCents(planOf(key).monthlyCents, "year"))} CAD yearly, save ${ANNUAL_DISCOUNT_PERCENT}%`
    : key === "starter"
      ? `Billed monthly or ${formatPlanPrice(perMonthCents(planOf(key).monthlyCents, "year"))} CAD billed annually`
      : "Billed monthly";

/** Where a plan's button goes: the register form with the plan and, when annual, the interval. */
export const registerHref = (key: PlanKey, interval: BillingInterval) => `/register?plan=${key}${interval === "year" ? "&billing=annual" : ""}`;
