"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { audienceOf, planLimitMessage } from "@/domain/billing/plan-limits";
import { validateEquipmentPicks, validateNewAgreement, type EquipmentPick, type NewAgreementInput } from "@/domain/agreement/new-agreement";
import { isUuid } from "@/domain/imports";
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
  if (agreement.ok) return { status: "started", agreementId: agreement.id, siteId };
  if (agreement.code === "plan_limit") return { status: "plan_limit", ...planLimitMessage("agreements", agreement, audienceOf(member.role)) };
  if (agreement.code === "open_exists") return { status: "open_exists", agreementId: agreement.agreementId, number: agreement.number };
  if (agreement.code === "invalid_template") {
    // What this call created is carried back so choosing another template does not create it twice.
    return { status: "invalid_template", ...(customer.kind === "new" && { customerId }), ...(site.kind === "new" && { siteId }) };
  }
  return { status: agreement.code, customerId, siteId };
}

export type AddEquipmentState = { status: "added"; count: number } | { status: "invalid"; error: string } | { status: "forbidden" | "not_found" | "unavailable" };

/**
 * Adds hand-picked equipment to the agreement's site (the New agreement dialog without a file), one unit per count, numbered
 * `<CODE>-1`, `<CODE>-2` and so on so the site register can tell them apart. Only the org's own types are accepted.
 */
export async function addEquipmentAction(siteId: string, picks: EquipmentPick[]): Promise<AddEquipmentState> {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canWriteRecords(member.role)) return { status: "forbidden" };
  if (!isUuid(siteId) || !Array.isArray(picks)) return { status: "not_found" };
  try {
    const types = await container.listEquipmentTypes();
    const checked = validateEquipmentPicks(picks, types.map((type) => type.id));
    if (!checked.ok) return { status: "invalid", error: checked.error };
    const codes = new Map(types.map((type) => [type.id, type.code]));
    const values = checked.value.flatMap((pick) =>
      Array.from({ length: pick.count }, (_, index) => ({ assetTypeId: pick.assetTypeId, unitNo: `${codes.get(pick.assetTypeId)}-${index + 1}`, typeModel: null, location: null })),
    );
    const created = await container.createAssets(member.orgId, siteId, values);
    if (!created.ok) return { status: created.code };
    return { status: "added", count: created.count };
  } catch (cause) {
    console.error(`Adding picked equipment failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return { status: "unavailable" };
  }
}
