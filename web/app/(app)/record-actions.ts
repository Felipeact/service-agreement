"use server";

import { redirect } from "next/navigation";
import type { WriteFailure } from "@/application/ports";
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
import { canWriteRecords, type DeleteState, type RecordFormState } from "@/components/records/state";

const FORBIDDEN = { status: "forbidden" } as const;

/** The container and the member's org, or `null` when the member may not write records. Signed out goes to /login. */
async function writer() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return canWriteRecords(member.role) ? { container, orgId: member.orgId } : null;
}

// Only these fields are read: ids and org come from the route and the member, never from the form (AC 35).
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const readCustomer = (formData: FormData): CustomerInput => ({ name: text(formData, "name") });
const readContact = (formData: FormData): ContactInput => ({
  name: text(formData, "name"),
  email: text(formData, "email"),
  phone: text(formData, "phone"),
});
const readSite = (formData: FormData): SiteInput => ({
  name: text(formData, "name"),
  address: text(formData, "address"),
  siteContactId: text(formData, "siteContactId"),
});
const readAsset = (formData: FormData): AssetInput => ({
  assetTypeId: text(formData, "assetTypeId"),
  unitNo: text(formData, "unitNo"),
  typeModel: text(formData, "typeModel"),
  location: text(formData, "location"),
});

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
  const checked = validateCustomer(values);
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
  const asset = await ctx.container.assetForEdit(assetId);
  if (!asset) return { status: "not_found", values };
  const checked = validateAsset(values, (await ctx.container.listAssetTypes()).map((type) => type.id));
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };
  const saved = await ctx.container.updateAsset(assetId, checked.value);
  if (!saved.ok) return refused(saved.code, values);
  redirect(`/sites/${asset.siteId}`);
}

export async function deleteAssetAction(assetId: string): Promise<DeleteState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  const asset = await ctx.container.assetForEdit(assetId);
  if (!asset) return { status: "not_found" };
  const deleted = await ctx.container.deleteAsset(assetId);
  if (!deleted.ok) return { status: deleted.code };
  redirect(`/sites/${asset.siteId}`);
}
