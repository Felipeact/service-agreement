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

/** One equipment type chosen by hand in the New agreement dialog, and how many units of it the site has. */
export type EquipmentPick = { assetTypeId: string; count: number };

export const MAX_UNITS_PER_TYPE = 99;
export const MAX_PICKED_UNITS = 500;

/**
 * The hand-picked equipment, kept only for the org's own types and whole counts from 1 to `MAX_UNITS_PER_TYPE`; a type
 * named twice is counted once with the larger count. More than `MAX_PICKED_UNITS` units in all is refused.
 */
export function validateEquipmentPicks(
  picks: readonly EquipmentPick[],
  allowedTypeIds: readonly string[],
): { ok: true; value: EquipmentPick[] } | { ok: false; error: string } {
  const allowed = new Set(allowedTypeIds);
  const byType = new Map<string, number>();
  for (const pick of picks) {
    if (!allowed.has(pick.assetTypeId)) return { ok: false, error: "Choose equipment types from the list" };
    if (!Number.isInteger(pick.count) || pick.count < 1 || pick.count > MAX_UNITS_PER_TYPE) return { ok: false, error: `Each type takes 1 to ${MAX_UNITS_PER_TYPE} units` };
    byType.set(pick.assetTypeId, Math.max(byType.get(pick.assetTypeId) ?? 0, pick.count));
  }
  const value = [...byType].map(([assetTypeId, count]) => ({ assetTypeId, count }));
  if (value.reduce((sum, pick) => sum + pick.count, 0) > MAX_PICKED_UNITS) return { ok: false, error: `Add at most ${MAX_PICKED_UNITS} units here; import a list for more` };
  return { ok: true, value };
}
