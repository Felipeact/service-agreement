import { describe, expect, test } from "vitest";
import { NEW_CHOICE, validateNewAgreement, type NewAgreementInput } from "./new-agreement";

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222222";

const input = (patch: Partial<NewAgreementInput> = {}): NewAgreementInput => ({ customer: CUSTOMER, customerName: "", site: SITE, siteName: "", address: "", ...patch });

describe("validateNewAgreement", () => {
  test("an existing customer and an existing site are used as chosen", () => {
    expect(validateNewAgreement(input())).toEqual({ ok: true, value: { customer: { kind: "existing", id: CUSTOMER }, site: { kind: "existing", id: SITE } } });
  });

  test("an existing customer can take a new site, with its name and address trimmed", () => {
    const checked = validateNewAgreement(input({ site: NEW_CHOICE, siteName: "  Tower B ", address: " 1 Main St " }));
    expect(checked).toEqual({
      ok: true,
      value: { customer: { kind: "existing", id: CUSTOMER }, site: { kind: "new", value: { name: "Tower B", address: "1 Main St", siteContactId: null } } },
    });
  });

  test("a new customer always gets a new site, whatever the site choice says", () => {
    const checked = validateNewAgreement(input({ customer: NEW_CHOICE, customerName: "Kestrel Logistics", site: SITE, siteName: "Dock 4" }));
    expect(checked.ok && checked.value.customer).toEqual({ kind: "new", value: { name: "Kestrel Logistics" } });
    expect(checked.ok && checked.value.site.kind).toBe("new");
  });

  test.each([
    [{ customer: "" }, "customer", "Choose a customer, or add a new one"],
    [{ customer: "not-a-uuid" }, "customer", "Choose a customer, or add a new one"],
    [{ site: "" }, "site", "Choose a site, or add a new one"],
    [{ customer: NEW_CHOICE, customerName: "  " }, "customerName", "Customer name must be 1 to 120 characters"],
    [{ site: NEW_CHOICE, siteName: "" }, "siteName", "Site name must be 1 to 120 characters"],
    [{ site: NEW_CHOICE, siteName: "A", address: "x".repeat(301) }, "address", "Address must be 300 characters or fewer"],
  ] as const)("%j is refused with the message on %s", (patch, field, message) => {
    const checked = validateNewAgreement(input(patch));
    expect(checked.ok).toBe(false);
    expect(!checked.ok && checked.errors[field]).toBe(message);
  });

  test("one bad customer and one bad site report both", () => {
    const checked = validateNewAgreement(input({ customer: NEW_CHOICE, customerName: "", siteName: "" }));
    expect(!checked.ok && Object.keys(checked.errors).sort()).toEqual(["customerName", "siteName"]);
  });
});
