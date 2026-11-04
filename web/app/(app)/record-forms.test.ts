import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AssetRecord, ContactRecord, CurrentMember, CustomerDetail, MemberRole, SiteView } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const container = {
  currentMember,
  customerDetail: vi.fn(),
  siteRegister: vi.fn(),
  contactForEdit: vi.fn(),
  assetForEdit: vi.fn(),
  listAssetTypes: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  createSite: vi.fn(),
  updateSite: vi.fn(),
  createAsset: vi.fn(),
  updateAsset: vi.fn(),
  setCustomerActive: vi.fn(),
  setSiteActive: vi.fn(),
  setAssetActive: vi.fn(),
};
const STORE_METHODS = [
  "createCustomer",
  "updateCustomer",
  "createContact",
  "updateContact",
  "deleteContact",
  "createSite",
  "updateSite",
  "createAsset",
  "updateAsset",
  "setCustomerActive",
  "setSiteActive",
  "setAssetActive",
] as const;

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ notFound, redirect, usePathname: () => "/customers" }));

const actions = await import("./record-actions");

const ORG = "org-1";
const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const CONTACT = "22222222-2222-4222-8222-222222222222";
const SITE = "33333333-3333-4333-8333-333333333333";
const ASSET = "44444444-4444-4444-8444-444444444444";
const TYPE = "55555555-5555-4555-8555-555555555555";
const NEW_ID = "99999999-9999-4999-8999-999999999999";

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "e@example.com", orgId: ORG, orgName: "Org", role });

const customer: CustomerDetail = {
  id: CUSTOMER,
  name: "Kettle Test",
  active: true,
  contacts: [{ id: CONTACT, name: "Dana", email: null, phone: null }],
  sites: [],
  agreements: [],
};
const site: SiteView = {
  id: SITE,
  name: "Tower A",
  address: null,
  customerId: CUSTOMER,
  customerName: "Kettle Test",
  active: true,
  customerActive: true,
  siteContactId: null,
  contactName: null,
  assets: [],
  liveAgreement: null,
};
const contact: ContactRecord = { id: CONTACT, customerId: CUSTOMER, name: "Dana", email: null, phone: null };
const asset: AssetRecord = { id: ASSET, siteId: SITE, assetTypeId: TYPE, unitNo: "1", typeModel: null, location: "Roof", active: true };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}
const customerForm = (name = "Acme") => form({ name });
const contactForm = (patch: Record<string, string> = {}) => form({ name: "Dana", email: "", phone: "604-555-0111", ...patch });
const siteForm = (patch: Record<string, string> = {}) => form({ name: "Tower A", address: "1 Main St", siteContactId: CONTACT, ...patch });
const assetForm = (patch: Record<string, string> = {}) => form({ assetTypeId: TYPE, unitNo: "1", typeModel: "", location: "Roof", ...patch });
const IDLE = { status: "idle" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("estimator"));
  container.customerDetail.mockResolvedValue(customer);
  container.siteRegister.mockResolvedValue(site);
  container.contactForEdit.mockResolvedValue(contact);
  container.assetForEdit.mockResolvedValue(asset);
  container.listAssetTypes.mockResolvedValue([{ id: TYPE, code: "RTU", name: "Rooftop unit" }]);
  for (const name of STORE_METHODS) container[name].mockResolvedValue({ ok: true, id: NEW_ID });
});

const storeCalls = () => STORE_METHODS.reduce((total, name) => total + container[name].mock.calls.length, 0);

