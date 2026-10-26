import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AssetFields } from "./asset-form";
import { ContactFields } from "./contact-form";
import { CustomerFields } from "./customer-form";
import { DeletePrompt } from "./delete-control";
import { SiteFields } from "./site-form";
import { cancelHrefFor, canWriteRecords, type DeleteState, type RecordFormKind } from "./state";

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
const form = { pending: false, submitLabel: "Save changes", cancelHref: "/customers" };

const customer = (state: Parameters<typeof CustomerFields>[0]["state"], patch: Partial<typeof form> = {}) =>
  html(createElement(CustomerFields, { values: { name: "Acme" }, state, ...form, ...patch }));
const site = { name: "Tower A", address: "", siteContactId: "" };
const asset = { assetTypeId: "", unitNo: "", typeModel: "", location: "" };

const prompt = (props: { confirming: boolean; pending?: boolean; state?: DeleteState }) =>
  html(createElement(DeletePrompt, { label: "Delete contact", name: "Dana", pending: false, state: { status: "idle" }, ...props }));

const options = (out: string, id: string) =>
  [...(out.match(new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)</select>`))?.[1] ?? "").matchAll(/<option([^>]*)>([^<]*)<\/option>/g)].map(
    ([, attrs, text]) => ({ value: attrs.match(/value="([^"]*)"/)?.[1], selected: /\sselected/.test(attrs), text }),
  );

describe("record forms", () => {
  test("C305: an invalid field shows its message, is marked invalid, and keeps the typed value", () => {
    const typed = "x".repeat(121);
    const out = html(
      createElement(CustomerFields, {
        values: { name: typed },
        state: { status: "invalid", errors: { name: "Customer name must be 1 to 120 characters" }, values: { name: typed } },
        ...form,
      }),
    );
    const input = out.match(/<input[^>]*id="name"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('aria-invalid="true"');
    expect(input).toContain(`value="${typed}"`);
    const describedBy = input.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(out).toMatch(new RegExp(`<p[^>]*id="${describedBy}"[^>]*>Customer name must be 1 to 120 characters</p>`));
  });

  test("C312: before confirming there is only a Delete contact button and nothing that submits", () => {
    const out = prompt({ confirming: false });
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>Delete contact</);
    expect(out).not.toContain('type="submit"');
  });

  test("C312: confirming asks by name, with a submitting Delete in a form and a Cancel button", () => {
    const out = prompt({ confirming: true });
    expect(out).toContain("Delete Dana? This can't be undone.");
    expect(out).toMatch(/<form[^>]*>[\s\S]*<button[^>]*type="submit"[^>]*>Delete<\/button>[\s\S]*<\/form>/);
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>Cancel</);
  });

  test("C314: a delete refused because the contact is a site contact says so", () => {
    expect(prompt({ confirming: true, state: { status: "in_use" } })).toMatch(
      /<p[^>]*role="alert"[^>]*>This contact is a site contact\. Choose another site contact for that site first\.<\/p>/,
    );
  });

  test("C317: the site contact list is No site contact, then the customer's contacts by name", () => {
    const zed = { id: "c-zed", name: "Zed" };
    const amy = { id: "c-amy", name: "Amy" };
    const out = html(createElement(SiteFields, { values: site, state: { status: "idle" }, contacts: [zed, amy], ...form }));
    expect(options(out, "siteContactId")).toEqual([
      { value: "", selected: true, text: "No site contact" },
      { value: "c-amy", selected: false, text: "Amy" },
      { value: "c-zed", selected: false, text: "Zed" },
    ]);

    const none = html(createElement(SiteFields, { values: site, state: { status: "idle" }, contacts: [], ...form }));
    expect(options(none, "siteContactId")).toEqual([{ value: "", selected: true, text: "No site contact" }]);
  });

  test("C323: the type list starts with an empty selected choice, then one option per type as name (code)", () => {
    const types = [
      { id: "t1", code: "BOILER", name: "Boiler" },
      { id: "t2", code: "RTU", name: "Rooftop unit" },
    ];
    const out = html(createElement(AssetFields, { values: asset, state: { status: "idle" }, types, ...form }));
    expect(options(out, "assetTypeId")).toEqual([
      { value: "", selected: true, text: "Choose a type" },
      { value: "t1", selected: false, text: "Boiler (BOILER)" },
      { value: "t2", selected: false, text: "Rooftop unit (RTU)" },
    ]);
  });

  test("C329: owners, admins and estimators write records, viewers do not", () => {
    expect(canWriteRecords("owner")).toBe(true);
    expect(canWriteRecords("admin")).toBe(true);
    expect(canWriteRecords("estimator")).toBe(true);
    expect(canWriteRecords("viewer")).toBe(false);
  });

  test("C331: a forbidden save says the member may not change records", () => {
    expect(customer({ status: "forbidden" })).toMatch(/<p[^>]*role="alert"[^>]*>You don't have permission to change customer records\.<\/p>/);
  });

  test("C333: a record that is gone says so and links to /customers", () => {
    const out = customer({ status: "not_found", values: { name: "Acme" } });
    expect(out).toContain("This record no longer exists.");
    expect(out).toMatch(/role="alert"[\s\S]*<a[^>]*href="\/customers"/);
  });

  test("C337: a failed save asks to try again and keeps the typed values", () => {
    const typed = { name: "Dana Typed", email: "dana@example.com", phone: "604-555-0111" };
    const out = html(createElement(ContactFields, { values: typed, state: { status: "unavailable", values: typed }, ...form }));
    expect(out).toMatch(/<p[^>]*role="alert"[^>]*>We couldn't save your changes\. Try again\.<\/p>/);
    expect(out).toMatch(/<input[^>]*id="name"[^>]*value="Dana Typed"/);
    expect(out).toMatch(/<input[^>]*id="email"[^>]*value="dana@example.com"/);
    expect(out).toMatch(/<input[^>]*id="phone"[^>]*value="604-555-0111"/);
  });

  test("C338: a pending save disables Save and says Saving…", () => {
    expect(customer({ status: "idle" }, { pending: true })).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Saving…<\/button>/);
  });

  test("C338: a pending delete disables Delete and says Deleting…", () => {
    expect(prompt({ confirming: true, pending: true })).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Deleting…<\/button>/);
  });

  test.each([
    ["new-customer", "/customers"],
    ["edit-customer", "/customers/c1"],
    ["new-contact", "/customers/c1"],
    ["edit-contact", "/customers/c1"],
    ["new-site", "/customers/c1"],
    ["edit-site", "/customers/c1"],
    ["new-asset", "/sites/s1"],
    ["edit-asset", "/sites/s1"],
  ] as [RecordFormKind, string][])("C339: the %s form's Cancel goes to %s", (kind, href) => {
    const cancelHref = cancelHrefFor(kind, { customerId: "c1", siteId: "s1" });
    expect(cancelHref).toBe(href);
    expect(customer({ status: "idle" }, { cancelHref })).toMatch(new RegExp(`<a[^>]*href="${href}"[^>]*>Cancel</a>`));
  });
});
