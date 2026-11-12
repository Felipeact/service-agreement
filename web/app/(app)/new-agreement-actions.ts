"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { audienceOf, planLimitMessage } from "@/domain/billing/plan-limits";
import { validateNewAgreement, type NewAgreementInput } from "@/domain/agreement/new-agreement";
import type { StartAgreementState } from "@/components/agreements/new-agreement-state";
import { canWriteRecords } from "@/components/records/state";

/**
 * Starts an agreement from the New agreement dialog: uses or creates the customer, uses or creates its site, then
 * creates the draft. It does not redirect: the dialog may still send the equipment list to the site before opening it.
 * Only the dialog's fields are read; the org comes from the member, never from the request.
 */
export async function startAgreementAction(input: NewAgreementInput): Promise<StartAgreementState> {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canWriteRecords(member.role)) return { status: "forbidden" };

  const checked = validateNewAgreement(input);
  if (!checked.ok) return { status: "invalid", errors: checked.errors };
  const { customer, site } = checked.value;

  let customerId: string;
  if (customer.kind === "new") {
    const created = await container.createCustomer(member.orgId, customer.value);
    if (!created.ok) return { status: created.code };
    customerId = created.id;
  } else {
    customerId = customer.id;
  }

  let siteId: string;
  if (site.kind === "new") {
    if (!(await container.customerDetail(customerId))) return { status: "not_found" };
    const created = await container.createSite(member.orgId, customerId, site.value);
    if (!created.ok) return { status: created.code, customerId };
    siteId = created.id;
  } else {
    // An existing site must belong to the customer the member chose, so a stale or edited request cannot cross customers.
    const existing = await container.siteRegister(site.id);
    if (!existing || existing.customerId !== customerId) return { status: "not_found" };
    siteId = site.id;
  }

  const agreement = await container.agreementStore.create(siteId);
  if (agreement.ok) return { status: "started", agreementId: agreement.id, siteId };
  if (agreement.code === "plan_limit") return { status: "plan_limit", ...planLimitMessage("agreements", agreement, audienceOf(member.role)) };
  if (agreement.code === "open_exists") return { status: "open_exists", agreementId: agreement.agreementId, number: agreement.number };
  return { status: agreement.code, customerId, siteId };
}
