import { describe, expect, test } from "vitest";
import { validateContact, validateCustomer } from "@/domain/records";
import { domainSchema, text } from "./domain-schema";

const contact = domainSchema({ name: text(), email: text(), phone: text() }, (input) => validateContact(input));

describe("domainSchema", () => {
  test("a valid form passes", () => {
    expect(contact.safeParse({ name: "Dana", email: "dana@x.test", phone: "" }).success).toBe(true);
  });

  test("each message the domain validator gives lands on its own field", () => {
    const result = contact.safeParse({ name: " ", email: "nope", phone: "" });
    expect(result.success).toBe(false);
    const byField = Object.fromEntries((result.error?.issues ?? []).map((issue) => [issue.path[0], issue.message]));
    expect(byField).toEqual({ name: "Contact name must be 1 to 120 characters", email: "Enter an email like name@company.com" });
  });

  test("a field left out counts as blank, so the validator still speaks", () => {
    expect(contact.safeParse({}).success).toBe(false);
  });

  test("an optional field the form does not offer stays absent", () => {
    const customer = domainSchema({ name: text(), billingContactId: text().optional() }, (input) => validateCustomer(input, []));
    const parsed = customer.safeParse({ name: "Acme" });
    expect(parsed.success).toBe(true);
    expect(parsed.data && "billingContactId" in parsed.data && parsed.data.billingContactId).toBeFalsy();
  });
});
