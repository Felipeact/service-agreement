import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222222";
const VERSION = "77777777-7777-4777-8777-777777777777";

const currentMember = vi.fn();
const create = vi.fn();
const createCustomer = vi.fn();
const createSite = vi.fn();
const customerDetail = vi.fn();
const siteRegister = vi.fn();
const container = { currentMember, agreementStore: { create }, createCustomer, createSite, customerDetail, siteRegister };
vi.mock("@/composition", () => ({ getContainer: async () => container }));

const { startAgreementAction } = await import("./new-agreement-actions");

const input = (patch: Record<string, string> = {}) => ({ customer: CUSTOMER, customerName: "", site: SITE, siteName: "", address: "", ...patch });

beforeEach(() => {
  vi.resetAllMocks();
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "u@example.test", orgId: "org-1", orgName: "Org", role: "estimator" });
  siteRegister.mockResolvedValue({ customerId: CUSTOMER });
  customerDetail.mockResolvedValue({ id: CUSTOMER });
  create.mockResolvedValue({ ok: true, id: "ag-1" });
});

describe("startAgreementAction, the template choice", () => {
  test("C5404: a chosen template's version goes to the store with the site, and the agreement is started", async () => {
    const state = await startAgreementAction(input({ templateVersionId: VERSION }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(SITE, VERSION);
    expect(state).toEqual({ status: "started", agreementId: "ag-1", siteId: SITE });
  });

  test.each([["no version", undefined], ["an empty version", ""]])("C5404: Standard agreement (%s) calls the store with the site alone", async (_label, templateVersionId) => {
    const state = await startAgreementAction(input(templateVersionId === undefined ? {} : { templateVersionId }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]).toEqual([SITE]);
    expect(state).toEqual({ status: "started", agreementId: "ag-1", siteId: SITE });
  });

  test("C5407: a forged version that is not a UUID is refused as a field error and never reaches the store", async () => {
    const state = await startAgreementAction(input({ templateVersionId: "'; drop table x; --" }));
    expect(state).toEqual({ status: "invalid", errors: { templateVersionId: "Choose a template from the list" } });
    expect(create).not.toHaveBeenCalled();
  });

  test("C5405: when the store refuses the version the action answers invalid_template and starts nothing further", async () => {
    create.mockResolvedValue({ ok: false, code: "invalid_template" });
    const state = await startAgreementAction(input({ templateVersionId: VERSION }));
    expect(state).toEqual({ status: "invalid_template" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(createCustomer).not.toHaveBeenCalled();
    expect(createSite).not.toHaveBeenCalled();
  });

  test("C5405: a customer and site made in the same call are handed back so choosing another template does not make them twice", async () => {
    createCustomer.mockResolvedValue({ ok: true, id: CUSTOMER });
    createSite.mockResolvedValue({ ok: true, id: SITE });
    create.mockResolvedValue({ ok: false, code: "invalid_template" });
    const state = await startAgreementAction({ customer: "__new", customerName: "Kestrel Logistics", site: "__new", siteName: "Dock 4", address: "", templateVersionId: VERSION });
    expect(state).toEqual({ status: "invalid_template", customerId: CUSTOMER, siteId: SITE });
  });

  test("C5404: a viewer is refused and nothing is created", async () => {
    currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "u@example.test", orgId: "org-1", orgName: "Org", role: "viewer" });
    expect(await startAgreementAction(input({ templateVersionId: VERSION }))).toEqual({ status: "forbidden" });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("startAgreementAction, the other answers", () => {
  test("C1364: a site that already has a live agreement answers open_exists with that agreement's id and number", async () => {
    create.mockResolvedValue({ ok: false, code: "open_exists", agreementId: "ag-live", number: "AG-0042" });
    const state = await startAgreementAction(input());
    expect(state).toEqual({ status: "open_exists", agreementId: "ag-live", number: "AG-0042" });
  });

  test("C5404: a site that is not the chosen customer's answers not_found and creates nothing", async () => {
    siteRegister.mockResolvedValue({ customerId: "99999999-9999-4999-8999-999999999999" });
    expect(await startAgreementAction(input())).toEqual({ status: "not_found" });
    expect(create).not.toHaveBeenCalled();
  });

  test("C5404: a site that does not exist answers not_found", async () => {
    siteRegister.mockResolvedValue(null);
    expect(await startAgreementAction(input())).toEqual({ status: "not_found" });
    expect(create).not.toHaveBeenCalled();
  });

  test("C5404: a store that cannot create the draft answers unavailable, carrying the ids this call made", async () => {
    createCustomer.mockResolvedValue({ ok: true, id: CUSTOMER });
    createSite.mockResolvedValue({ ok: true, id: SITE });
    create.mockResolvedValue({ ok: false, code: "unavailable" });
    const state = await startAgreementAction({ customer: "__new", customerName: "Kestrel Logistics", site: "__new", siteName: "Dock 4", address: "" });
    expect(state).toEqual({ status: "unavailable", customerId: CUSTOMER, siteId: SITE });
  });

  test("C5404: a store that refuses the member answers forbidden", async () => {
    create.mockResolvedValue({ ok: false, code: "forbidden" });
    expect(await startAgreementAction(input())).toEqual({ status: "forbidden", customerId: CUSTOMER, siteId: SITE });
  });
});
