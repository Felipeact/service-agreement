import { redirect } from "next/navigation";
import { getContainer } from "@/composition";

/**
 * What the Billing page reads, live from Stripe on every request: the plan, card and invoices for an owner or admin, and the
 * usage against the plan only when Stripe was reached ("no subscription" and "not configured" have no plan to count against).
 * Signed out goes to /login; a role that may not manage billing goes back to Settings.
 */
export async function loadBillingPage() {
  const { currentMember, loadBilling, loadBillingUsage, stripePublishableKey } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const caller = { orgId: member.orgId, role: member.billingRole ?? member.role };
  const state = await loadBilling(caller);
  if (state.kind === "forbidden") redirect("/settings");
  const usage = state.kind === "ready" ? await loadBillingUsage(caller) : undefined;
  return { state, usage, publishableKey: stripePublishableKey };
}
