"use server";

import { redirect } from "next/navigation";
import type { SetActiveResult, WriteFailure } from "@/application/ports";
import { getContainer } from "@/composition";
import {
  validateAsset,
  validateContact,
  validateCustomer,
  validateSite,
  type AssetInput,
  type ContactInput,
  type CustomerInput,
  type SiteInput,
} from "@/domain/records";
import { canWriteRecords, type ActiveState, type DeleteState, type RecordFormState } from "@/components/records/state";
import { isId, readFields, readPostedFields } from "@/lib/forms/server-input";

const FORBIDDEN = { status: "forbidden" } as const;

/** The container and the member's org, or `null` when the member may not write records. Signed out goes to /login. */
async function writer() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return canWriteRecords(member.role) ? { container, orgId: member.orgId } : null;
}

// Only these fields are read (Zod, `readFields`): ids and org come from the route and the member, never from the form (AC 35).
// A role is read only when the form offered it, so a form without the select leaves the stored role alone.
const readCustomer = (formData: FormData): CustomerInput => ({ ...readFields(formData, ["name"]), ...readPostedFields(formData, ["billingContactId"]) });
const readContact = (formData: FormData): ContactInput => readFields(formData, ["name", "email", "phone"]);
const readSite = (formData: FormData): SiteInput => ({ ...readFields(formData, ["name", "address", "siteContactId"]), ...readPostedFields(formData, ["approverContactId"]) });
const readAsset = (formData: FormData): AssetInput => readFields(formData, ["assetTypeId", "unitNo", "typeModel", "location"]);

function refused<Input>(code: WriteFailure, values: Input): RecordFormState<Input> {
  return code === "forbidden" ? FORBIDDEN : { status: code, values };
}

export async function createCustomerAction(_state: RecordFormState<CustomerInput>, formData: FormData): Promise<RecordFormState<CustomerInput>> {
  const values = readCustomer(formData);
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  const checked = validateCustomer(values);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };
  const saved = await ctx.container.createCustomer(ctx.orgId, checked.value);
  if (!saved.ok) return refused(saved.code, values);
  redirect(`/customers/${saved.id}`);
}

export async function updateCustomerAction(
  customerId: string,
  _state: RecordFormState<CustomerInput>,
  formData: FormData,
): Promise<RecordFormState<CustomerInput>> {
  const values = readCustomer(formData);
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(customerId)) return { status: "not_found", values };
  const customer = values.billingContactId === undefined ? null : await ctx.container.customerDetail(customerId);
  if (values.billingContactId !== undefined && !customer) return { status: "not_found", values };
  const checked = validateCustomer(values, customer?.contacts.map((contact) => contact.id));
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };
  const saved = await ctx.container.updateCustomer(customerId, checked.value);
  if (!saved.ok) return refused(saved.code, values);
  redirect(`/customers/${customerId}`);
}

export async function createContactAction(
  customerId: string,
  _state: RecordFormState<ContactInput>,
  formData: FormData,
): Promise<RecordFormState<ContactInput>> {
  const values = readContact(formData);
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(customerId)) return { status: "not_found", values };
  const checked = validateContact(values);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };
  const saved = await ctx.container.createContact(ctx.orgId, customerId, checked.value);
  if (!saved.ok) return refused(saved.code, values);
  redirect(`/customers/${customerId}`);
}

export async function updateContactAction(
  contactId: string,
  _state: RecordFormState<ContactInput>,
  formData: FormData,
): Promise<RecordFormState<ContactInput>> {
  const values = readContact(formData);
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(contactId)) return { status: "not_found", values };
  const checked = validateContact(values);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };
  const contact = await ctx.container.contactForEdit(contactId);
  if (!contact) return { status: "not_found", values };
  const saved = await ctx.container.updateContact(contactId, checked.value);
  if (!saved.ok) return refused(saved.code, values);
  redirect(`/customers/${contact.customerId}`);
}

export async function deleteContactAction(contactId: string): Promise<DeleteState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(contactId)) return { status: "not_found" };
  const contact = await ctx.container.contactForEdit(contactId);
  if (!contact) return { status: "not_found" };
  const deleted = await ctx.container.deleteContact(contactId);
  if (!deleted.ok) return { status: deleted.code };
  redirect(`/customers/${contact.customerId}`);
}

export async function createSiteAction(customerId: string, _state: RecordFormState<SiteInput>, formData: FormData): Promise<RecordFormState<SiteInput>> {
  const values = readSite(formData);
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(customerId)) return { status: "not_found", values };
  const customer = await ctx.container.customerDetail(customerId);
  if (!customer) return { status: "not_found", values };
  const checked = validateSite(values, customer.contacts.map((contact) => contact.id));
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };
  const saved = await ctx.container.createSite(ctx.orgId, customerId, checked.value);
  if (!saved.ok) return refused(saved.code, values);
  redirect(`/sites/${saved.id}`);
}

