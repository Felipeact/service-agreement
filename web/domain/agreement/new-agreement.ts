import { isUuid } from "../imports";
import { validateCustomer, validateSite, type CustomerValue, type SiteValue } from "../records";

/** The value a customer or site choice holds while the member is adding a new one instead of picking an existing one. */
export const NEW_CHOICE = "__new";

/**
 * What the New agreement dialog sends: a customer choice and a site choice, each an id or `NEW_CHOICE`, plus the new records' fields,
 * and the template version chosen (absent or empty for Standard agreement, which pins nothing).
 */
export type NewAgreementInput = { customer: string; customerName: string; site: string; siteName: string; address: string; templateVersionId?: string };

export type NewAgreementField = keyof NewAgreementInput;

/** What to do to start the agreement: use or create the customer, use or create its site. */
export type NewAgreementPlan = {
  customer: { kind: "existing"; id: string } | { kind: "new"; value: CustomerValue };
  site: { kind: "existing"; id: string } | { kind: "new"; value: SiteValue };
  /** The template version the agreement is pinned to; absent for Standard agreement. */
  templateVersionId?: string;
};

export type NewAgreementValidation = { ok: true; value: NewAgreementPlan } | { ok: false; errors: Partial<Record<NewAgreementField, string>> };

/**
 * A new customer has no sites, so it always gets a new site; an existing customer offers its own sites or a new one.
 * Names and the address follow the same limits as the Customers and Sites forms.
 */
export function validateNewAgreement(input: NewAgreementInput): NewAgreementValidation {
  const errors: Partial<Record<NewAgreementField, string>> = {};

  let customer: NewAgreementPlan["customer"] | undefined;
  if (input.customer === NEW_CHOICE) {
    const checked = validateCustomer({ name: input.customerName });
    if (checked.ok) customer = { kind: "new", value: checked.value };
    else errors.customerName = checked.errors.name;
  } else if (isUuid(input.customer)) {
    customer = { kind: "existing", id: input.customer };
  } else {
    errors.customer = "Choose a customer, or add a new one";
  }

  let site: NewAgreementPlan["site"] | undefined;
  if (input.site === NEW_CHOICE || input.customer === NEW_CHOICE) {
    const checked = validateSite({ name: input.siteName, address: input.address, siteContactId: "" }, []);
    if (checked.ok) site = { kind: "new", value: checked.value };
    else {
      if (checked.errors.name) errors.siteName = checked.errors.name;
      if (checked.errors.address) errors.address = checked.errors.address;
    }
  } else if (isUuid(input.site)) {
    site = { kind: "existing", id: input.site };
  } else if (!errors.customer) {
    errors.site = "Choose a site, or add a new one";
  }

  const version = input.templateVersionId ?? "";
  if (version !== "" && !isUuid(version)) errors.templateVersionId = "Choose a template from the list";

  if (!customer || !site || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: version === "" ? { customer, site } : { customer, site, templateVersionId: version } };
}

/** Equipment picked by hand in the New agreement dialog: a type and how many of it are on site. */
export type PickedEquipment = { assetTypeId: string; quantity: number };

/** The most units one pick can add in one go, so a slip of the keyboard does not fill a site's register. */
export const MAX_PICKED_UNITS = 200;

export type PickedEquipmentCheck = { ok: true; items: PickedEquipment[] } | { ok: false; message: string };

/**
 * Checks what was picked against the org's equipment types: at least one unit, every type known, each quantity a whole
 * number from 1 to 99, no more than `MAX_PICKED_UNITS` units in all. A type picked twice is added up.
 */
export function validatePickedEquipment(items: unknown, allowedTypeIds: readonly string[]): PickedEquipmentCheck {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, message: "Pick at least one piece of equipment." };
  const totals = new Map<string, number>();
  for (const item of items) {
    const { assetTypeId, quantity } = (item ?? {}) as Partial<PickedEquipment>;
    if (typeof assetTypeId !== "string" || !allowedTypeIds.includes(assetTypeId)) return { ok: false, message: "Choose equipment from the list." };
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { ok: false, message: "Each quantity must be a whole number from 1 to 99." };
    totals.set(assetTypeId, (totals.get(assetTypeId) ?? 0) + quantity);
  }
  const merged = [...totals].map(([assetTypeId, quantity]) => ({ assetTypeId, quantity }));
  if (merged.some((item) => item.quantity > 99)) return { ok: false, message: "Each type can have at most 99 units; a type picked twice is added up." };
  if (merged.reduce((sum, item) => sum + item.quantity, 0) > MAX_PICKED_UNITS) return { ok: false, message: `Add at most ${MAX_PICKED_UNITS} units at a time.` };
  return { ok: true, items: merged };
}