describe("customer actions", () => {
  test("C303: a writer's new customer is created for the member's org, then opened", async () => {
    await expect(actions.createCustomerAction(IDLE, customerForm("Acme"))).rejects.toThrow(`NEXT_REDIRECT /customers/${NEW_ID}`);
    expect(container.createCustomer).toHaveBeenCalledTimes(1);
    expect(container.createCustomer).toHaveBeenCalledWith(ORG, { name: "Acme" });
  });

  test("C304: an invalid name saves nothing and comes back with the message and what was typed", async () => {
    const typed = "x".repeat(121);
    expect(await actions.createCustomerAction(IDLE, customerForm(typed))).toEqual({
      status: "invalid",
      errors: { name: "Customer name must be 1 to 120 characters" },
      values: { name: typed },
    });
    expect(storeCalls()).toBe(0);
  });

  test("C307: a writer's rename updates that customer, then opens it", async () => {
    await expect(actions.updateCustomerAction(CUSTOMER, IDLE, customerForm("Acme Two"))).rejects.toThrow(`NEXT_REDIRECT /customers/${CUSTOMER}`);
    expect(container.updateCustomer).toHaveBeenCalledTimes(1);
    expect(container.updateCustomer).toHaveBeenCalledWith(CUSTOMER, { name: "Acme Two" });
  });
});

describe("contact actions", () => {
  test("C310: a new contact is created for the route's customer with empty fields as null", async () => {
    await expect(actions.createContactAction(CUSTOMER, IDLE, contactForm({ name: "Dana" }))).rejects.toThrow(`NEXT_REDIRECT /customers/${CUSTOMER}`);
    expect(container.createContact).toHaveBeenCalledTimes(1);
    expect(container.createContact).toHaveBeenCalledWith(ORG, CUSTOMER, { name: "Dana", email: null, phone: "604-555-0111" });
  });

  test("C311: an edited contact is updated, then its customer opens", async () => {
    await expect(actions.updateContactAction(CONTACT, IDLE, contactForm({ email: "dana@example.com" }))).rejects.toThrow(
      `NEXT_REDIRECT /customers/${CUSTOMER}`,
    );
    expect(container.updateContact).toHaveBeenCalledTimes(1);
    expect(container.updateContact).toHaveBeenCalledWith(CONTACT, { name: "Dana", email: "dana@example.com", phone: "604-555-0111" });
  });

  test("C313: a deleted contact goes back to its customer", async () => {
    await expect(actions.deleteContactAction(CONTACT)).rejects.toThrow(`NEXT_REDIRECT /customers/${CUSTOMER}`);
    expect(container.deleteContact).toHaveBeenCalledTimes(1);
    expect(container.deleteContact).toHaveBeenCalledWith(CONTACT);
  });

  test("C314: a contact still named by a site comes back in_use", async () => {
    container.deleteContact.mockResolvedValue({ ok: false, code: "in_use" });
    expect(await actions.deleteContactAction(CONTACT)).toEqual({ status: "in_use" });
  });
});

describe("site actions", () => {
  test("C319: a new site is created for the route's customer, with a contact of that customer, then opened", async () => {
    await expect(actions.createSiteAction(CUSTOMER, IDLE, siteForm())).rejects.toThrow(`NEXT_REDIRECT /sites/${NEW_ID}`);
    expect(container.customerDetail).toHaveBeenCalledWith(CUSTOMER);
    expect(container.createSite).toHaveBeenCalledTimes(1);
    expect(container.createSite).toHaveBeenCalledWith(ORG, CUSTOMER, { name: "Tower A", address: "1 Main St", siteContactId: CONTACT });
  });

  test("C319: a site contact from outside the customer is refused before any write", async () => {
    const state = await actions.createSiteAction(CUSTOMER, IDLE, siteForm({ siteContactId: NEW_ID }));
    expect(state).toMatchObject({ status: "invalid", errors: { siteContactId: "Choose a contact of this customer" } });
    expect(storeCalls()).toBe(0);
  });

  test("C320: an edited site is updated, then opened", async () => {
    await expect(actions.updateSiteAction(SITE, IDLE, siteForm({ address: "2 Main St" }))).rejects.toThrow(`NEXT_REDIRECT /sites/${SITE}`);
    expect(container.updateSite).toHaveBeenCalledTimes(1);
    expect(container.updateSite).toHaveBeenCalledWith(SITE, { name: "Tower A", address: "2 Main St", siteContactId: CONTACT });
  });
});

