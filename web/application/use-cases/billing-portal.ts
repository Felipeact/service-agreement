import type { BillingPortal, OrgBilling } from "@/application/ports";
import { billingSection, canManageBilling, type BillingSectionView } from "@/domain/billing/portal";

export type OpenBillingPortalResult =
  | { ok: true; url: string }
  | { ok: false; code: "forbidden" | "no_subscription" | "not_configured" | "unavailable" };

/** The error's name only: a database message can quote a row. */
const nameOf = (cause: unknown) => (cause instanceof Error ? cause.name : "a non-error");

/**
 * The portal link for the signed-in member's org (billing-portal Flow hops 2 to 4). The role is checked before anything is
 * read, the customer id comes from `org_billing` under the member's own session and never from the caller, and a failed read is
 * `unavailable` so Stripe is not called.
 */
export function makeOpenBillingPortal(billing: OrgBilling, portal: BillingPortal) {
  return async function openBillingPortal(input: { orgId: string; role: string }): Promise<OpenBillingPortalResult> {
    if (!canManageBilling(input.role)) return { ok: false, code: "forbidden" };
    let subscription;
    try {
      subscription = await billing.get(input.orgId);
    } catch (cause) {
      console.error(`Reading billing failed: ${nameOf(cause)}`);
      return { ok: false, code: "unavailable" };
    }
    if (!subscription) return { ok: false, code: "no_subscription" };
    return portal.open({ customerId: subscription.customerId });
  };
}

/** What the Settings page shows; a failed read hides the section instead of failing the page. */
export function makeBillingSection(billing: OrgBilling, configured: boolean) {
  return async function section(orgId: string, role: string): Promise<BillingSectionView> {
    if (!canManageBilling(role)) return { kind: "hidden" };
    try {
      const subscription = await billing.get(orgId);
      return billingSection({ role, plan: subscription?.plan ?? null, configured });
    } catch (cause) {
      console.error(`Reading billing failed: ${nameOf(cause)}`);
      return { kind: "hidden" };
    }
  };
}
