"use server";

import { redirect } from "next/navigation";
import type { BillingFormState } from "@/components/settings/billing-section";
import { getContainer } from "@/composition";

/**
 * Opens Stripe's billing portal for the signed-in member's own org (billing-portal Flow hops 2 to 5). It takes nothing from the
 * browser: the org and role come from the session and the customer id from `org_billing`. A success redirects to Stripe;
 * every refusal is a notice on Settings.
 */
// `useActionState` passes the previous state first; nothing here reads it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function openBillingPortalAction(_state: BillingFormState): Promise<BillingFormState> {
  const { currentMember, openBillingPortal } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");

  const opened = await openBillingPortal({ orgId: member.orgId, role: member.role });
  if (opened.ok) redirect(opened.url);
  return { status: opened.code === "forbidden" ? "forbidden" : "unavailable" };
}
