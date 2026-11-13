import type { PlanKey } from "@/domain/billing";

/** What the billing Server Actions answer, as the page's client islands read them (billing-page Surface). */
export type StartResult = { status: "ready"; clientSecret: string } | { status: "forbidden" | "unavailable" };
export type FinishResult = { status: "saved" | "forbidden" | "failed" };
export type SubscriptionResult = { status: "done" | "forbidden" | "unavailable" };

/** What the change-plan action answers (plan-change Surface). */
export type PlanChangeResult = { status: "done" | "forbidden" | "same_plan" | "failed" };

export type BillingActions = {
  startCardUpdate: () => Promise<StartResult>;
  finishCardUpdate: (setupIntentId: string) => Promise<FinishResult>;
  cancel: () => Promise<SubscriptionResult>;
  resume: () => Promise<SubscriptionResult>;
  changePlan: (plan: PlanKey) => Promise<PlanChangeResult>;
  /** Starts a new subscription for an ended plan; it redirects to Checkout, so it answers nothing. */
  renew?: () => Promise<void>;
};

/** The notices the page shows (billing-page AC 13, 23, 24). */
export const BILLING_MESSAGES = {
  forbidden: "You don't have permission to change this",
  unavailable: "We couldn't update your subscription. Try again.",
  card: "We couldn't update your card",
  plan: "We couldn't change your plan. Try again.",
  samePlan: "You're already on this plan",
} as const;
