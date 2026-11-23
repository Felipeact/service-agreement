import type { Metadata } from "next";
import { BillingView } from "@/components/billing/billing-view";
import { cancelSubscriptionAction, changePlanAction, finishCardUpdateAction, renewSubscriptionAction, resumeSubscriptionAction, startCardUpdateAction } from "./actions";
import { loadBillingPage } from "./_data-access/billing";

export const metadata: Metadata = { title: "Billing" };

const actions = {
  startCardUpdate: startCardUpdateAction,
  finishCardUpdate: finishCardUpdateAction,
  cancel: cancelSubscriptionAction,
  resume: resumeSubscriptionAction,
  changePlan: changePlanAction,
  renew: renewSubscriptionAction,
};

/** The in-app billing page: plan, card and invoices for an owner or admin, read live from Stripe on every request. */
export default async function BillingPage() {
  const { state, usage, publishableKey } = await loadBillingPage();
  return <BillingView state={state} usage={usage} publishableKey={publishableKey} actions={actions} />;
}