describe("asset actions", () => {
  test("C325: a new asset is created on the route's site, then the site opens", async () => {
    await expect(actions.createAssetAction(SITE, IDLE, assetForm())).rejects.toThrow(`NEXT_REDIRECT /sites/${SITE}`);
    expect(container.createAsset).toHaveBeenCalledTimes(1);
    expect(container.createAsset).toHaveBeenCalledWith(ORG, SITE, { assetTypeId: TYPE, unitNo: "1", typeModel: null, location: "Roof" });
  });

  test("C326: an edited asset is updated, then its site opens", async () => {
    await expect(actions.updateAssetAction(ASSET, IDLE, assetForm({ location: "Mechanical room" }))).rejects.toThrow(`NEXT_REDIRECT /sites/${SITE}`);
    expect(container.updateAsset).toHaveBeenCalledTimes(1);
    expect(container.updateAsset).toHaveBeenCalledWith(ASSET, { assetTypeId: TYPE, unitNo: "1", typeModel: null, location: "Mechanical room" });
  });

  // Deactivation door 2 supersedes C327: an asset is removed from service, never deleted (C1277, C1280).
  test("C327: there is no asset delete action; a removed asset goes back to its site", async () => {
    expect("deleteAssetAction" in actions).toBe(false);
    await expect(actions.removeAssetAction(ASSET, IDLE, form({}))).rejects.toThrow(`NEXT_REDIRECT /sites/${SITE}`);
  });
});

const allActions: [string, () => Promise<unknown>, (typeof STORE_METHODS)[number]][] = [
  ["createCustomer", () => actions.createCustomerAction(IDLE, customerForm()), "createCustomer"],
  ["updateCustomer", () => actions.updateCustomerAction(CUSTOMER, IDLE, customerForm()), "updateCustomer"],
  ["createContact", () => actions.createContactAction(CUSTOMER, IDLE, contactForm()), "createContact"],
  ["updateContact", () => actions.updateContactAction(CONTACT, IDLE, contactForm()), "updateContact"],
  ["deleteContact", () => actions.deleteContactAction(CONTACT), "deleteContact"],
  ["createSite", () => actions.createSiteAction(CUSTOMER, IDLE, siteForm()), "createSite"],
  ["updateSite", () => actions.updateSiteAction(SITE, IDLE, siteForm()), "updateSite"],
  ["createAsset", () => actions.createAssetAction(SITE, IDLE, assetForm()), "createAsset"],
  ["updateAsset", () => actions.updateAssetAction(ASSET, IDLE, assetForm()), "updateAsset"],
];
const formActions = allActions.filter(([name]) => !name.startsWith("delete"));

describe("who may write, and failures", () => {
  test.each(allActions)("C331: %s refuses a viewer and calls no store method", async (_name, run) => {
    currentMember.mockResolvedValue(member("viewer"));
    expect(await run()).toEqual({ status: "forbidden" });
    expect(storeCalls()).toBe(0);
  });

  test.each(allActions)("C333: %s reports not_found when the store finds no record", async (_name, run, method) => {
    container[method].mockResolvedValue({ ok: false, code: "not_found" });
    const state = await run();
    expect(state).toMatchObject({ status: "not_found" });
    if (!_name.startsWith("delete")) expect(state).toHaveProperty("values");
  });

  test.each(formActions)("C337: %s keeps the typed values when the save is unavailable", async (_name, run, method) => {
    container[method].mockResolvedValue({ ok: false, code: "unavailable" });
    const state = (await run()) as { status: string; values: Record<string, string> };
    expect(state.status).toBe("unavailable");
    expect(Object.values(state.values)).not.toHaveLength(0);
    expect(Object.values(state.values).every((value) => typeof value === "string")).toBe(true);
  });

  test("C337: a contact's typed values come back exactly", async () => {
    container.updateContact.mockResolvedValue({ ok: false, code: "unavailable" });
    const typed = { name: "Dana Typed", email: "dana@example.com", phone: "604-555-0199" };
    expect(await actions.updateContactAction(CONTACT, IDLE, contactForm(typed))).toEqual({ status: "unavailable", values: typed });
  });

  test.each([
    ["createCustomer", () => actions.createCustomerAction(IDLE, extra(customerForm())), "createCustomer", [ORG]],
    ["createContact", () => actions.createContactAction(CUSTOMER, IDLE, extra(contactForm())), "createContact", [ORG, CUSTOMER]],
    ["createSite", () => actions.createSiteAction(CUSTOMER, IDLE, extra(siteForm())), "createSite", [ORG, CUSTOMER]],
    ["createAsset", () => actions.createAssetAction(SITE, IDLE, extra(assetForm())), "createAsset", [ORG, SITE]],
  ] as [string, () => Promise<unknown>, (typeof STORE_METHODS)[number], string[]][])(
    "C335: %s ignores org, parent and source fields in the form",
    async (_name, run, method, expectedIds) => {
      await expect(run()).rejects.toThrow("NEXT_REDIRECT");
      const args = container[method].mock.calls[0];
      expect(args.slice(0, -1)).toEqual(expectedIds);
      const value = args.at(-1) as Record<string, unknown>;
      for (const key of ["org_id", "orgId", "customer_id", "customerId", "site_id", "siteId", "source"]) expect(value).not.toHaveProperty(key);
    },
  );
});

