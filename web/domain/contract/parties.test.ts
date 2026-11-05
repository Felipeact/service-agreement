import { describe, expect, test } from "vitest";
import { parseContractParties } from "./parties";

const FULL = {
  schema: 1,
  contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100" },
  customer: { name: "Fernwood Dental" },
  site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" },
  signer: { name: "Pat Lee", email: "pat@example.com" },
};

describe("parseContractParties", () => {
  test("C1628: a schema 1 object comes back typed", () => {
    expect(parseContractParties(FULL)).toEqual({
      contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100" },
      customer: { name: "Fernwood Dental" },
      site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" },
      signer: { name: "Pat Lee", email: "pat@example.com" },
    });
  });

  test("C1628: a missing optional key comes back as null", () => {
    const parsed = parseContractParties({
      schema: 1,
      contractor: { legalName: "Kettle Ridge Mechanical Ltd." },
      customer: { name: "Fernwood Dental" },
      site: { name: "Main" },
    });
    expect(parsed).toEqual({
      contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: null, phone: null },
      customer: { name: "Fernwood Dental" },
      site: { name: "Main", address: null },
      signer: null,
    });
  });

  test.each<[string, unknown]>([
    ["an empty object (not recorded)", {}],
    ["another schema", { ...FULL, schema: 2 }],
    ["an array", []],
    ["a string", "parties"],
    ["null", null],
    ["a number", 1],
    ["no contractor legal name", { ...FULL, contractor: { address: "x", phone: "y" } }],
    ["a blank contractor legal name", { ...FULL, contractor: { legalName: "  " } }],
    ["no customer name", { ...FULL, customer: {} }],
    ["no site name", { ...FULL, site: { address: "x" } }],
  ])("C1628: %s is null", (_name, value) => {
    expect(parseContractParties(value)).toBeNull();
  });

  test("C1628: a signer without an email is not a signer", () => {
    expect(parseContractParties({ ...FULL, signer: { name: "Pat Lee" } })?.signer).toBeNull();
  });
});
