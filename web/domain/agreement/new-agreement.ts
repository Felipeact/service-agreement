import { isUuid } from "../imports";
import { validateCustomer, validateSite, type CustomerValue, type SiteValue } from "../records";

/** The value a customer or site choice holds while the member is adding a new one instead of picking an existing one. */
export const NEW_CHOICE = "__new";

/** What the New agreement dialog sends: a customer choice and a site choice, each an id or `NEW_CHOICE`, plus the new records' fields. */
export type NewAgreementInput = { customer: string; customerName: string; site: string; siteName: string; address: string };

export type NewAgreementField = keyof NewAgreementInput;

/** What to do to start the agreement: use or create the customer, use or create its site. */
export type NewAgreementPlan = {
  customer: { kind: "existing"; id: string } | { kind: "new"; value: CustomerValue };
  site: { kind: "existing"; id: string } | { kind: "new"; value: SiteValue };
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

  if (!customer || !site || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { customer, site } };
}