function extra(data: FormData) {
  for (const key of ["org_id", "orgId", "customer_id", "customerId", "site_id", "siteId"]) data.set(key, "00000000-0000-4000-8000-0000000000bb");
  data.set("source", "import");
  return data;
}

const pages = {
  "/customers/new": () => import("./customers/new/page"),
  "/customers/[customerId]/edit": () => import("./customers/[customerId]/edit/page"),
  "/customers/[customerId]/contacts/new": () => import("./customers/[customerId]/contacts/new/page"),
  "/contacts/[contactId]/edit": () => import("./contacts/[contactId]/edit/page"),
  "/customers/[customerId]/sites/new": () => import("./customers/[customerId]/sites/new/page"),
  "/sites/[siteId]/edit": () => import("./sites/[siteId]/edit/page"),
  "/sites/[siteId]/assets/new": () => import("./sites/[siteId]/assets/new/page"),
  "/assets/[assetId]/edit": () => import("./assets/[assetId]/edit/page"),
} as const;
type Route = keyof typeof pages;
const params = { customerId: CUSTOMER, contactId: CONTACT, siteId: SITE, assetId: ASSET };

async function renderPage(route: Route) {
  const { default: Page } = await pages[route]();
  const tree = (await (Page as (props: unknown) => Promise<ReactElement>)({ params: Promise.resolve(params) })) as ReactElement;
  return renderToStaticMarkup(tree).replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
}

