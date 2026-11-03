import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AssetFields } from "./asset-form";
import { ContactFields } from "./contact-form";
import { CustomerFields } from "./customer-form";
import { DeactivatePrompt, ReactivatePrompt, replacementOptions, withdrawnBy } from "./active-control";
import { DeletePrompt } from "./delete-control";
import { RecordPage } from "./record-form";
import { SiteFields } from "./site-form";
import { cancelHrefFor, canWriteRecords, type ActiveState, type DeleteState, type RecordFormKind } from "./state";

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

type DeactivateProps = Parameters<typeof DeactivatePrompt>[0];
const deactivate = (props: Partial<DeactivateProps> & Pick<DeactivateProps, "kind" | "name">) =>
  html(createElement(DeactivatePrompt, { confirming: false, pending: false, state: { status: "idle" }, ...props }));
const reactivate = (kind: DeactivateProps["kind"], state: ActiveState = { status: "idle" }) =>
  html(createElement(ReactivatePrompt, { kind, pending: false, state }));
const IN_TERM: ActiveState = { status: "in_term", site: "Tower A", number: "AG-1004", termEnd: "2027-12-31" };

describe("deactivation controls", () => {
  test("C1278: before confirming, an asset offers one Remove from service button and no Delete asset", () => {
    const out = deactivate({ kind: "asset", name: "RTU RTU-1" });
    expect(out.match(/<button[^>]*>([^<]*)<\/button>/g)).toEqual([expect.stringContaining(">Remove from service<")]);
    expect(out).not.toContain("Delete asset");
    expect(out).not.toContain("<form");
  });

  test("C1278: confirming offers Replaced by: None, then the other active units by code and unit", () => {
    const out = deactivate({
      kind: "asset",
      name: "RTU RTU-1",
      confirming: true,
      replacements: [
        { id: "a2", label: "RTU RTU-2" },
        { id: "a3", label: "MUA MUA-1" },
      ],
    });
    expect(out).toContain("Remove RTU RTU-1 from service?");
    expect(options(out, "replacedBy")).toEqual([
      { value: "", selected: true, text: "None" },
      { value: "a2", selected: false, text: "RTU RTU-2" },
      { value: "a3", selected: false, text: "MUA MUA-1" },
    ]);
    expect(out).toMatch(/<select[^>]*name="replacedBy"/);
  });

  test("C1278: with no other active unit there is no Replaced by field", () => {
    expect(deactivate({ kind: "asset", name: "RTU RTU-1", confirming: true })).not.toContain("Replaced by");
  });

  test("C1278: the options are the site's other active units, never the asset itself or a removed one", () => {
    const unit = (id: string, typeCode: string, unitNo: string | null, active = true) => ({
      id,
      typeCode,
      typeName: typeCode,
      unitNo,
      typeModel: null,
      location: null,
      source: "manual" as const,
      active,
      replacedBy: null,
    });
    const site = [unit("a1", "RTU", "RTU-1"), unit("a2", "RTU", "RTU-2"), unit("a3", "RTU", "RTU-3", false), unit("a4", "MUA", null)];
    expect(replacementOptions(site, "a1")).toEqual([
      { id: "a2", label: "RTU RTU-2" },
      { id: "a4", label: "MUA" },
    ]);
    expect(replacementOptions([unit("a1", "RTU", "RTU-1"), unit("a3", "RTU", "RTU-3", false)], "a1")).toEqual([]);
  });

  test("C1294: a draft or sent agreement is what a site deactivation withdraws; changes requested is not", () => {
    expect(withdrawnBy({ id: "g1", number: "AG-1004", status: "draft" })).toBe("AG-1004");
    expect(withdrawnBy({ id: "g1", number: "AG-1004", status: "sent" })).toBe("AG-1004");
    expect(withdrawnBy({ id: "g1", number: "AG-1004", status: "changes_requested" })).toBeNull();
    expect(withdrawnBy(null)).toBeNull();
  });

  test("C1294: a site asks by name and says what it withdraws", () => {
    const out = deactivate({ kind: "site", name: "Tower A", confirming: true, withdraws: "AG-1004" });
    expect(out).toContain("Deactivate Tower A?");
    expect(out).toContain("This withdraws AG-1004.");
    expect(deactivate({ kind: "site", name: "Tower A", confirming: true })).not.toContain("This withdraws");
  });

  test("C1294: the in-term and changes-requested refusals read as the plan says", () => {
    expect(deactivate({ kind: "site", name: "Tower A", state: IN_TERM })).toContain(
      "AG-1004 is in term until Dec 31, 2027, so this site can't be deactivated yet.",
    );
    expect(deactivate({ kind: "site", name: "Tower A", state: { status: "changes_requested", site: "Tower A", number: "AG-1004" } })).toContain(
      "AG-1004 has changes requested. Revise and withdraw it first.",
    );
  });

  test("C1298: a customer's refusal is prefixed with the site", () => {
    expect(deactivate({ kind: "customer", name: "Kettle Test", state: IN_TERM })).toContain(
      "Tower A: AG-1004 is in term until Dec 31, 2027, so this site can't be deactivated yet.",
    );
  });

  test("C1310: a refused reactivation names the parent to reactivate first", () => {
    expect(reactivate("site", { status: "parent_inactive", parent: "Kettle Test" })).toContain("Reactivate Kettle Test first.");
    expect(reactivate("asset", { status: "parent_inactive", parent: "Tower A" })).toContain("Reactivate Tower A first.");
  });

  test("C1311: a writer sees Reactivate on an inactive record; a viewer sees no status control at all", () => {
    for (const kind of ["customer", "site", "asset"] as const) {
      expect(reactivate(kind)).toMatch(/<button type="submit"[^>]*>Reactivate<\/button>/);
    }
    const controls = createElement("div", null, [
      createElement(DeactivatePrompt, { key: "c", kind: "customer", name: "Kettle", confirming: false, pending: false, state: { status: "idle" } }),
      createElement(DeactivatePrompt, { key: "s", kind: "site", name: "Tower A", confirming: false, pending: false, state: { status: "idle" } }),
      createElement(DeactivatePrompt, { key: "a", kind: "asset", name: "RTU-1", confirming: false, pending: false, state: { status: "idle" } }),
      createElement(ReactivatePrompt, { key: "r", kind: "site", pending: false, state: { status: "idle" } }),
    ]);
    const writer = html(createElement(RecordPage, { title: "Edit", canWrite: true } as Parameters<typeof RecordPage>[0], controls));
    for (const text of ["Deactivate customer", "Deactivate site", "Remove from service", "Reactivate"]) expect(writer, text).toContain(text);
    const viewer = html(createElement(RecordPage, { title: "Edit", canWrite: false } as Parameters<typeof RecordPage>[0], controls));
    for (const text of ["Deactivate customer", "Deactivate site", "Remove from service", "Reactivate"]) expect(viewer, text).not.toContain(text);
  });
});
