import { isUuid } from "../imports";

/** A form's field errors, one message per field that failed. */
export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export type Validation<Value, Field extends string> = { ok: true; value: Value } | { ok: false; errors: FieldErrors<Field> };

/** `billingContactId` is absent where the form offers no choice (a new customer has no contacts yet). */
export type CustomerInput = { name: string; billingContactId?: string };
export type CustomerValue = { name: string; billingContactId?: string | null };

export type ContactInput = { name: string; email: string; phone: string };
export type ContactValue = { name: string; email: string | null; phone: string | null };

export type SiteInput = { name: string; address: string; siteContactId: string; approverContactId?: string };
export type SiteValue = { name: string; address: string | null; siteContactId: string | null; approverContactId?: string | null };

export type AssetInput = { assetTypeId: string; unitNo: string; typeModel: string; location: string };
export type AssetValue = { assetTypeId: string; unitNo: string | null; typeModel: string | null; location: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredText<F extends string>(raw: string, max: number, message: string, errors: FieldErrors<F>, field: F) {
  const text = raw.trim();
  if (text === "" || text.length > max) errors[field] = message;
  return text;
}

function optionalText<F extends string>(raw: string, max: number, label: string, errors: FieldErrors<F>, field: F) {
  const text = raw.trim();
  if (text.length > max) errors[field] = `${label} must be ${max} characters or fewer`;
  return text === "" ? null : text;
}

function result<Value, F extends string>(value: Value, errors: FieldErrors<F>): Validation<Value, F> {
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

const NOT_THIS_CUSTOMERS = "Choose a contact of this customer";

/** A contact chosen for a role: blank is none, anything not in `allowedContactIds` is refused. */
function roleContact<F extends string>(raw: string, allowedContactIds: readonly string[], errors: FieldErrors<F>, field: F): string | null {
  const id = raw.trim();
  if (id !== "" && !allowedContactIds.includes(id)) errors[field] = NOT_THIS_CUSTOMERS;
  return id === "" ? null : id;
}

/** `allowedContactIds` are the customer's contacts, for the billing contact; a new customer has none. */
export function validateCustomer(input: CustomerInput, allowedContactIds: readonly string[] = []): Validation<CustomerValue, keyof CustomerInput> {
  const errors: FieldErrors<keyof CustomerInput> = {};
  const name = requiredText(input.name, 120, "Customer name must be 1 to 120 characters", errors, "name");
  if (input.billingContactId === undefined) return result({ name }, errors);
  const billingContactId = roleContact(input.billingContactId, allowedContactIds, errors, "billingContactId");
  return result({ name, billingContactId }, errors);
}

export function validateContact(input: ContactInput): Validation<ContactValue, keyof ContactInput> {
  const errors: FieldErrors<keyof ContactInput> = {};
  const name = requiredText(input.name, 120, "Contact name must be 1 to 120 characters", errors, "name");
  const email = input.email.trim();
  if (email !== "" && (email.length > 254 || !EMAIL.test(email))) errors.email = "Enter an email like name@company.com";
  const phone = optionalText(input.phone, 40, "Phone", errors, "phone");
  return result({ name, email: email === "" ? null : email, phone }, errors);
}

/** `allowedContactIds` are the contacts of the site's customer; any other id is refused. */
export function validateSite(input: SiteInput, allowedContactIds: readonly string[]): Validation<SiteValue, keyof SiteInput> {
  const errors: FieldErrors<keyof SiteInput> = {};
  const name = requiredText(input.name, 120, "Site name must be 1 to 120 characters", errors, "name");
  const address = optionalText(input.address, 300, "Address", errors, "address");
  const siteContactId = roleContact(input.siteContactId, allowedContactIds, errors, "siteContactId");
  if (input.approverContactId === undefined) return result({ name, address, siteContactId }, errors);
  const approverContactId = roleContact(input.approverContactId, allowedContactIds, errors, "approverContactId");
  return result({ name, address, siteContactId, approverContactId }, errors);
}

/** `allowedTypeIds` are the org's asset types; any other id is refused. */
export function validateAsset(input: AssetInput, allowedTypeIds: readonly string[]): Validation<AssetValue, keyof AssetInput> {
  const errors: FieldErrors<keyof AssetInput> = {};
  const assetTypeId = input.assetTypeId.trim();
  if (!allowedTypeIds.includes(assetTypeId)) errors.assetTypeId = "Choose an equipment type";
  const unitNo = optionalText(input.unitNo, 40, "Unit #", errors, "unitNo");
  const typeModel = optionalText(input.typeModel, 120, "Type/model", errors, "typeModel");
  const location = optionalText(input.location, 300, "Location/access", errors, "location");
  return result({ assetTypeId, unitNo, typeModel, location }, errors);
}

/** Inactive records are listed only for `?show=inactive`; any other value, or none, hides them (deactivation door 8). */
export function showInactive(params: { show?: string | string[] }): boolean {
  return params.show === "inactive";
}

/** What the Sites & equipment page asks of the list; each member is optional (sites-page door 1). */
export type SiteFilter = { q?: string; customerId?: string; showInactive?: boolean };

const SITE_SEARCH_MAX = 100;

type SiteParams = Record<string, string | string[] | undefined>;

const single = (value: string | string[] | undefined): string | undefined => (typeof value === "string" ? value : undefined);

/** The filter a URL asks for; a value that is not valid is dropped, never an error (sites-page AC 9). */
export function parseSiteFilter(params: SiteParams): SiteFilter {
  const q = single(params.q)?.trim().slice(0, SITE_SEARCH_MAX).trim();
  const customer = single(params.customer);
  return {
    ...(q && { q }),
    ...(customer && isUuid(customer) && { customerId: customer }),
    ...(showInactive(params) && { showInactive: true }),
  };
}