describe("form pages", () => {
  test("C306: the edit customer page is prefilled with the current name", async () => {
    expect(await renderPage("/customers/[customerId]/edit")).toMatch(/<input[^>]*id="name"[^>]*value="Kettle Test"/);
  });

  test("C328: with no asset types, the new asset page says the catalog is empty and offers no submit", async () => {
    container.listAssetTypes.mockResolvedValue([]);
    const out = await renderPage("/sites/[siteId]/assets/new");
    expect(out).toContain("Your equipment catalog is empty.");
    expect(out).not.toContain('type="submit"');
  });

  test.each(Object.keys(pages) as Route[])("C330: a viewer on %s gets the reason and no form", async (route) => {
    currentMember.mockResolvedValue(member("viewer"));
    const out = await renderPage(route);
    expect(out).toContain("Only owners, admins and estimators can change customer records.");
    expect(out).not.toContain("<form");
  });

  test.each([
    ["/customers/[customerId]/edit", "customerDetail"],
    ["/customers/[customerId]/contacts/new", "customerDetail"],
    ["/contacts/[contactId]/edit", "contactForEdit"],
    ["/customers/[customerId]/sites/new", "customerDetail"],
    ["/sites/[siteId]/edit", "siteRegister"],
    ["/sites/[siteId]/assets/new", "siteRegister"],
    ["/assets/[assetId]/edit", "assetForEdit"],
  ] as [Route, "customerDetail" | "contactForEdit" | "siteRegister" | "assetForEdit"][])(
    "C332: %s is not found when %s returns null",
    async (route, reader) => {
      container[reader].mockResolvedValue(null);
      await expect(renderPage(route)).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    ["/customers/new", "/customers"],
    ["/customers/[customerId]/edit", `/customers/${CUSTOMER}`],
    ["/customers/[customerId]/contacts/new", `/customers/${CUSTOMER}`],
    ["/contacts/[contactId]/edit", `/customers/${CUSTOMER}`],
    ["/customers/[customerId]/sites/new", `/customers/${CUSTOMER}`],
    ["/sites/[siteId]/edit", `/customers/${CUSTOMER}`],
    ["/sites/[siteId]/assets/new", `/sites/${SITE}`],
    ["/assets/[assetId]/edit", `/sites/${SITE}`],
  ] as [Route, string][])("C339: a writer on %s gets a form whose Cancel goes to %s", async (route, href) => {
    const out = await renderPage(route);
    const cancels = [...out.matchAll(/<a[^>]*href="([^"]*)"[^>]*>Cancel<\/a>/g)].map(([, target]) => target);
    expect(cancels).toEqual([href]);
    expect(out).toMatch(/<form[\s\S]*>Cancel<\/a>/);
  });

  const loadings = {
    "/customers/new": ["New customer", () => import("./customers/new/loading")],
    "/customers/[customerId]/edit": ["Edit customer", () => import("./customers/[customerId]/edit/loading")],
    "/customers/[customerId]/contacts/new": ["New contact", () => import("./customers/[customerId]/contacts/new/loading")],
    "/contacts/[contactId]/edit": ["Edit contact", () => import("./contacts/[contactId]/edit/loading")],
    "/customers/[customerId]/sites/new": ["New site", () => import("./customers/[customerId]/sites/new/loading")],
    "/sites/[siteId]/edit": ["Edit site", () => import("./sites/[siteId]/edit/loading")],
    "/sites/[siteId]/assets/new": ["New asset", () => import("./sites/[siteId]/assets/new/loading")],
    "/assets/[assetId]/edit": ["Edit asset", () => import("./assets/[assetId]/edit/loading")],
  } as const;

  test.each(Object.entries(loadings))("C341: %s shows its header and a Loading… status", async (_route, [title, load]) => {
    const { default: Loading } = await load();
    const out = renderToStaticMarkup(createElement(Loading));
    expect(out).toMatch(new RegExp(`<h1[^>]*>${title}</h1>`));
    expect(out).toMatch(/<p[^>]*role="status"[^>]*>Loading…<\/p>/);
  });
});

const REPLACEMENT = "66666666-6666-4666-8666-666666666666";

