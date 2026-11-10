import type { BillingGateway, GatewayFailure, OrgBilling, OrgBillingValue, StripeIds } from "@/application/ports";
import { PLANS } from "@/domain/billing";
import { canManageBilling, type BillingOverview } from "@/domain/billing/overview";

type Member = { orgId: string; role: string };

/** What the billing page shows (billing-page S1). `forbidden` is not shown: the page sends that member back to Settings. */
export type BillingLoad =
  | { kind: "forbidden" }
  | { kind: "no_subscription" }
  | { kind: "not_configured" }
  | { kind: "error" }
  | { kind: "ready"; plan: string; overview: BillingOverview };

export type BillingFailure = "forbidden" | "no_subscription" | GatewayFailure;

/** The error's name only: a database message can quote a row. */
const nameOf = (cause: unknown) => (cause instanceof Error ? cause.name : "a non-error");

/**
 * Everything the in-app billing page does (billing-page Flow hops 1 to 5). The role is checked before anything is read, the
 * Stripe ids come from `org_billing` under the member's own session and never from the caller, and a failed read stops the
 * action before Stripe is called.
 */
export function makeBilling(billing: OrgBilling, gateway: BillingGateway) {
  /** The member's stored ids, or why there are none. Never throws. */
  async function idsOf(member: Member): Promise<{ ok: true; value: OrgBillingValue } | { ok: false; code: "forbidden" | "no_subscription" | "unavailable" }> {
    if (!canManageBilling(member.role)) return { ok: false, code: "forbidden" };
    try {
      const value = await billing.get(member.orgId);
      return value ? { ok: true, value } : { ok: false, code: "no_subscription" };
    } catch (cause) {
      console.error(`Reading billing failed: ${nameOf(cause)}`);
      return { ok: false, code: "unavailable" };
    }
  }

  const stripeIds = (value: OrgBillingValue): StripeIds => ({ customerId: value.customerId, subscriptionId: value.subscriptionId });

  async function act<T extends { ok: boolean }>(member: Member, run: (ids: StripeIds) => Promise<T>): Promise<T | { ok: false; code: "forbidden" | "no_subscription" | "unavailable" }> {
    const found = await idsOf(member);
    if (!found.ok) return found;
    return run(stripeIds(found.value));
  }

  return {
    async load(member: Member): Promise<BillingLoad> {
      const found = await idsOf(member);
      if (!found.ok) return found.code === "unavailable" ? { kind: "error" } : { kind: found.code };
      const answer = await gateway.overview(stripeIds(found.value));
      if (!answer.ok) return answer.code === "not_configured" ? { kind: "not_configured" } : { kind: "error" };
      const plan = PLANS.find((candidate) => candidate.key === found.value.plan)?.name ?? found.value.plan;
      return { kind: "ready", plan, overview: answer.overview };
    },

    startCardUpdate: (member: Member) => act(member, (ids) => gateway.startCardUpdate(ids)),
    finishCardUpdate: (member: Member, setupIntentId: string) => act(member, (ids) => gateway.finishCardUpdate(ids, setupIntentId)),
    cancel: (member: Member) => act(member, (ids) => gateway.cancel(ids)),
    resume: (member: Member) => act(member, (ids) => gateway.resume(ids)),
  };
}

/** Whether the Settings menu lists Billing: a manager of an org that has a subscription. A failed read hides it. */
export function makeBillingEntry(billing: OrgBilling) {
  return async function billingLink(orgId: string, role: string): Promise<boolean> {
    if (!canManageBilling(role)) return false;
    try {
      return (await billing.get(orgId)) !== null;
    } catch (cause) {
      console.error(`Reading billing failed: ${nameOf(cause)}`);
      return false;
    }
  };
}