export async function updateSiteAction(siteId: string, _state: RecordFormState<SiteInput>, formData: FormData): Promise<RecordFormState<SiteInput>> {
  const values = readSite(formData);
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(siteId)) return { status: "not_found", values };
  const site = await ctx.container.siteRegister(siteId);
  const customer = site && (await ctx.container.customerDetail(site.customerId));
  if (!customer) return { status: "not_found", values };
  const checked = validateSite(values, customer.contacts.map((contact) => contact.id));
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };
  const saved = await ctx.container.updateSite(siteId, checked.value);
  if (!saved.ok) return refused(saved.code, values);
  redirect(`/sites/${siteId}`);
}

export async function createAssetAction(siteId: string, _state: RecordFormState<AssetInput>, formData: FormData): Promise<RecordFormState<AssetInput>> {
  const values = readAsset(formData);
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(siteId)) return { status: "not_found", values };
  const checked = validateAsset(values, (await ctx.container.listAssetTypes()).map((type) => type.id));
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };
  const saved = await ctx.container.createAsset(ctx.orgId, siteId, checked.value);
  if (!saved.ok) return refused(saved.code, values);
  redirect(`/sites/${siteId}`);
}

export async function updateAssetAction(assetId: string, _state: RecordFormState<AssetInput>, formData: FormData): Promise<RecordFormState<AssetInput>> {
  const values = readAsset(formData);
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(assetId)) return { status: "not_found", values };
  const asset = await ctx.container.assetForEdit(assetId);
  if (!asset) return { status: "not_found", values };
  const checked = validateAsset(values, (await ctx.container.listAssetTypes()).map((type) => type.id));
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };
  const saved = await ctx.container.updateAsset(assetId, checked.value);
  if (!saved.ok) return refused(saved.code, values);
  redirect(`/sites/${asset.siteId}`);
}

/** A refused status change, as the control shows it; `null` when it went through. */
function activeRefusal(result: SetActiveResult): ActiveState | null {
  if (result.ok) return null;
  switch (result.code) {
    case "in_term":
      return { status: "in_term", site: result.site, number: result.number, termEnd: result.termEnd };
    case "changes_requested":
      return { status: "changes_requested", site: result.site, number: result.number };
    case "parent_inactive":
      return { status: "parent_inactive", parent: result.parent };
    default:
      return { status: result.code };
  }
}

export async function deactivateCustomerAction(customerId: string): Promise<ActiveState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(customerId)) return { status: "not_found" };
  const refused = activeRefusal(await ctx.container.setCustomerActive(customerId, false));
  if (refused) return refused;
  redirect(`/customers/${customerId}`);
}

export async function reactivateCustomerAction(customerId: string): Promise<ActiveState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(customerId)) return { status: "not_found" };
  const refused = activeRefusal(await ctx.container.setCustomerActive(customerId, true));
  if (refused) return refused;
  redirect(`/customers/${customerId}`);
}

export async function deactivateSiteAction(siteId: string): Promise<ActiveState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(siteId)) return { status: "not_found" };
  const refused = activeRefusal(await ctx.container.setSiteActive(siteId, false));
  if (refused) return refused;
  redirect(`/sites/${siteId}`);
}

export async function reactivateSiteAction(siteId: string): Promise<ActiveState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(siteId)) return { status: "not_found" };
  const refused = activeRefusal(await ctx.container.setSiteActive(siteId, true));
  if (refused) return refused;
  redirect(`/sites/${siteId}`);
}

export async function removeAssetAction(assetId: string, _state: ActiveState, formData: FormData): Promise<ActiveState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(assetId)) return { status: "not_found" };
  const asset = await ctx.container.assetForEdit(assetId);
  if (!asset) return { status: "not_found" };
  const replacedBy = readFields(formData, ["replacedBy"]).replacedBy || null;
  const refused = activeRefusal(await ctx.container.setAssetActive(assetId, false, replacedBy));
  if (refused) return refused;
  redirect(`/sites/${asset.siteId}`);
}

export async function reactivateAssetAction(assetId: string): Promise<ActiveState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isId(assetId)) return { status: "not_found" };
  const asset = await ctx.container.assetForEdit(assetId);
  if (!asset) return { status: "not_found" };
  const refused = activeRefusal(await ctx.container.setAssetActive(assetId, true));
  if (refused) return refused;
  redirect(`/sites/${asset.siteId}`);
}
