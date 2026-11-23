"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";
import { audienceOf, planLimitMessage } from "@/domain/billing/plan-limits";
import { validateNewAgreement, validatePickedEquipment, type NewAgreementInput, type PickedEquipment } from "@/domain/agreement/new-agreement";
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
  const { customer, site, templateVersionId } = checked.value;

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

  // Standard agreement pins nothing, so the store is called as it always was.
  const agreement = templateVersionId ? await container.agreementStore.create(siteId, templateVersionId) : await container.agreementStore.create(siteId);
  if (agreement.ok) return { status: "started", agreementId: agreement.id, siteId, customerId };
  if (agreement.code === "plan_limit") return { status: "plan_limit", ...planLimitMessage("agreements", agreement, audienceOf(member.role)) };
  if (agreement.code === "open_exists") return { status: "open_exists", agreementId: agreement.agreementId, number: agreement.number };
  if (agreement.code === "invalid_template") {
    // What this call created is carried back so choosing another template does not create it twice.
    return { status: "invalid_template", ...(customer.kind === "new" && { customerId }), ...(site.kind === "new" && { siteId }) };
  }
  return { status: agreement.code, customerId, siteId };
}

/** What adding picked equipment to the site answered. */
export type AddEquipmentState = { status: "added"; count: number } | { status: "invalid"; message: string } | { status: "forbidden" } | { status: "unavailable"; added: number };

/**
 * Adds the equipment picked by hand in the New agreement dialog to the agreement's site: one asset per unit, of the chosen
 * type, with no unit number yet. The org comes from the member; the site and the types are checked against it. A failure part
 * way answers how many units were already added, so the dialog never invites a retry that would add them twice.
 */
export async function addEquipmentAction(siteId: string, items: PickedEquipment[]): Promise<AddEquipmentState> {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canWriteRecords(member.role)) return { status: "forbidden" };

  // The site comes from the client: it must be a real, active site of the member's org before anything is written under it.
  const site = isUuid(siteId) ? await container.siteRegister(siteId) : null;
  if (!site || !site.active || !site.customerActive) return { status: "invalid", message: "That site is not available." };

  const checked = validatePickedEquipment(items, (await container.listAssetTypes()).map((type) => type.id));
  if (!checked.ok) return { status: "invalid", message: checked.message };

  let added = 0;
  for (const { assetTypeId, quantity } of checked.items) {
    for (let unit = 0; unit < quantity; unit++) {
      const saved = await container.createAsset(member.orgId, siteId, { assetTypeId, unitNo: null, typeModel: null, location: null });
      if (!saved.ok) return { status: "unavailable", added };
      added++;
    }
  }
  return { status: "added", count: added };
}
