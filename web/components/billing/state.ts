/** What the billing Server Actions answer, as the page's client islands read them (billing-page Surface). */
export type StartResult = { status: "ready"; clientSecret: string } | { status: "forbidden" | "unavailable" };
export type FinishResult = { status: "saved" | "forbidden" | "failed" };
export type SubscriptionResult = { status: "done" | "forbidden" | "unavailable" };

export type BillingActions = {
  startCardUpdate: () => Promise<StartResult>;
  finishCardUpdate: (setupIntentId: string) => Promise<FinishResult>;
  cancel: () => Promise<SubscriptionResult>;
  resume: () => Promise<SubscriptionResult>;
};

/** The notices the page shows (billing-page AC 13, 23, 24). */
export const BILLING_MESSAGES = {
  forbidden: "You don't have permission to change this",
  unavailable: "We couldn't update your subscription. Try again.",
  card: "We couldn't update your card",
} as const;
