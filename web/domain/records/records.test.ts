import { describe, expect, test } from "vitest";
import { validateAsset, validateContact, validateCustomer, validateSite } from "./index";
import { parseSiteFilter, showInactive } from "./index";

const chars = (n: number) => "x".repeat(n);
/** An address of exactly `n` characters that matches the email pattern. */
const email = (n: number) => `${chars(n - "@b.co".length)}@b.co`;

describe("validateCustomer", () => {
  test("C302: the name is trimmed and must be 1 to 120 characters", () => {
    expect(validateCustomer({ name: "  Acme  " })).toEqual({ ok: true, value: { name: "Acme" } });
    expect(validateCustomer({ name: chars(120) })).toEqual({ ok: true, value: { name: chars(120) } });
    for (const name of ["", "   ", chars(121)]) {
      expect(validateCustomer({ name }), JSON.stringify(name)).toEqual({
        ok: false,
        errors: { name: "Customer name must be 1 to 120 characters" },
      });
    }
  });
});

describe("validateContact", () => {
  const valid = { name: "Dana", email: "", phone: "" };

  test("C309: empty email and phone are stored as null", () => {
    expect(validateContact(valid)).toEqual({ ok: true, value: { name: "Dana", email: null, phone: null } });
  });

  test("C309: the name must be 1 to 120 characters", () => {
    expect(validateContact({ ...valid, name: "D" }).ok).toBe(true);
    expect(validateContact({ ...valid, name: chars(120) }).ok).toBe(true);
    for (const name of ["", chars(121)]) {
      expect(validateContact({ ...valid, name })).toEqual({ ok: false, errors: { name: "Contact name must be 1 to 120 characters" } });
    }
  });

  test("C309: the email must look like an address and fit 254 characters", () => {
    expect(validateContact({ ...valid, email: "a@b.co" })).toMatchObject({ ok: true, value: { email: "a@b.co" } });
    expect(validateContact({ ...valid, email: " a@b.co " })).toMatchObject({ ok: true, value: { email: "a@b.co" } });
    expect(validateContact({ ...valid, email: email(254) })).toMatchObject({ ok: true, value: { email: email(254) } });
    for (const bad of ["ab.co", "a@b", "a b@c.co", email(255)]) {
      expect(validateContact({ ...valid, email: bad }), bad.slice(0, 20)).toEqual({
        ok: false,
        errors: { email: "Enter an email like name@company.com" },
      });
    }
  });

  test("C309: the phone must be 40 characters or fewer", () => {
    expect(validateContact({ ...valid, phone: chars(40) })).toMatchObject({ ok: true, value: { phone: chars(40) } });
    expect(validateContact({ ...valid, phone: chars(41) })).toEqual({ ok: false, errors: { phone: "Phone must be 40 characters or fewer" } });
  });
});

describe("validateSite", () => {
  const valid = { name: "Tower A", address: "", siteContactId: "" };

  test("C318: the name must be 1 to 120 characters", () => {
    expect(validateSite({ ...valid, name: "T" }, []).ok).toBe(true);
    expect(validateSite({ ...valid, name: chars(120) }, []).ok).toBe(true);
    for (const name of ["", chars(121)]) {
      expect(validateSite({ ...valid, name }, [])).toEqual({ ok: false, errors: { name: "Site name must be 1 to 120 characters" } });
    }
  });

  test("C318: the address must be 300 characters or fewer", () => {
    expect(validateSite({ ...valid, address: chars(300) }, [])).toMatchObject({ ok: true, value: { address: chars(300) } });
    expect(validateSite({ ...valid, address: chars(301) }, [])).toEqual({
      ok: false,
      errors: { address: "Address must be 300 characters or fewer" },
    });
  });

  test("C318: the site contact is empty or one of the allowed contacts", () => {
    expect(validateSite(valid, ["c1"])).toEqual({ ok: true, value: { name: "Tower A", address: null, siteContactId: null } });
    expect(validateSite({ ...valid, siteContactId: "c1" }, ["c1", "c2"])).toMatchObject({ ok: true, value: { siteContactId: "c1" } });
    expect(validateSite({ ...valid, siteContactId: "c9" }, ["c1", "c2"])).toEqual({
      ok: false,
      errors: { siteContactId: "Choose a contact of this customer" },
    });
  });
});

describe("validateAsset", () => {
  const valid = { assetTypeId: "t1", unitNo: "", typeModel: "", location: "" };

  test("C324: the equipment type must be one of the allowed types", () => {
    expect(validateAsset(valid, ["t1"])).toEqual({
      ok: true,
      value: { assetTypeId: "t1", unitNo: null, typeModel: null, location: null },
    });
    for (const assetTypeId of ["", "t9"]) {
      expect(validateAsset({ ...valid, assetTypeId }, ["t1"])).toEqual({ ok: false, errors: { assetTypeId: "Choose an equipment type" } });
    }
  });

  test.each([
    ["unitNo", 40, "Unit # must be 40 characters or fewer"],
    ["typeModel", 120, "Type/model must be 120 characters or fewer"],
    ["location", 300, "Location/access must be 300 characters or fewer"],
  ] as const)("C324: %s accepts %i characters and refuses one more", (field, max, message) => {
    expect(validateAsset({ ...valid, [field]: chars(max) }, ["t1"])).toMatchObject({ ok: true, value: { [field]: chars(max) } });
    expect(validateAsset({ ...valid, [field]: chars(max + 1) }, ["t1"])).toEqual({ ok: false, errors: { [field]: message } });
  });
});

describe("showInactive", () => {
  test("C1300: only show=inactive lists inactive records", () => {
    expect(showInactive({ show: "inactive" })).toBe(true);
    for (const params of [{}, { show: "all" }, { show: ["inactive"] }, { show: "" }]) expect(showInactive(params), JSON.stringify(params)).toBe(false);
  });
});

describe("parseSiteFilter", () => {
  const CUSTOMER = "00000000-0000-4000-8000-0000000000c1";

  test("C1377: q is trimmed, cut at 100 characters and dropped when empty", () => {
    expect(parseSiteFilter({ q: "  tower  " })).toEqual({ q: "tower" });
    expect(parseSiteFilter({ q: "x".repeat(150) })).toEqual({ q: "x".repeat(100) });
    expect(parseSiteFilter({ q: "   " })).toEqual({});
    expect(parseSiteFilter({ q: "" })).toEqual({});
  });

  test("C1377: customer is kept only as a uuid", () => {
    expect(parseSiteFilter({ customer: CUSTOMER })).toEqual({ customerId: CUSTOMER });
    expect(parseSiteFilter({ customer: "nope" })).toEqual({});
    expect(parseSiteFilter({ customer: "" })).toEqual({});
  });

  test("C1377: showInactive is kept only for show exactly inactive", () => {
    expect(parseSiteFilter({ show: "inactive" })).toEqual({ showInactive: true });
    for (const show of ["Inactive", "all", "1", ""]) expect(parseSiteFilter({ show }), show).toEqual({});
  });

  test("C1377: an array-valued parameter keeps nothing and nothing throws", () => {
    expect(parseSiteFilter({ q: ["a", "b"], customer: [CUSTOMER], show: ["inactive"] })).toEqual({});
    expect(parseSiteFilter({})).toEqual({});
  });

  test("C1377: several parameters are all kept", () => {
    expect(parseSiteFilter({ q: "a", customer: CUSTOMER, show: "inactive" })).toEqual({ q: "a", customerId: CUSTOMER, showInactive: true });
  });
});
