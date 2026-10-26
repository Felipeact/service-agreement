/** A form's field errors, one message per field that failed. */
export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export type Validation<Value, Field extends string> = { ok: true; value: Value } | { ok: false; errors: FieldErrors<Field> };

export type CustomerInput = { name: string };
export type CustomerValue = { name: string };

export type ContactInput = { name: string; email: string; phone: string };
export type ContactValue = { name: string; email: string | null; phone: string | null };

export type SiteInput = { name: string; address: string; siteContactId: string };
export type SiteValue = { name: string; address: string | null; siteContactId: string | null };

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

export function validateCustomer(input: CustomerInput): Validation<CustomerValue, keyof CustomerInput> {
  const errors: FieldErrors<keyof CustomerInput> = {};
  const name = requiredText(input.name, 120, "Customer name must be 1 to 120 characters", errors, "name");
  return result({ name }, errors);
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
  const siteContactId = input.siteContactId.trim();
  if (siteContactId !== "" && !allowedContactIds.includes(siteContactId)) errors.siteContactId = "Choose a contact of this customer";
  return result({ name, address, siteContactId: siteContactId === "" ? null : siteContactId }, errors);
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
