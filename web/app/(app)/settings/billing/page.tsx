import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BillingView } from "@/components/billing/billing-view";
import { getContainer } from "@/composition";
import { cancelSubscriptionAction, changePlanAction, finishCardUpdateAction, resumeSubscriptionAction, startCardUpdateAction } from "./actions";

export const metadata: Metadata = { title: "Billing" };

const actions = {
  startCardUpdate: startCardUpdateAction,
  finishCardUpdate: finishCardUpdateAction,
  cancel: cancelSubscriptionAction,
  resume: resumeSubscriptionAction,
  changePlan: changePlanAction,
};

/** The in-app billing page: plan, card and invoices for an owner or admin, read live from Stripe on every request. */
export default async function BillingPage() {
  const { currentMember, loadBilling, stripePublishableKey } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");

  const state = await loadBilling({ orgId: member.orgId, role: member.role });
  if (state.kind === "forbidden") redirect("/settings");
  return <BillingView state={state} publishableKey={stripePublishableKey} actions={actions} />;
}