describe("deactivation actions", () => {
  test("C1277: removing an asset passes the chosen replacement, then its site opens", async () => {
    await expect(actions.removeAssetAction(ASSET, IDLE, form({ replacedBy: REPLACEMENT }))).rejects.toThrow(`NEXT_REDIRECT /sites/${SITE}`);
    expect(container.setAssetActive).toHaveBeenCalledWith(ASSET, false, REPLACEMENT);
  });

  test("C1277: no replacement is null, and an invalid one is shown with no redirect", async () => {
    await expect(actions.removeAssetAction(ASSET, IDLE, form({ replacedBy: "" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(container.setAssetActive).toHaveBeenCalledWith(ASSET, false, null);
    container.setAssetActive.mockResolvedValue({ ok: false, code: "invalid_replacement" });
    expect(await actions.removeAssetAction(ASSET, IDLE, form({ replacedBy: REPLACEMENT }))).toEqual({ status: "invalid_replacement" });
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  test("C1293: deactivating a site opens it; in_term comes back with the agreement and no redirect", async () => {
    await expect(actions.deactivateSiteAction(SITE)).rejects.toThrow(`NEXT_REDIRECT /sites/${SITE}`);
    expect(container.setSiteActive).toHaveBeenCalledWith(SITE, false);
    container.setSiteActive.mockResolvedValue({ ok: false, code: "in_term", site: "Tower A", number: "AG-1004", termEnd: "2027-12-31" });
    expect(await actions.deactivateSiteAction(SITE)).toEqual({ status: "in_term", site: "Tower A", number: "AG-1004", termEnd: "2027-12-31" });
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  test("C1298: deactivating a customer opens the customer; a refusal names the site", async () => {
    await expect(actions.deactivateCustomerAction(CUSTOMER)).rejects.toThrow(`NEXT_REDIRECT /customers/${CUSTOMER}`);
    expect(container.setCustomerActive).toHaveBeenCalledWith(CUSTOMER, false);
    container.setCustomerActive.mockResolvedValue({ ok: false, code: "changes_requested", site: "Tower A", number: "AG-1004" });
    expect(await actions.deactivateCustomerAction(CUSTOMER)).toEqual({ status: "changes_requested", site: "Tower A", number: "AG-1004" });
  });

  test("C1312: reactivating calls the store with true and opens the record", async () => {
    await expect(actions.reactivateCustomerAction(CUSTOMER)).rejects.toThrow(`NEXT_REDIRECT /customers/${CUSTOMER}`);
    expect(container.setCustomerActive).toHaveBeenCalledWith(CUSTOMER, true);
    await expect(actions.reactivateSiteAction(SITE)).rejects.toThrow(`NEXT_REDIRECT /sites/${SITE}`);
    expect(container.setSiteActive).toHaveBeenCalledWith(SITE, true);
    await expect(actions.reactivateAssetAction(ASSET)).rejects.toThrow(`NEXT_REDIRECT /sites/${SITE}`);
    expect(container.setAssetActive).toHaveBeenCalledWith(ASSET, true);
  });

  test.each([
    ["deactivateCustomerAction", () => actions.deactivateCustomerAction(CUSTOMER)],
    ["reactivateCustomerAction", () => actions.reactivateCustomerAction(CUSTOMER)],
    ["deactivateSiteAction", () => actions.deactivateSiteAction(SITE)],
    ["reactivateSiteAction", () => actions.reactivateSiteAction(SITE)],
    ["removeAssetAction", () => actions.removeAssetAction(ASSET, IDLE, form({ replacedBy: REPLACEMENT }))],
    ["reactivateAssetAction", () => actions.reactivateAssetAction(ASSET)],
  ] as [string, () => Promise<unknown>][])("C1312: %s refuses a viewer and calls no store method", async (_name, run) => {
    currentMember.mockResolvedValue(member("viewer"));
    expect(await run()).toEqual({ status: "forbidden" });
    expect(storeCalls()).toBe(0);
  });
});

describe("contact role actions", () => {
  const OUTSIDER = "66666666-6666-4666-8666-666666666666";
  const REFUSED = "Choose a contact of this customer";

  test("C1461: a site save naming an approver outside the customer's contacts is invalid and saves nothing", async () => {
    const fields = siteForm({ approverContactId: OUTSIDER });
    expect(await actions.updateSiteAction(SITE, IDLE, fields)).toEqual({
      status: "invalid",
      errors: { approverContactId: REFUSED },
      values: { name: "Tower A", address: "1 Main St", siteContactId: CONTACT, approverContactId: OUTSIDER },
    });
    expect(storeCalls()).toBe(0);
  });

  test("C1462: a customer save naming a billing contact outside the customer's contacts is invalid and saves nothing", async () => {
    expect(await actions.updateCustomerAction(CUSTOMER, IDLE, form({ name: "Acme", billingContactId: OUTSIDER }))).toEqual({
      status: "invalid",
      errors: { billingContactId: REFUSED },
      values: { name: "Acme", billingContactId: OUTSIDER },
    });
    expect(storeCalls()).toBe(0);
  });
});
